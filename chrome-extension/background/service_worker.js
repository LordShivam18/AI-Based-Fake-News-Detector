const DEFAULT_API_BASE_URL = "http://localhost:8000";
const MAX_EXTRACTED_CHARS = 12000;
const MAX_SELECTED_CHARS = 12000;
const MIN_EXTRACTED_CHARS = 80;
const MIN_SELECTED_CHARS = 20;
const API_TIMEOUT_MS = 45000;
const STORAGE_LATEST_KEY = "aica:latest";
const SETTINGS_KEY = "aica:settings";
const CONTEXT_MENU_ID = "aica-analyze-selected-text";
const inFlightAnalyses = new Map();

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(SETTINGS_KEY, (items) => {
    if (!items[SETTINGS_KEY]) {
      chrome.storage.sync.set({
        [SETTINGS_KEY]: {
          apiBaseUrl: DEFAULT_API_BASE_URL
        }
      });
    }
  });
  setupContextMenu();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const key of inFlightAnalyses.keys()) {
    if (key.includes(`:${tabId}`)) {
      inFlightAnalyses.delete(key);
    }
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) {
    return;
  }

  handleSelectionContextMenu(info, tab);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  runMessageHandler(message, sender)
    .then((payload) => sendResponse(payload))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: toFriendlyError(error)
      });
    });

  return true;
});

async function runMessageHandler(message) {
  switch (message?.type) {
    case "AICA_GET_ACTIVE_TAB_STATE": {
      const tab = await getActiveTab();
      const state = await getStoredState(tab.id);
      const settings = await getSettings();
      return { ok: true, tab: serializeTab(tab), state, settings };
    }

    case "AICA_GET_TAB_STATE": {
      const tabId = Number(message.tabId);
      const state = await getStoredState(tabId);
      const settings = await getSettings();
      return { ok: true, state, settings };
    }

    case "AICA_ANALYZE_ACTIVE_TAB": {
      const tab = await getActiveTab();
      return analyzeTab(tab.id);
    }

    case "AICA_ANALYZE_TAB": {
      return analyzeTab(Number(message.tabId));
    }

    case "AICA_ANALYZE_SAVED_CONTEXT": {
      return analyzeSavedContext(Number(message.tabId));
    }

    case "AICA_OPEN_FULL_ANALYSIS": {
      const tabId = message.tabId ? Number(message.tabId) : (await getActiveTab()).id;
      const url = chrome.runtime.getURL(`panel/panel.html?tabId=${encodeURIComponent(tabId)}`);
      const created = await createTab({ url });
      return { ok: true, tabId: created.id };
    }

    case "AICA_APPLY_HIGHLIGHTS_ACTIVE_TAB": {
      const tab = await getActiveTab();
      return applyStoredHighlights(tab.id);
    }

    case "AICA_APPLY_HIGHLIGHTS_TAB": {
      return applyStoredHighlights(Number(message.tabId));
    }

    case "AICA_CLEAR_HIGHLIGHTS_ACTIVE_TAB": {
      const tab = await getActiveTab();
      return clearHighlights(tab.id);
    }

    case "AICA_CLEAR_HIGHLIGHTS_TAB": {
      return clearHighlights(Number(message.tabId));
    }

    case "AICA_HIDE_BADGE_TAB": {
      return hideFloatingBadge(Number(message.tabId));
    }

    case "AICA_SAVE_SETTINGS": {
      const settings = {
        apiBaseUrl: normalizeApiBaseUrl(message.settings?.apiBaseUrl || DEFAULT_API_BASE_URL)
      };
      await setStorage("sync", { [SETTINGS_KEY]: settings });
      return { ok: true, settings };
    }

    default:
      throw new Error("Unknown extension action.");
  }
}

function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Analyze with Credibility Assistant",
      contexts: ["selection"],
      documentUrlPatterns: ["http://*/*", "https://*/*"]
    });
  });
}

