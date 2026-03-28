import { useState } from "react";
import { ArrowRight, ArrowLeft, TrendingUp, Shield, Zap, Trash2, Plus } from "lucide-react";
import type { AssetParams, AnalyzeResponse } from "../types/portfolio";

interface Props {
  analysis: AnalyzeResponse;
  onConfirm: (assets: AssetParams[], correlationMatrix: number[][]) => void;
  onBack: () => void;
}

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

export function AnalysisReview({ analysis, onConfirm, onBack }: Props) {
  const [assets, setAssets] = useState<AssetParams[]>(analysis.assets);
  const [correlationMatrix, setCorrelationMatrix] = useState<number[][]>(analysis.correlation_matrix);

  const updateAsset = (index: number, field: keyof AssetParams, value: string | number) => {
    const updated = [...assets];
    updated[index] = { ...updated[index], [field]: value };
    setAssets(updated);
  };

  const removeAsset = (index: number) => {
    const updated = assets.filter((_, i) => i !== index);
    setAssets(updated);
    const newCorr = correlationMatrix
      .filter((_, i) => i !== index)
      .map(row => row.filter((_, j) => j !== index));
    setCorrelationMatrix(newCorr);
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
    setAssets([...assets, newAsset]);
    const n = correlationMatrix.length;
    const newCorr = correlationMatrix.map(row => [...row, 0.1]);
    newCorr.push([...Array(n).fill(0.1), 1.0]);
    setCorrelationMatrix(newCorr);
  };

  const totalAllocation = assets.reduce((sum, a) => sum + a.allocation_pct, 0);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-50 border border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/20 mb-6">
          <TrendingUp className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400 tracking-wide">
            STEP 2 — REVIEW AI ANALYSIS
          </span>
        </div>
        <h2 className="text-2xl font-bold text-stone-900 dark:text-slate-100 mb-3">
          AI Portfolio Recommendation
        </h2>
        <p className="text-stone-500 dark:text-slate-400 text-sm max-w-xl mx-auto">
          Review and adjust the recommended assets, allocations, and parameters before simulation.
        </p>
      </div>

      {/* Analysis Summary */}
      <div className="bg-white border border-stone-200 dark:bg-slate-800/30 dark:border-slate-700/30 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-teal-600 dark:text-cyan-400" />
          <h3 className="text-sm font-mono font-semibold text-teal-600 dark:text-cyan-400">First Principles Analysis</h3>
        </div>
        <p className="text-sm text-stone-700 dark:text-slate-300 leading-relaxed">
          {analysis.analysis_summary}
        </p>
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
          {assets.map((asset, i) => (
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
        {assets.map((asset, i) => {
          const color = ASSET_COLORS[i % ASSET_COLORS.length];
          return (
            <div key={i} className={`bg-white dark:bg-slate-900/50 border ${color.border} rounded-xl p-4`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-mono font-bold ${color.text}`}>
                    {asset.ticker}
                  </span>
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
                  <label className="block text-xs text-stone-400 dark:text-slate-600 font-mono mb-1">Drift (&#956;)</label>
                  <input type="number" value={asset.drift} onChange={(e) => updateAsset(i, "drift", Number(e.target.value))} step={0.01} className="w-full bg-stone-50 border border-stone-200 dark:bg-slate-800/50 dark:border-slate-700/50 rounded-lg px-3 py-1.5 text-sm text-stone-900 dark:text-slate-200 font-mono focus:outline-none focus:border-teal-400 dark:focus:border-cyan-500/50" />
                </div>
                <div>
                  <label className="block text-xs text-stone-400 dark:text-slate-600 font-mono mb-1">Volatility (&#963;)</label>
                  <input type="number" value={asset.volatility} onChange={(e) => updateAsset(i, "volatility", Number(e.target.value))} step={0.01} min={0.01} className="w-full bg-stone-50 border border-stone-200 dark:bg-slate-800/50 dark:border-slate-700/50 rounded-lg px-3 py-1.5 text-sm text-stone-900 dark:text-slate-200 font-mono focus:outline-none focus:border-teal-400 dark:focus:border-cyan-500/50" />
                </div>
                <div>
                  <label className="block text-xs text-stone-400 dark:text-slate-600 font-mono mb-1">Jump &#955;</label>
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
        className="w-full py-2.5 rounded-xl border border-dashed border-stone-300 dark:border-slate-700/50 text-stone-400 dark:text-slate-500 hover:text-teal-600 hover:border-teal-300 dark:hover:text-cyan-400 dark:hover:border-cyan-500/30 transition-colors text-sm flex items-center justify-center gap-2 mb-6"
      >
        <Plus className="w-4 h-4" />
        Add Asset
      </button>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-stone-200 text-stone-500 hover:text-stone-700 dark:border-slate-700/50 dark:text-slate-400 dark:hover:text-slate-200 transition-colors text-sm flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={() => onConfirm(assets, correlationMatrix)}
          disabled={Math.abs(totalAllocation - 100) > 1}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-500 dark:to-purple-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-violet-500 hover:to-purple-500 dark:hover:from-violet-400 dark:hover:to-purple-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <Zap className="w-4 h-4" />
          Configure Simulation
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
