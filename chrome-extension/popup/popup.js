const elements = {
  analyzeButton: document.getElementById("analyzeButton"),
  apiBaseInput: document.getElementById("apiBaseInput"),
  clearButton: document.getElementById("clearButton"),
  confidenceValue: document.getElementById("confidenceValue"),
  connectionBadge: document.getElementById("connectionBadge"),
  emptyState: document.getElementById("emptyState"),
  errorCard: document.getElementById("errorCard"),
  errorText: document.getElementById("errorText"),
  highlightValue: document.getElementById("highlightValue"),
  issueList: document.getElementById("issueList"),
  loadingState: document.getElementById("loadingState"),
  pageLabel: document.getElementById("pageLabel"),
  processingValue: document.getElementById("processingValue"),
  rehighlightButton: document.getElementById("rehighlightButton"),
  resultCard: document.getElementById("resultCard"),
  riskBadge: document.getElementById("riskBadge"),
  saveSettingsButton: document.getElementById("saveSettingsButton"),
  scoreRing: document.getElementById("scoreRing"),
  scoreValue: document.getElementById("scoreValue"),
  settingsStatus: document.getElementById("settingsStatus"),
  summaryText: document.getElementById("summaryText"),
  summaryTitle: document.getElementById("summaryTitle"),
  viewButton: document.getElementById("viewButton")
};

let activeTabId = null;
let currentState = null;

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadState();
});

function bindEvents() {
  elements.analyzeButton.addEventListener("click", () => {
    analyzeActiveTab();
  });

  elements.viewButton.addEventListener("click", async () => {
    await sendMessage({
      type: "AICA_OPEN_FULL_ANALYSIS",
      tabId: activeTabId
    });
    window.close();
  });

  elements.rehighlightButton.addEventListener("click", async () => {
    setBusy(true, "Re-applying highlights");
    const response = await sendMessage({ type: "AICA_APPLY_HIGHLIGHTS_ACTIVE_TAB" });
    setBusy(false);
    if (!response.ok) {
      showError(response.error);
      return;
    }
    await loadState();
  });

  elements.clearButton.addEventListener("click", async () => {
    setBusy(true, "Clearing highlights");
    const response = await sendMessage({ type: "AICA_CLEAR_HIGHLIGHTS_ACTIVE_TAB" });
    setBusy(false);
    if (!response.ok) {
      showError(response.error);
      return;
    }
    await loadState();
  });

  elements.saveSettingsButton.addEventListener("click", async () => {
    elements.settingsStatus.textContent = "Saving...";
    const response = await sendMessage({
      type: "AICA_SAVE_SETTINGS",
      settings: {
        apiBaseUrl: elements.apiBaseInput.value
      }
    });
    if (!response.ok) {
      elements.settingsStatus.textContent = response.error || "Settings could not be saved.";
      return;
    }
    elements.apiBaseInput.value = response.settings.apiBaseUrl;
    elements.settingsStatus.textContent = "Saved.";
  });
}

async function loadState() {
  const response = await sendMessage({ type: "AICA_GET_ACTIVE_TAB_STATE" });
  if (!response.ok) {
    showError(response.error);
    renderState(null);
    return;
  }

  activeTabId = response.tab?.id || null;
  currentState = response.state || null;
  elements.pageLabel.textContent = response.tab?.title || "Ready to analyze this page";
  elements.apiBaseInput.value = response.settings?.apiBaseUrl || "http://localhost:8000";
  elements.connectionBadge.textContent = apiLabel(elements.apiBaseInput.value);
  renderState(currentState);
}

async function analyzeActiveTab() {
  hideError();
  setBusy(true, "Analyzing page");
  const response = await sendMessage({ type: "AICA_ANALYZE_ACTIVE_TAB" });
  setBusy(false);

  if (!response.ok) {
    showError(response.error);
    renderState(currentState);
    return;
  }

  currentState = response.state;
  activeTabId = currentState?.tab?.id || activeTabId;
  renderState(currentState);
}