async function handleSelectionContextMenu(info, tab) {
  try {
    const response = await analyzeSelectedText(tab.id, info.selectionText || "");
    if (response.ok) {
      await openFullAnalysis(tab.id);
    }
  } catch (error) {
    await renderFloatingBadge(tab.id, {
      error: true,
      label: "Credibility",
      riskLevel: "UNKNOWN"
    }).catch(() => undefined);
    console.warn("AI Credibility Assistant selection analysis failed:", error);
  }
}

async function analyzeTab(tabId) {
  if (!Number.isFinite(tabId)) {
    throw new Error("No browser tab is available for analysis.");
  }

  const key = `page:${tabId}`;
  if (inFlightAnalyses.has(key)) {
    return inFlightAnalyses.get(key);
  }

  const promise = performAnalysis(tabId).finally(() => {
    inFlightAnalyses.delete(key);
  });
  inFlightAnalyses.set(key, promise);
  return promise;
}

async function performAnalysis(tabId) {
  const tab = await getTab(tabId);
  assertSupportedTab(tab);
  await ensureContentScripts(tab.id);

  const extractionResponse = await sendTabMessage(tab.id, {
    type: "AICA_EXTRACT_PAGE",
    maxChars: MAX_EXTRACTED_CHARS
  });

  if (!extractionResponse?.ok || !extractionResponse.text) {
    throw new Error(
      extractionResponse?.error ||
        "I could not extract enough readable text from this page. Try opening the article body or selecting a text-heavy page."
    );
  }

  if (extractionResponse.text.length < MIN_EXTRACTED_CHARS) {
    throw new Error("This page does not appear to contain enough readable article text to analyze.");
  }

  return analyzeTextForTab(tab, extractionResponse.text, {
    mode: "page",
    page: extractionResponse.page,
    extraction: extractionResponse.stats
  });
}

async function analyzeSelectedText(tabId, rawText) {
  const tab = await getTab(tabId);
  assertSupportedTab(tab);
  await ensureContentScripts(tab.id);

  const limited = limitPlainText(cleanSelectedText(rawText), MAX_SELECTED_CHARS);
  if (limited.text.length < MIN_SELECTED_CHARS) {
    throw new Error("Select a little more article text before analyzing.");
  }

  const key = `selection:${tabId}:${checksum(limited.text)}`;
  if (inFlightAnalyses.has(key)) {
    return inFlightAnalyses.get(key);
  }

  const promise = analyzeTextForTab(tab, limited.text, {
    mode: "selection",
    page: {
      title: tab.title || "Selected text",
      url: tab.url,
      language: "",
      source: "selected-text"
    },
    extraction: {
      chars: limited.text.length,
      words: countWords(limited.text),
      elements: 1,
      truncated: limited.truncated,
      maxChars: MAX_SELECTED_CHARS
    }
  }).finally(() => {
    inFlightAnalyses.delete(key);
  });

  inFlightAnalyses.set(key, promise);
  return promise;
}

async function analyzeSavedContext(tabId) {
  const state = await getStoredState(tabId);
  if (state?.source?.type === "selection" && state.analysis?.analyzed_text) {
    return analyzeSelectedText(tabId, state.analysis.analyzed_text);
  }
  return analyzeTab(tabId);
}

