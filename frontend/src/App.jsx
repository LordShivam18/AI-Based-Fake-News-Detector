import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://localhost:8000";
const HISTORY_KEY = "ai-trust-engine-history";
const MAX_HISTORY_ITEMS = 10;
const DEFAULT_UNCERTAINTY_NOTE =
  "This tool provides AI-based analysis and may not be fully accurate.";
const DEMO_TEXT =
  "BREAKING shocking report claims a hidden health crisis is spreading across major cities!!! Officials have not released verified evidence, but viral posts say urgent action is needed immediately.";

const riskStyles = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  HIGH: "bg-red-100 text-red-800 border-red-200",
};

const riskBarStyles = {
  LOW: "bg-emerald-500",
  MEDIUM: "bg-amber-500",
  HIGH: "bg-red-500",
};

const riskAccent = {
  LOW: "#10b981",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
};

const highlightStyles = {
  emotional_language: "bg-rose-100 text-rose-950 ring-rose-200",
  all_caps: "bg-violet-100 text-violet-950 ring-violet-200",
  excessive_punctuation: "bg-amber-100 text-amber-950 ring-amber-200",
  clickbait: "bg-orange-100 text-orange-950 ring-orange-200",
};

const explanationLabels = {
  emotional_language: "Emotional language",
  all_caps: "All caps",
  excessive_punctuation: "Excessive punctuation",
  missing_sources: "Missing sources",
  clickbait: "Clickbait pattern",
  no_risk_signals: "No obvious rule signals",
};

const explanationFallbacks = {
  reason: "This signal can affect how readers interpret the credibility of the text.",
  impact: "Readers may need more context before treating the claim as reliable.",
};

const breakdownLabels = {
  language_score: "Language",
  structure_score: "Structure",
  source_score: "Sources",
};

const featureHighlights = [
  "Credibility scoring",
  "Explainable signals",
  "Neutral rewrite",
  "Shareable report",
];

function getRouteReportId() {
  const match = window.location.pathname.match(/^\/report\/([^/]+)/);
  return match?.[1] || "";
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory(items) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
}

function getImprovement(result) {
  return (
    result.improvement || {
      before_score: result.credibility_score || 0,
      after_score: result.credibility_score || 0,
      change: `${result.risk_level || "MEDIUM"} -> ${result.risk_level || "MEDIUM"}`,
    }
  );
}

function normalizeResult(result) {
  const riskLevel = result.risk_level || "MEDIUM";
  const credibilityScore = result.credibility_score ?? 0;

  const normalized = {
    ...result,
    report_id: result.report_id || "local",
    credibility_score: credibilityScore,
    risk_level: riskLevel,
    model_confidence: result.model_confidence ?? result.confidence ?? 0,
    explanation: (result.explanation || []).map((item) => ({
      ...item,
      reason: item.reason || explanationFallbacks.reason,
      impact: item.impact || explanationFallbacks.impact,
    })),
    breakdown: {
      language_score: 0,
      structure_score: 0,
      source_score: 0,
      source_note: "Source verification information is unavailable for this saved result.",
      ...(result.breakdown || {}),
    },
    suggested_rewrite: result.suggested_rewrite || result.analyzed_text || "",
    suggestions: result.suggestions || [],
    uncertainty_note: result.uncertainty_note || DEFAULT_UNCERTAINTY_NOTE,
    processing_time_ms: result.processing_time_ms ?? 0,
    analyzed_text: result.analyzed_text || "",
    source_type: result.source_type || "text",
    source_url: result.source_url || "",
  };

  normalized.improvement = getImprovement(normalized);
  return normalized;
}

function makeHistoryItem(result) {
  const normalized = normalizeResult(result);

  return {
    report_id: normalized.report_id,
    risk_level: normalized.risk_level,
    credibility_score: normalized.credibility_score,
    source_type: normalized.source_type,
    source_url: normalized.source_url,
    preview: normalized.source_url || normalized.analyzed_text.slice(0, 96),
    created_at: new Date().toISOString(),
    result: normalized,
  };
}

function getHighlightRanges(text, explanation) {
  const ranges = [];

  explanation.forEach((item) => {
    if (item.type === "missing_sources" || item.type === "no_risk_signals") {
      return;
    }

    const needle = item.text.trim();
    if (!needle) {
      return;
    }

    const lowerText = text.toLowerCase();
    const lowerNeedle = needle.toLowerCase();
    let cursor = 0;

    while (cursor < text.length) {
      const index = lowerText.indexOf(lowerNeedle, cursor);
      if (index === -1) {
        break;
      }

      ranges.push({ start: index, end: index + needle.length, type: item.type });
      cursor = index + needle.length;
    }
  });

  return ranges
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .reduce((cleanRanges, range) => {
      const previous = cleanRanges[cleanRanges.length - 1];
      if (!previous || range.start >= previous.end) {
        cleanRanges.push(range);
      }
      return cleanRanges;
    }, []);
}