function renderState(state) {
  const hasAnalysis = Boolean(state?.analysis);
  elements.emptyState.hidden = hasAnalysis;
  elements.resultCard.hidden = !hasAnalysis;
  elements.viewButton.disabled = !hasAnalysis;
  elements.rehighlightButton.disabled = !hasAnalysis;
  elements.clearButton.disabled = !hasAnalysis;

  if (!hasAnalysis) {
    return;
  }

  const analysis = state.analysis;
  const score = Number(analysis.credibility_score || 0);
  const risk = String(analysis.risk_level || "UNKNOWN").toLowerCase();
  const issues = (analysis.explanation || []).filter((item) => item.type !== "no_risk_signals");
  const sourceLabel = state.source?.type === "selection" ? "Selected text" : "Page";

  elements.scoreValue.textContent = formatPercent(score);
  elements.scoreRing.style.setProperty("--score-angle", `${Math.round(score * 360)}deg`);
  elements.riskBadge.textContent = `${analysis.risk_level || "UNKNOWN"} risk`;
  elements.riskBadge.className = `risk-badge risk-${risk}`;
  elements.summaryTitle.textContent = issues.length
    ? `${sourceLabel}: ${issues.length} issue${issues.length === 1 ? "" : "s"} detected`
    : `${sourceLabel}: no obvious risk signals`;
  elements.summaryText.textContent = summarizeExplanation(analysis);
  elements.confidenceValue.textContent = formatPercent(analysis.model_confidence);
  elements.processingValue.textContent = `${analysis.processing_time_ms || 0} ms`;
  elements.highlightValue.textContent = state.highlight?.applied
    ? `${state.highlight.count || 0}`
    : "Off";

  renderIssues(issues);
}

function renderIssues(issues) {
  elements.issueList.replaceChildren();
  const topIssues = issues.slice(0, 3);

  if (!topIssues.length) {
    const item = document.createElement("div");
    item.className = "issue-item";
    const title = document.createElement("strong");
    title.textContent = "Cleaner language";
    const copy = document.createElement("span");
    copy.textContent = "The rule engine did not find emotional, clickbait, or all-caps phrasing.";
    item.append(title, copy);
    elements.issueList.append(item);
    return;
  }

  for (const issue of topIssues) {
    const item = document.createElement("div");
    item.className = "issue-item";
    const title = document.createElement("strong");
    title.textContent = formatIssueType(issue.type);
    const copy = document.createElement("span");
    copy.textContent = issue.text || issue.reason || "Potential credibility issue detected.";
    item.append(title, copy);
    elements.issueList.append(item);
  }
}

function summarizeExplanation(analysis) {
  const issues = (analysis.explanation || []).filter((item) => item.type !== "no_risk_signals");
  if (issues.length) {
    return issues[0].reason || issues[0].text || "The page contains language patterns worth reviewing.";
  }
  return "The page looks relatively neutral, but factual claims should still be checked against reliable sources.";
}

function setBusy(isBusy, label = "Analyzing page") {
  elements.loadingState.hidden = !isBusy;
  elements.analyzeButton.disabled = isBusy;
  elements.viewButton.disabled = isBusy || !currentState?.analysis;
  elements.rehighlightButton.disabled = isBusy || !currentState?.analysis;
  elements.clearButton.disabled = isBusy || !currentState?.analysis;
  elements.analyzeButton.textContent = isBusy ? label : "Analyze This Page";
}

function showError(message) {
  elements.errorText.textContent = message || "Something went wrong. Please try again.";
  elements.errorCard.hidden = false;
}

function hideError() {
  elements.errorCard.hidden = true;
  elements.errorText.textContent = "";
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        resolve({
          ok: false,
          error: error.message
        });
        return;
      }
      resolve(response || { ok: false, error: "No response from the extension service worker." });
    });
  });
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "--";
  }
  return `${Math.round(number * 100)}%`;
}

function formatIssueType(type) {
  return String(type || "issue")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function apiLabel(url) {
  try {
    return new URL(url).hostname || "Local";
  } catch (_error) {
    return "Local";
  }
}
