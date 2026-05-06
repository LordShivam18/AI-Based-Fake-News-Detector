const params = new URLSearchParams(window.location.search);
const tabId = Number(params.get("tabId"));
const elements = {
  analyzedMeta: document.getElementById("analyzedMeta"),
  analyzedText: document.getElementById("analyzedText"),
  analyzeAgainButton: document.getElementById("analyzeAgainButton"),
  breakdownList: document.getElementById("breakdownList"),
  clearButton: document.getElementById("clearButton"),
  confidenceValue: document.getElementById("confidenceValue"),
  emptyState: document.getElementById("emptyState"),
  explanationList: document.getElementById("explanationList"),
  extractionValue: document.getElementById("extractionValue"),
  highlightButton: document.getElementById("highlightButton"),
  highlightValue: document.getElementById("highlightValue"),
  improvementText: document.getElementById("improvementText"),
  processingValue: document.getElementById("processingValue"),
  report: document.getElementById("report"),
  rewriteText: document.getElementById("rewriteText"),
  riskBadge: document.getElementById("riskBadge"),
  scoreValue: document.getElementById("scoreValue"),
  sourceLabel: document.getElementById("sourceLabel"),
  sourceNote: document.getElementById("sourceNote"),
  suggestionList: document.getElementById("suggestionList"),
  toast: document.getElementById("toast"),
  uncertaintyNote: document.getElementById("uncertaintyNote")
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadReport();
});

function bindEvents() {
  elements.analyzeAgainButton.addEventListener("click", async () => {
    setButtonsDisabled(true);
    showToast("Running a fresh analysis...");
    const response = await sendMessage({ type: "AICA_ANALYZE_TAB", tabId });
    setButtonsDisabled(false);
    if (!response.ok) {
      showToast(response.error || "Analysis failed.");
      return;
    }
    renderReport(response.state);
    showToast("Analysis updated.");
  });

  elements.highlightButton.addEventListener("click", async () => {
    setButtonsDisabled(true);
    const response = await sendMessage({ type: "AICA_APPLY_HIGHLIGHTS_TAB", tabId });
    setButtonsDisabled(false);
    if (!response.ok) {
      showToast(response.error || "Highlights could not be applied.");
      return;
    }
    renderReport(response.state);
    showToast(`Applied ${response.count || 0} highlights.`);
  });

  elements.clearButton.addEventListener("click", async () => {
    setButtonsDisabled(true);
    const response = await sendMessage({ type: "AICA_CLEAR_HIGHLIGHTS_TAB", tabId });
    setButtonsDisabled(false);
    if (!response.ok) {
      showToast(response.error || "Highlights could not be cleared.");
      return;
    }
    await loadReport();
    showToast("Highlights cleared.");
  });
}

async function loadReport() {
  const response = await sendMessage({ type: "AICA_GET_TAB_STATE", tabId });
  if (!response.ok || !response.state?.analysis) {
    elements.emptyState.hidden = false;
    elements.report.hidden = true;
    setButtonsDisabled(true);
    if (response.error) {
      showToast(response.error);
    }
    return;
  }

  setButtonsDisabled(false);
  renderReport(response.state);
}

function renderReport(state) {
  const analysis = state.analysis;
  const risk = String(analysis.risk_level || "UNKNOWN").toLowerCase();
  elements.emptyState.hidden = true;
  elements.report.hidden = false;
  elements.sourceLabel.textContent = state.tab?.title || state.page?.title || "Analyzed page";
  elements.scoreValue.textContent = formatPercent(analysis.credibility_score);
  elements.riskBadge.textContent = `${analysis.risk_level || "UNKNOWN"} risk`;
  elements.riskBadge.className = `risk-badge risk-${risk}`;
  elements.confidenceValue.textContent = formatPercent(analysis.model_confidence);
  elements.processingValue.textContent = `${analysis.processing_time_ms || 0} ms`;
  elements.extractionValue.textContent = `${state.extraction?.words || 0} words`;
  elements.highlightValue.textContent = state.highlight?.applied
    ? `${state.highlight.count || 0} active`
    : "Off";
  elements.sourceNote.textContent = analysis.breakdown?.source_note || "";
  elements.improvementText.textContent = analysis.improvement
    ? `${formatPercent(analysis.improvement.before_score)} to ${formatPercent(analysis.improvement.after_score)} (${analysis.improvement.change})`
    : "";
  elements.uncertaintyNote.textContent = analysis.uncertainty_note || "";
  elements.rewriteText.textContent = analysis.suggested_rewrite || "No rewrite suggestion returned.";
  elements.analyzedText.textContent = analysis.analyzed_text || "";
  elements.analyzedMeta.textContent = buildAnalyzedMeta(state);

  renderBreakdown(analysis.breakdown);
  renderExplanation(analysis.explanation || []);
  renderSuggestions(analysis.suggestions || []);
}

function renderBreakdown(breakdown) {
  elements.breakdownList.replaceChildren();
  const rows = [
    ["Language", breakdown?.language_score],
    ["Structure", breakdown?.structure_score],
    ["Sources", breakdown?.source_score]
  ];

  for (const [label, value] of rows) {
    const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
    const item = document.createElement("div");
    item.className = "breakdown-item";
    const top = document.createElement("div");
    top.className = "breakdown-top";
    const name = document.createElement("span");
    name.textContent = label;
    const score = document.createElement("strong");
    score.textContent = `${safeValue}/100`;
    top.append(name, score);
    const bar = document.createElement("div");
    bar.className = "breakdown-bar";
    const fill = document.createElement("span");
    fill.style.width = `${Math.max(0, Math.min(100, safeValue))}%`;
    bar.append(fill);
    item.append(top, bar);
    elements.breakdownList.append(item);
  }
}

function renderExplanation(items) {
  elements.explanationList.replaceChildren();

  if (!items.length) {
    elements.explanationList.append(emptyText("No explanation items returned by the backend."));
    return;
  }

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "explanation-item";
    row.dataset.type = item.type || "issue";

    const title = document.createElement("strong");
    title.textContent = formatIssueType(item.type);
    const text = document.createElement("p");
    text.textContent = item.text || "Signal detected.";
    const reason = document.createElement("span");
    reason.textContent = item.reason || "";
    const impact = document.createElement("span");
    impact.textContent = item.impact || "";

    row.append(title, text, reason, impact);
    elements.explanationList.append(row);
  }
}

function renderSuggestions(suggestions) {
  elements.suggestionList.replaceChildren();
  if (!suggestions.length) {
    elements.suggestionList.append(emptyListItem("No suggestions returned."));
    return;
  }

  for (const suggestion of suggestions) {
    const item = document.createElement("li");
    item.textContent = suggestion;
    elements.suggestionList.append(item);
  }
}

function emptyText(message) {
  const item = document.createElement("p");
  item.textContent = message;
  return item;
}

function emptyListItem(message) {
  const item = document.createElement("li");
  item.textContent = message;
  return item;
}

function buildAnalyzedMeta(state) {
  const bits = [];
  if (state.page?.url || state.tab?.url) {
    bits.push(state.page?.url || state.tab?.url);
  }
  if (state.extraction?.truncated) {
    bits.push(`trimmed to ${state.extraction.maxChars} characters`);
  }
  if (state.analyzedAt) {
    bits.push(new Date(state.analyzedAt).toLocaleString());
  }
  return bits.join(" | ");
}

function setButtonsDisabled(disabled) {
  elements.analyzeAgainButton.disabled = disabled;
  elements.highlightButton.disabled = disabled;
  elements.clearButton.disabled = disabled;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2800);
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        resolve({ ok: false, error: error.message });
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