async function analyzeTextForTab(tab, text, context) {
  const settings = await getSettings();
  const analysis = await postAnalyze(settings.apiBaseUrl, {
    text,
    url: tab.url
  });

  const state = {
    id: `${Date.now()}:${tab.id}`,
    analyzedAt: new Date().toISOString(),
    apiBaseUrl: settings.apiBaseUrl,
    tab: serializeTab(tab),
    page: context.page,
    extraction: context.extraction,
    source: {
      type: context.mode,
      label: context.mode === "selection" ? "Selected text" : "Full page"
    },
    analysis,
    highlight: {
      applied: false,
      count: 0,
      error: null
    }
  };

  const highlightResult = await applyHighlightsFromAnalysis(tab.id, analysis).catch((error) => ({
    ok: false,
    error: toFriendlyError(error)
  }));

  state.highlight = {
    applied: Boolean(highlightResult.ok),
    count: highlightResult.count || 0,
    error: highlightResult.ok ? null : highlightResult.error
  };

  const badgeResult = await renderFloatingBadge(tab.id, {
    label: "Credibility",
    mode: context.mode,
    riskLevel: analysis.risk_level,
    score: analysis.credibility_score
  }).catch((error) => ({
    ok: false,
    error: toFriendlyError(error)
  }));

  state.badge = {
    shown: Boolean(badgeResult.ok),
    error: badgeResult.ok ? null : badgeResult.error
  };

  await saveState(tab.id, state);
  return { ok: true, state };
}

async function postAnalyze(apiBaseUrl, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const endpoint = `${normalizeApiBaseUrl(apiBaseUrl)}/analyze`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const body = await safeJson(response);
    if (!response.ok) {
      throw new Error(body?.error || `Analysis failed with HTTP ${response.status}.`);
    }

    return body;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The backend took too long to respond. Check that it is running and try again.");
    }

    if (error instanceof TypeError) {
      throw new Error(
        `Could not reach the backend at ${endpoint}. Start the API server, then retry.`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function applyStoredHighlights(tabId) {
  const state = await getStoredState(tabId);
  if (!state?.analysis) {
    throw new Error("There is no saved analysis for this tab yet.");
  }

  const result = await applyHighlightsFromAnalysis(tabId, state.analysis);
  const nextState = {
    ...state,
    highlight: {
      applied: Boolean(result.ok),
      count: result.count || 0,
      error: result.ok ? null : result.error || null
    }
  };
  await renderFloatingBadge(tabId, {
    label: "Credibility",
    mode: nextState.source?.type || "page",
    riskLevel: nextState.analysis.risk_level,
    score: nextState.analysis.credibility_score
  }).catch(() => undefined);
  await saveState(tabId, nextState);
  return { ok: true, state: nextState, count: result.count || 0 };
}

async function applyHighlightsFromAnalysis(tabId, analysis) {
  const tab = await getTab(tabId);
  assertSupportedTab(tab);
  await ensureContentScripts(tabId);
  const response = await sendTabMessage(tabId, {
    type: "AICA_APPLY_HIGHLIGHTS",
    explanation: analysis.explanation || []
  });

  if (!response?.ok) {
    throw new Error(response?.error || "The page could not be highlighted.");
  }

  return response;
}

async function renderFloatingBadge(tabId, badge) {
  const tab = await getTab(tabId);
  assertSupportedTab(tab);
  await ensureContentScripts(tabId);
  const response = await sendTabMessage(tabId, {
    type: "AICA_RENDER_BADGE",
    badge
  });

  if (!response?.ok) {
    throw new Error(response?.error || "The credibility badge could not be shown.");
  }

  return response;
}

async function hideFloatingBadge(tabId) {
  const tab = await getTab(tabId);
  assertSupportedTab(tab);
  await ensureContentScripts(tabId);
  const response = await sendTabMessage(tabId, {
    type: "AICA_HIDE_BADGE"
  });
  return { ok: true, count: response?.count || 0 };
}

async function clearHighlights(tabId) {
  const tab = await getTab(tabId);
  assertSupportedTab(tab);
  await ensureContentScripts(tabId);
  const response = await sendTabMessage(tabId, {
    type: "AICA_CLEAR_HIGHLIGHTS"
  });

  const state = await getStoredState(tabId);
  if (state) {
    await saveState(tabId, {
      ...state,
      highlight: {
        applied: false,
        count: 0,
        error: null
      }
    });
  }

  return { ok: true, count: response?.count || 0 };
}

async function ensureContentScripts(tabId) {
  let needsInjection = true;
  try {
    const ping = await sendTabMessage(tabId, { type: "AICA_PING" });
    if (
      ping?.ok &&
      ping.capabilities?.extractor &&
      ping.capabilities?.highlighter &&
      ping.capabilities?.badge
    ) {
      needsInjection = false;
    }
  } catch (_error) {
    needsInjection = true;
  }

  if (needsInjection) {
    await insertCss(tabId, "content/content.css").catch(() => undefined);
    await executeScripts(tabId, [
      "content/extractor.js",
      "content/highlighter.js",
      "content/badge.js",
      "content/contentScript.js"
    ]);
  }

  const ping = await sendTabMessage(tabId, { type: "AICA_PING" });
  if (!ping?.ok) {
    throw new Error("The extension could not connect to this page. Reload the tab and try again.");
  }
}

function assertSupportedTab(tab) {
  if (!tab?.id || !/^https?:\/\//i.test(tab.url || "")) {
    throw new Error("This extension can analyze regular http and https webpages only.");
  }
}

function serializeTab(tab) {
  return {
    id: tab.id,
    title: tab.title || "",
    url: tab.url || "",
    favIconUrl: tab.favIconUrl || ""
  };
}

function normalizeApiBaseUrl(value) {
  const trimmed = String(value || DEFAULT_API_BASE_URL).trim();
  return trimmed.replace(/\/+$/, "") || DEFAULT_API_BASE_URL;
}

function cleanSelectedText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function limitPlainText(text, maxChars) {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }

  const slice = text.slice(0, maxChars);
  const sentenceBoundary = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("\n\n")
  );
  const safeEnd = sentenceBoundary > maxChars * 0.7 ? sentenceBoundary + 1 : maxChars;
  return {
    text: slice.slice(0, safeEnd).trim(),
    truncated: true
  };
}

