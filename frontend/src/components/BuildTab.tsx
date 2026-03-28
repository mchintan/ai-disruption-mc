import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp, Loader2, Trash2, Plus, TrendingUp, Shield } from "lucide-react";
import { analyzePortfolio } from "../api";
import { track } from "../telemetry";
import type { AssetParams } from "../types/portfolio";

interface Props {
  assets: AssetParams[];
  correlationMatrix: number[][];
  description: string;
  riskTolerance: string;
  onPortfolioChange: (assets: AssetParams[], correlationMatrix: number[][], description?: string, riskTolerance?: string) => void;
  isLoading: boolean;
}

const EXAMPLES = [
  "I want a tech-heavy growth portfolio with AI exposure, hedged against inflation. 10-year horizon, moderate risk.",
  "Conservative retirement portfolio focused on income and capital preservation. Low volatility, 5-year horizon.",
  "Aggressive crypto and emerging tech portfolio. High risk tolerance, maximum growth over 15 years.",
  "Balanced portfolio with real estate, gold, and equities. Moderate risk, 10 years.",
];

const ASSET_COLORS = [
  { text: "text-teal-700 dark:text-cyan-400", border: "border-teal-300 dark:border-cyan-500/30", bg: "bg-teal-500 dark:bg-cyan-500" },
  { text: "text-violet-700 dark:text-violet-400", border: "border-violet-300 dark:border-violet-500/30", bg: "bg-violet-500" },
  { text: "text-amber-700 dark:text-amber-400", border: "border-amber-300 dark:border-amber-500/30", bg: "bg-amber-500" },
  { text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-300 dark:border-emerald-500/30", bg: "bg-emerald-500" },
  { text: "text-pink-700 dark:text-pink-400", border: "border-pink-300 dark:border-pink-500/30", bg: "bg-pink-500" },
  { text: "text-blue-700 dark:text-blue-400", border: "border-blue-300 dark:border-blue-500/30", bg: "bg-blue-500" },
  { text: "text-orange-700 dark:text-orange-400", border: "border-orange-300 dark:border-orange-500/30", bg: "bg-orange-500" },
  { text: "text-cyan-700 dark:text-teal-400", border: "border-cyan-300 dark:border-teal-500/30", bg: "bg-cyan-500 dark:bg-teal-500" },
];

export function BuildTab({ assets, correlationMatrix, description, riskTolerance, onPortfolioChange, isLoading }: Props) {
  const [aiSeedOpen, setAiSeedOpen] = useState(assets.length === 0);
  const [localDesc, setLocalDesc] = useState(description);
  const [localRisk, setLocalRisk] = useState(riskTolerance || "moderate");
  const [horizonYears, setHorizonYears] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);

  // Local copy of assets for editing
  const [localAssets, setLocalAssets] = useState<AssetParams[]>(assets);
  const [localCorrelation, setLocalCorrelation] = useState<number[][]>(correlationMatrix);

  // Sync if parent assets change (e.g. optimized weights applied)
  // Using a simple key check — if the parent assets differ from local, reset
  const parentKey = assets.map(a => `${a.ticker}:${a.allocation_pct}`).join(",");
  const localKey = localAssets.map(a => `${a.ticker}:${a.allocation_pct}`).join(",");
  if (parentKey !== localKey && parentKey !== "" && !generating) {
    setLocalAssets(assets);
    setLocalCorrelation(correlationMatrix);
  }

  const handleGenerate = async () => {
    if (localDesc.trim().length < 10) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await analyzePortfolio({ description: localDesc, risk_tolerance: localRisk, horizon_years: horizonYears });
      setLocalAssets(result.assets);
      setLocalCorrelation(result.correlation_matrix);
      setAnalysisSummary(result.analysis_summary);
      onPortfolioChange(result.assets, result.correlation_matrix, localDesc, localRisk);
      setAiSeedOpen(false);
      track("ai_portfolio_generated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setGenerating(false);
    }
  };

  const updateAsset = (index: number, field: keyof AssetParams, value: string | number) => {
    const updated = [...localAssets];
    updated[index] = { ...updated[index], [field]: value };
    setLocalAssets(updated);
    onPortfolioChange(updated, localCorrelation);
  };

  const removeAsset = (index: number) => {
    const updated = localAssets.filter((_, i) => i !== index);
    const newCorr = localCorrelation
      .filter((_, i) => i !== index)
      .map(row => row.filter((_, j) => j !== index));
    setLocalAssets(updated);
    setLocalCorrelation(newCorr);
    onPortfolioChange(updated, newCorr);
  };

  const addAsset = () => {
    const newAsset: AssetParams = {
      ticker: "NEW",
      name: "New Asset",
      allocation_pct: 0,
      drift: 0.08,
      volatility: 0.20,
      jump_intensity: 0.5,
      jump_mean: -0.05,
      jump_vol: 0.10,
      rationale: "User-added asset",
    };
    const updated = [...localAssets, newAsset];
    const n = localCorrelation.length;
    const newCorr = localCorrelation.map(row => [...row, 0.1]);
    newCorr.push([...Array(n).fill(0.1), 1.0]);
    setLocalAssets(updated);
    setLocalCorrelation(newCorr);
    onPortfolioChange(updated, newCorr);
  };

  const totalAllocation = localAssets.reduce((sum, a) => sum + a.allocation_pct, 0);

  return (
    <div className="max-w-5xl mx-auto">
      {/* AI Seed Section */}
      <div className="bg-white dark:bg-slate-900/50 border border-stone-200 dark:border-slate-700/30 rounded-xl mb-6">
        <button
          onClick={() => setAiSeedOpen(!aiSeedOpen)}
          className="w-full flex items-center justify-between px-5 py-4"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-600 dark:text-cyan-400" />
            <span className="text-sm font-mono font-semibold text-teal-600 dark:text-cyan-400">
              AI Portfolio Generator
            </span>
            {localAssets.length > 0 && (
              <span className="text-xs text-stone-400 dark:text-slate-500 ml-2">
                (portfolio seeded)
              </span>
            )}
          </div>
          {aiSeedOpen ? <ChevronUp className="w-4 h-4 text-stone-400 dark:text-slate-500" /> : <ChevronDown className="w-4 h-4 text-stone-400 dark:text-slate-500" />}
        </button>

        {aiSeedOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-stone-100 dark:border-slate-800/50 pt-4">
            <p className="text-stone-500 dark:text-slate-400 text-sm">
              Describe your ideal portfolio in plain English. Our AI will recommend specific assets with calibrated simulation parameters.
            </p>

            <div>
              <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">
                Portfolio Description
              </label>
              <textarea
                value={localDesc}
                onChange={(e) => setLocalDesc(e.target.value)}
                placeholder="Describe your investment goals, preferences, and constraints..."
                className="w-full h-28 bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/50 rounded-xl px-4 py-3 text-stone-900 dark:text-slate-200 placeholder-stone-400 dark:placeholder-slate-600 focus:outline-none focus:border-teal-400 dark:focus:border-cyan-500/50 focus:ring-1 focus:ring-teal-400/20 dark:focus:ring-cyan-500/20 resize-none text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setLocalDesc(ex)}
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
                      onClick={() => setLocalRisk(level)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-mono font-semibold capitalize transition-all ${
                        localRisk === level
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

            {error && (
              <div className="bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating || isLoading || localDesc.trim().length < 10}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 dark:from-cyan-500 dark:to-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-teal-500 hover:to-teal-400 dark:hover:from-cyan-400 dark:hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing with AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate with AI
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Analysis Summary (if generated) */}
      {analysisSummary && (
        <div className="bg-white border border-stone-200 dark:bg-slate-800/30 dark:border-slate-700/30 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-teal-600 dark:text-cyan-400" />
            <h3 className="text-sm font-mono font-semibold text-teal-600 dark:text-cyan-400">First Principles Analysis</h3>
          </div>
          <p className="text-sm text-stone-700 dark:text-slate-300 leading-relaxed">
            {analysisSummary}
          </p>
        </div>
      )}

      {/* Asset Editor */}
      {localAssets.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h3 className="text-sm font-mono font-semibold text-violet-600 dark:text-violet-400">Portfolio Assets</h3>
          </div>

          {/* Allocation bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-stone-500 dark:text-slate-500">Total Allocation</span>
              <span className={`text-xs font-mono font-bold ${Math.abs(totalAllocation - 100) < 0.5 ? "text-green-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {totalAllocation.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-stone-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              {localAssets.map((asset, i) => (
                <div
                  key={i}
                  className={`${ASSET_COLORS[i % ASSET_COLORS.length].bg} h-full transition-all`}
                  style={{ width: `${asset.allocation_pct}%` }}
                />
              ))}
            </div>
          </div>

          {/* Asset Cards */}
          <div className="space-y-3 mb-6">
            {localAssets.map((asset, i) => {
              const color = ASSET_COLORS[i % ASSET_COLORS.length];
              return (
                <div key={i} className={`bg-white dark:bg-slate-900/50 border ${color.border} rounded-xl p-4`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={asset.ticker}
                        onChange={(e) => updateAsset(i, "ticker", e.target.value.toUpperCase())}
                        className={`bg-transparent border-none text-lg font-mono font-bold ${color.text} focus:outline-none w-24`}
                      />
                      <input
                        type="text"
                        value={asset.name}
                        onChange={(e) => updateAsset(i, "name", e.target.value)}
                        className="bg-transparent border-none text-stone-600 dark:text-slate-300 text-sm focus:outline-none"
                      />
                    </div>
                    <button onClick={() => removeAsset(i)} className="text-stone-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-stone-400 dark:text-slate-600 font-mono mb-1">Allocation %</label>
                      <input type="number" value={asset.allocation_pct} onChange={(e) => updateAsset(i, "allocation_pct", Number(e.target.value))} min={0} max={100} step={1} className="w-full bg-stone-50 border border-stone-200 dark:bg-slate-800/50 dark:border-slate-700/50 rounded-lg px-3 py-1.5 text-sm text-stone-900 dark:text-slate-200 font-mono focus:outline-none focus:border-teal-400 dark:focus:border-cyan-500/50" />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-400 dark:text-slate-600 font-mono mb-1">Drift (&mu;)</label>
                      <input type="number" value={asset.drift} onChange={(e) => updateAsset(i, "drift", Number(e.target.value))} step={0.01} className="w-full bg-stone-50 border border-stone-200 dark:bg-slate-800/50 dark:border-slate-700/50 rounded-lg px-3 py-1.5 text-sm text-stone-900 dark:text-slate-200 font-mono focus:outline-none focus:border-teal-400 dark:focus:border-cyan-500/50" />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-400 dark:text-slate-600 font-mono mb-1">Volatility (&sigma;)</label>
                      <input type="number" value={asset.volatility} onChange={(e) => updateAsset(i, "volatility", Number(e.target.value))} step={0.01} min={0.01} className="w-full bg-stone-50 border border-stone-200 dark:bg-slate-800/50 dark:border-slate-700/50 rounded-lg px-3 py-1.5 text-sm text-stone-900 dark:text-slate-200 font-mono focus:outline-none focus:border-teal-400 dark:focus:border-cyan-500/50" />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-400 dark:text-slate-600 font-mono mb-1">Jump &lambda;</label>
                      <input type="number" value={asset.jump_intensity} onChange={(e) => updateAsset(i, "jump_intensity", Number(e.target.value))} step={0.1} min={0} className="w-full bg-stone-50 border border-stone-200 dark:bg-slate-800/50 dark:border-slate-700/50 rounded-lg px-3 py-1.5 text-sm text-stone-900 dark:text-slate-200 font-mono focus:outline-none focus:border-teal-400 dark:focus:border-cyan-500/50" />
                    </div>
                  </div>

                  <p className="text-xs text-stone-400 dark:text-slate-500 italic">{asset.rationale}</p>
                </div>
              );
            })}
          </div>

          <button
            onClick={addAsset}
            className="w-full py-2.5 rounded-xl border border-dashed border-stone-300 dark:border-slate-700/50 text-stone-400 dark:text-slate-500 hover:text-teal-600 hover:border-teal-300 dark:hover:text-cyan-400 dark:hover:border-cyan-500/30 transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Asset
          </button>
        </>
      )}

      {localAssets.length === 0 && !aiSeedOpen && (
        <div className="text-center py-16 text-stone-400 dark:text-slate-500">
          <TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No assets yet. Use the AI generator above to seed your portfolio.</p>
        </div>
      )}
    </div>
  );
}
