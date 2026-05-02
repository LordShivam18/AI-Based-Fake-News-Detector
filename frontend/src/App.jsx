import { useState } from "react";

const API_URL = "http://localhost:8000/analyze";

const riskStyles = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  HIGH: "bg-red-100 text-red-800 border-red-200",
};

function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleAnalyze() {
    setError("");
    setResult(null);

    if (!text.trim()) {
      setError("Please enter text to analyze.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Analysis request failed.");
      }

      setResult(await response.json());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
            Phase 1 MVP
          </p>
          <h1 className="mt-2 text-3xl font-bold">AI Trust Engine</h1>
          <p className="mt-2 text-slate-600">
            Analyze news text for credibility risk and simple explainability signals.
          </p>
        </header>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <label htmlFor="newsText" className="text-sm font-medium text-slate-700">
            News or claim text
          </label>
          <textarea
            id="newsText"
            className="mt-2 min-h-48 w-full resize-y rounded-md border border-slate-300 p-3 text-base outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="Paste a headline, claim, or short news article..."
            value={text}
            onChange={(event) => setText(event.target.value)}
          />

          <button
            type="button"
            className="mt-4 rounded-md bg-sky-700 px-4 py-2 font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            onClick={handleAnalyze}
            disabled={isLoading}
          >
            {isLoading ? "Analyzing..." : "Analyze"}
          </button>

          {error && (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        {result && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-sm text-slate-500">Credibility score</p>
                <p className="text-3xl font-bold">
                  {(result.credibility_score * 100).toFixed(1)}%
                </p>
              </div>

              <span
                className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                  riskStyles[result.risk_level] || riskStyles.MEDIUM
                }`}
              >
                {result.risk_level} RISK
              </span>
            </div>

            <div className="mt-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Explanation
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
                {result.explanation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
