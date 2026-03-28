import { useState } from "react";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";

interface Props {
  onSubmit: (description: string, riskTolerance: string, horizonYears: number) => void;
  isLoading: boolean;
}

const EXAMPLES = [
  "I want a tech-heavy growth portfolio with AI exposure, hedged against inflation. 10-year horizon, moderate risk.",
  "Conservative retirement portfolio focused on income and capital preservation. Low volatility, 5-year horizon.",
  "Aggressive crypto and emerging tech portfolio. High risk tolerance, maximum growth over 15 years.",
  "Balanced portfolio with real estate, gold, and equities. Moderate risk, 10 years.",
];

export function PortfolioDescriber({ onSubmit, isLoading }: Props) {
  const [description, setDescription] = useState("");
  const [riskTolerance, setRiskTolerance] = useState("moderate");
  const [horizonYears, setHorizonYears] = useState(10);

  const handleSubmit = () => {
    if (description.trim().length < 10) return;
    onSubmit(description, riskTolerance, horizonYears);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-200 dark:bg-cyan-500/10 dark:border-cyan-500/20 mb-6">
          <Sparkles className="w-4 h-4 text-teal-600 dark:text-cyan-400" />
          <span className="text-xs font-mono font-semibold text-teal-600 dark:text-cyan-400 tracking-wide">
            STEP 1 — DESCRIBE YOUR PORTFOLIO
          </span>
        </div>
        <h2 className="text-3xl font-bold text-stone-900 dark:text-slate-100 mb-3">
          What do you want to build?
        </h2>
        <p className="text-stone-500 dark:text-slate-400 text-sm max-w-lg mx-auto">
          Describe your ideal portfolio in plain English. Our AI will analyze your goals
          and recommend specific assets with calibrated simulation parameters.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">
            Portfolio Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your investment goals, preferences, and constraints..."
            className="w-full h-32 bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/50 rounded-xl px-4 py-3 text-stone-900 dark:text-slate-200 placeholder-stone-400 dark:placeholder-slate-600 focus:outline-none focus:border-teal-400 dark:focus:border-cyan-500/50 focus:ring-1 focus:ring-teal-400/20 dark:focus:ring-cyan-500/20 resize-none text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => setDescription(ex)}
              className="text-xs px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-500 hover:text-teal-600 hover:border-teal-300 dark:bg-slate-800/50 dark:border-slate-700/30 dark:text-slate-400 dark:hover:text-cyan-400 dark:hover:border-cyan-500/30 transition-colors"
            >
              {ex.slice(0, 60)}...
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">
              Risk Tolerance
            </label>
            <div className="flex gap-2">
              {(["low", "moderate", "aggressive"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setRiskTolerance(level)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-mono font-semibold capitalize transition-all ${
                    riskTolerance === level
                      ? level === "low"
                        ? "bg-green-50 border border-green-200 text-green-700 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400"
                        : level === "moderate"
                        ? "bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400"
                        : "bg-red-50 border border-red-200 text-red-700 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-400"
                      : "bg-white border border-stone-200 text-stone-500 hover:text-stone-700 dark:bg-slate-800/50 dark:border-slate-700/30 dark:text-slate-500 dark:hover:text-slate-300"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">
              Investment Horizon: {horizonYears} years
            </label>
            <input
              type="range"
              min={1}
              max={30}
              value={horizonYears}
              onChange={(e) => setHorizonYears(Number(e.target.value))}
              className="w-full accent-teal-600 dark:accent-cyan-500 mt-2"
            />
            <div className="flex justify-between text-xs text-stone-400 dark:text-slate-600 font-mono mt-1">
              <span>1yr</span>
              <span>15yr</span>
              <span>30yr</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLoading || description.trim().length < 10}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 dark:from-cyan-500 dark:to-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-teal-500 hover:to-teal-400 dark:hover:from-cyan-400 dark:hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing with AI...
            </>
          ) : (
            <>
              Analyze Portfolio
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