function HighlightedText({ text, explanation }) {
  const ranges = useMemo(
    () => getHighlightRanges(text, explanation),
    [text, explanation],
  );

  if (!text) {
    return null;
  }

  if (!ranges.length) {
    return <p>{text}</p>;
  }

  const parts = [];
  let cursor = 0;

  ranges.forEach((range, index) => {
    if (range.start > cursor) {
      parts.push(text.slice(cursor, range.start));
    }

    parts.push(
      <mark
        key={`${range.start}-${range.end}-${index}`}
        className={`rounded px-1 ring-1 ${
          highlightStyles[range.type] || "bg-sky-100 text-sky-950 ring-sky-200"
        }`}
        title={explanationLabels[range.type] || range.type}
      >
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  });

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <p>{parts}</p>;
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
  );
}

function LandingHero({ onTryDemo, isLoading }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
            AI Trust Engine
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-slate-950 lg:text-5xl">
            Credibility analysis that users can understand and act on.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Paste a claim or article URL to get a risk score, highlighted credibility
            signals, a neutral rewrite, and a shareable report for review.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {featureHighlights.map((feature) => (
              <span
                key={feature}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700"
              >
                {feature}
              </span>
            ))}
          </div>

          <button
            type="button"
            className="mt-7 inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            onClick={onTryDemo}
            disabled={isLoading}
          >
            {isLoading && <Spinner />}
            Try Demo
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-700">Demo flow</p>
          <div className="mt-4 space-y-3">
            {[
              "1. Detect risky language patterns",
              "2. Explain why they matter",
              "3. Compare original vs neutral rewrite",
              "4. Copy a report link for sharing",
            ].map((step) => (
              <div
                key={step}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function UncertaintyNotice({ note }) {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
      <p className="font-semibold">Responsible use note</p>
      <p className="mt-1">{note || DEFAULT_UNCERTAINTY_NOTE}</p>
    </section>
  );
}

function LoadingPanel() {
  return (
    <section className="rounded-lg border border-sky-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-slate-900">Analyzing content...</p>
          <p className="mt-1 text-sm text-slate-500">
            Scoring language, structure, source signals, and rewrite quality.
          </p>
        </div>
        <span className="h-10 w-10 rounded-full border-4 border-sky-100 border-t-sky-700 animate-spin" />
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-sky-600" />
      </div>
    </section>
  );
}

function FriendlyError({ message, onRetry, canRetry }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-semibold">Analysis could not be completed</p>
      <p className="mt-1">{message}</p>
      {canRetry && (
        <button
          type="button"
          className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 font-medium text-red-700 transition hover:bg-red-100"
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </section>
  );
}

function InputPanel({
  mode,
  setMode,
  text,
  setText,
  url,
  setUrl,
  isLoading,
  onAnalyze,
  onTryDemo,
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-md border border-slate-200 bg-slate-50 p-1">
          {["text", "url"].map((inputMode) => (
            <button
              key={inputMode}
              type="button"
              onClick={() => setMode(inputMode)}
              className={`rounded px-3 py-1.5 text-sm font-medium capitalize transition ${
                mode === inputMode
                  ? "bg-white text-sky-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {inputMode}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="w-fit rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-800 disabled:cursor-not-allowed disabled:text-slate-400"
          onClick={onTryDemo}
          disabled={isLoading}
        >
          Try Demo
        </button>
      </div>

      {mode === "text" ? (
        <div className="mt-4">
          <label htmlFor="newsText" className="text-sm font-medium text-slate-700">
            News or claim text
          </label>
          <textarea
            id="newsText"
            className="mt-2 min-h-48 w-full resize-y rounded-md border border-slate-300 bg-white p-3 text-base outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="Paste a headline, claim, or short news article..."
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
      ) : (
        <div className="mt-4">
          <label htmlFor="articleUrl" className="text-sm font-medium text-slate-700">
            Article URL
          </label>
          <input
            id="articleUrl"
            type="url"
            className="mt-2 w-full rounded-md border border-slate-300 bg-white p-3 text-base outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="https://example.com/news/article"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </div>
      )}

      <button
        type="button"
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-sky-700 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        onClick={onAnalyze}
        disabled={isLoading}
      >
        {isLoading && <Spinner />}
        {isLoading ? "Analyzing content..." : "Analyze"}
      </button>
    </section>
  );
}

function ScoreCircle({ score, riskLevel }) {
  const percent = Math.round(score * 100);
  const color = riskAccent[riskLevel] || riskAccent.MEDIUM;

  return (
    <div
      className="grid h-36 w-36 place-items-center rounded-full transition-all duration-700"
      style={{
        background: `conic-gradient(${color} ${percent * 3.6}deg, #e2e8f0 0deg)`,
      }}
      title="Credibility score combines model output with language, structure, and source-related signals. It is not a factual verdict."
    >
      <div className="grid h-28 w-28 place-items-center rounded-full bg-white shadow-inner">
        <div className="text-center">
          <p className="text-3xl font-bold text-slate-950">{percent}%</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Score
          </p>
        </div>
      </div>
    </div>
  );
}

function ScoreSummary({ result }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <ScoreCircle score={result.credibility_score} riskLevel={result.risk_level} />
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Score Summary
            </p>
            <span
              className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${
                riskStyles[result.risk_level] || riskStyles.MEDIUM
              }`}
            >
              {result.risk_level} RISK
            </span>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              The score reflects language and credibility signals. It should guide
              review, not replace fact-checking.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:w-72">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Model confidence
            </p>
            <p
              className="mt-1 text-2xl font-bold text-slate-950"
              title="This reflects model certainty, not factual correctness."
            >
              {(result.model_confidence * 100).toFixed(1)}%
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Processing
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-950">
              {result.processing_time_ms}ms
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            riskBarStyles[result.risk_level] || riskBarStyles.MEDIUM
          }`}
          style={{ width: `${Math.max(result.credibility_score * 100, 4)}%` }}
        />
      </div>
    </section>
  );
}

function Breakdown({ breakdown }) {
  const scoreKeys = ["language_score", "structure_score", "source_score"];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Breakdown
      </h2>

      <div className="mt-4 space-y-4">
        {scoreKeys.map((key) => (
          <div key={key}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">
                {breakdownLabels[key] || key}
              </span>
              <span className="text-slate-500">{breakdown[key]}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-sky-600 transition-all duration-700"
                style={{ width: `${breakdown[key]}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {breakdown.source_note && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {breakdown.source_note}
        </p>
      )}
    </section>
  );
}

function RewriteSuggestion({ result }) {
  const improvement = result.improvement;
  const improved = improvement.after_score > improvement.before_score;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Before vs After
      </h2>

      <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
        {improved ? "Credibility improved" : "Credibility changed"} from{" "}
        {improvement.change.replace("->", "to")}.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">Original text</p>
          <p className="mt-2 max-h-72 overflow-auto text-sm leading-6 text-slate-700">
            {result.analyzed_text}
          </p>
        </div>

        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">Neutral rewrite</p>
          <p className="mt-2 max-h-72 overflow-auto text-sm leading-6 text-slate-800">
            {result.suggested_rewrite}
          </p>
        </div>
      </div>
    </section>
  );
}

function Explanation({ result }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Highlighted Explanation
      </h2>

      <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-700">Analyzed text</h3>
        <div className="mt-3 max-h-80 overflow-auto text-sm leading-7 text-slate-700">
          <HighlightedText text={result.analyzed_text} explanation={result.explanation} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {result.explanation.map((item, index) => (
          <article
            key={`${item.type}-${item.text}-${index}`}
            className="rounded-md border border-slate-200 p-3 transition hover:border-sky-200 hover:bg-sky-50"
          >
            <p className="text-sm font-semibold text-slate-900">
              {explanationLabels[item.type] || item.type}
            </p>
            <p className="mt-1 text-sm text-slate-700">{item.text}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{item.reason}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Why this matters
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{item.impact}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActionTips({ suggestions }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Action Tips
      </h2>
      <ul className="mt-4 space-y-2">
        {suggestions.map((suggestion) => (
          <li
            key={suggestion}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            {suggestion}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ShareCard({ reportUrl, onCopy, copyStatus }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Share Report
      </h2>
      <p className="mt-3 break-all rounded-md bg-slate-50 p-3 text-sm text-sky-800">
        {reportUrl}
      </p>
      <button
        type="button"
        className="mt-3 w-full rounded-md bg-slate-950 px-4 py-2 font-semibold text-white transition hover:bg-slate-800"
        onClick={onCopy}
      >
        Copy Report Link
      </button>
      {copyStatus && (
        <p className="mt-2 text-sm font-medium text-emerald-700">{copyStatus}</p>
      )}
    </section>
  );
}

function App() {
  const [mode, setMode] = useState("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState(loadHistory);
  const [lastPayload, setLastPayload] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");

  const reportUrl = result
    ? `${window.location.origin}/report/${result.report_id}`
    : "";

  useEffect(() => {
    const reportId = getRouteReportId();
    if (reportId) {
      loadReport(reportId, { updatePath: false });
    }

    function handlePopState() {
      const nextReportId = getRouteReportId();
      if (nextReportId) {
        loadReport(nextReportId, { updatePath: false });
      } else {
        setResult(null);
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function applyResult(nextResult) {
    const normalized = normalizeResult(nextResult);

    setResult(normalized);
    setMode(normalized.source_type || "text");
    setText(normalized.analyzed_text || "");
    setUrl(normalized.source_url || "");
  }

  function addToHistory(nextResult) {
    const normalized = normalizeResult(nextResult);
    const nextHistory = [
      makeHistoryItem(normalized),
      ...history.filter((item) => item.report_id !== normalized.report_id),
    ].slice(0, MAX_HISTORY_ITEMS);

    setHistory(nextHistory);
    saveHistory(nextHistory);
  }

  function loadHistoryItem(item) {
    setCopyStatus("");

    if (item.result) {
      applyResult(item.result);
      window.history.pushState({}, "", `/report/${item.report_id}`);
      return;
    }

    loadReport(item.report_id);
  }

  async function loadReport(reportId, options = { updatePath: true }) {
    setError("");
    setCopyStatus("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/report/${reportId}`);
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Report not found.");
      }

      applyResult(payload);

      if (options.updatePath) {
        window.history.pushState({}, "", `/report/${payload.report_id}`);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function analyzePayload(payload) {
    setError("");
    setResult(null);
    setCopyStatus("");
    setLastPayload(payload);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const nextResult = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(nextResult?.error || "Analysis request failed.");
      }

      applyResult(nextResult);
      addToHistory(nextResult);
      window.history.pushState({}, "", `/report/${nextResult.report_id}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleAnalyze() {
    const payload =
      mode === "url"
        ? { url: url.trim() }
        : { text: text.trim() };

    if (mode === "url" && !payload.url) {
      setError("Please enter a URL to analyze.");
      return;
    }

    if (mode === "text" && !payload.text) {
      setError("Please enter text to analyze.");
      return;
    }

    analyzePayload(payload);
  }

  function handleTryDemo() {
    setMode("text");
    setText(DEMO_TEXT);
    setUrl("");
    analyzePayload({ text: DEMO_TEXT });
  }

  function handleRetry() {
    if (lastPayload) {
      analyzePayload(lastPayload);
    }
  }

  async function copyReportUrl() {
    if (!reportUrl) {
      return;
    }

    await navigator.clipboard.writeText(reportUrl);
    setCopyStatus("Report link copied.");
    window.setTimeout(() => setCopyStatus(""), 2500);
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:py-6">
        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:h-fit">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Saved analyses
            </h2>
            <span className="text-xs text-slate-400">{history.length}/10</span>
          </div>

          <div className="mt-4 space-y-2">
            {history.length === 0 && (
              <p className="text-sm text-slate-500">
                Saved comparisons will appear here after your first analysis.
              </p>
            )}

            {history.map((item) => (
              <button
                key={item.report_id}
                type="button"
                onClick={() => loadHistoryItem(item)}
                className="w-full rounded-md border border-slate-200 p-3 text-left transition hover:border-sky-300 hover:bg-sky-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                      riskStyles[item.risk_level] || riskStyles.MEDIUM
                    }`}
                  >
                    {item.risk_level}
                  </span>
                  <span className="text-xs text-slate-500">
                    {(item.credibility_score * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-700">
                  {item.preview}
                </p>
                <p className="mt-2 text-xs font-medium text-sky-700">
                  View comparison
                </p>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-col gap-5">
          <LandingHero onTryDemo={handleTryDemo} isLoading={isLoading} />
          <UncertaintyNotice note={DEFAULT_UNCERTAINTY_NOTE} />
          <InputPanel
            mode={mode}
            setMode={setMode}
            text={text}
            setText={setText}
            url={url}
            setUrl={setUrl}
            isLoading={isLoading}
            onAnalyze={handleAnalyze}
            onTryDemo={handleTryDemo}
          />

          {error && (
            <FriendlyError
              message={error}
              onRetry={handleRetry}
              canRetry={Boolean(lastPayload)}
            />
          )}

          {isLoading && <LoadingPanel />}

          {result && !isLoading && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-5">
                <ScoreSummary result={result} />
                <Breakdown breakdown={result.breakdown} />
                <Explanation result={result} />
                <RewriteSuggestion result={result} />
              </div>

              <div className="space-y-5">
                <ActionTips suggestions={result.suggestions} />
                <ShareCard
                  reportUrl={reportUrl}
                  onCopy={copyReportUrl}
                  copyStatus={copyStatus}
                />
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