function countWords(text) {
  return (String(text || "").match(/\b[\w'-]+\b/g) || []).length;
}

function checksum(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function tabStateKey(tabId) {
  return `aica:tab:${tabId}`;
}

async function saveState(tabId, state) {
  await setStorage("local", {
    [tabStateKey(tabId)]: state,
    [STORAGE_LATEST_KEY]: state
  });
}

async function getStoredState(tabId) {
  if (!Number.isFinite(tabId)) {
    return null;
  }
  const items = await getStorage("local", [tabStateKey(tabId), STORAGE_LATEST_KEY]);
  return items[tabStateKey(tabId)] || null;
}

async function getSettings() {
  const items = await getStorage("sync", SETTINGS_KEY);
  return {
    apiBaseUrl: normalizeApiBaseUrl(items[SETTINGS_KEY]?.apiBaseUrl || DEFAULT_API_BASE_URL)
  };
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

function toFriendlyError(error) {
  if (!error) {
    return "Something went wrong. Please try again.";
  }
  return error.message || String(error);
}

function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      if (!tabs?.length) {
        reject(new Error("No active tab was found."));
        return;
      }
      resolve(tabs[0]);
    });
  });
}

function getTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(tab);
    });
  });
}

function createTab(createProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(createProperties, (tab) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(tab);
    });
  });
}

function openFullAnalysis(tabId) {
  const url = chrome.runtime.getURL(`panel/panel.html?tabId=${encodeURIComponent(tabId)}`);
  return createTab({ url });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

function executeScripts(tabId, files) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({ target: { tabId }, files }, (results) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(results);
    });
  });
}

function insertCss(tabId, file) {
  return new Promise((resolve, reject) => {
    chrome.scripting.insertCSS({ target: { tabId }, files: [file] }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

function getStorage(area, keys) {
  return new Promise((resolve, reject) => {
    chrome.storage[area].get(keys, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(items || {});
    });
  });
}

function setStorage(area, items) {
  return new Promise((resolve, reject) => {
    chrome.storage[area].set(items, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}
