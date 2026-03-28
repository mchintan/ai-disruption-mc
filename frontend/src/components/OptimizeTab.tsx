import { useState } from "react";
import { Target, Loader2, Sparkles, BarChart3 } from "lucide-react";
import { optimizeWeights } from "../api";
import { track } from "../telemetry";
import type { AssetParams, SimConfig, SimulateResponse, OptimizeResponse, OptimizationObjective } from "../types/portfolio";

interface Props {
  assets: AssetParams[];
  correlationMatrix: number[][];
  lastSimulation: { config: SimConfig; result: SimulateResponse } | null;
  lastOptimization: OptimizeResponse | null;
  onOptimizationComplete: (result: OptimizeResponse) => void;
  onApplyWeights: () => void;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const ASSET_TEXT_COLORS = [
  "text-teal-700 dark:text-cyan-400",
  "text-violet-700 dark:text-violet-400",
  "text-amber-700 dark:text-amber-400",
  "text-emerald-700 dark:text-emerald-400",
  "text-pink-700 dark:text-pink-400",
  "text-blue-700 dark:text-blue-400",
  "text-orange-700 dark:text-orange-400",
  "text-cyan-700 dark:text-teal-400",
];

const OBJECTIVES: { value: OptimizationObjective; label: string; description: string }[] = [
  { value: "max_sharpe", label: "Max Sharpe", description: "Best risk-adjusted returns" },
  { value: "min_var", label: "Min VaR", description: "Minimize worst-case loss" },
  { value: "min_cvar", label: "Min CVaR", description: "Minimize expected tail loss" },
  { value: "min_max_drawdown", label: "Min Drawdown", description: "Minimize peak-to-trough decline" },
  { value: "max_return", label: "Max Return", description: "Maximize annualized return" },
];

export function OptimizeTab({ assets, correlationMatrix, lastSimulation, lastOptimization, onOptimizationComplete, onApplyWeights }: Props) {
  const [objective, setObjective] = useState<OptimizationObjective>("max_sharpe");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!lastSimulation) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16 text-stone-400 dark:text-slate-500">
        <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm mb-2">Run a simulation first to enable optimization.</p>
        <p className="text-xs">The optimizer needs simulation parameters (model, horizon, investment) to find optimal weights.</p>
      </div>
    );
  }

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setError(null);
    try {
      const config = lastSimulation.config;
      const res = await optimizeWeights({
        assets,
        correlation_matrix: correlationMatrix,
        num_simulations: config.numSimulations,
        num_years: config.numYears,
        model: config.model,
        initial_investment: config.initialInvestment,
        objective,
        seed: config.seed,
      });
      onOptimizationComplete(res);
      track("optimization_run", { objective });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Optimization failed");
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white border border-indigo-200 dark:bg-slate-900/50 dark:border-indigo-500/30 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-mono font-semibold text-indigo-600 dark:text-indigo-400">Optimize Portfolio Weights</h3>
        </div>

        <p className="text-xs text-stone-500 dark:text-slate-500 mb-4">
          Find optimal asset weights by running Monte Carlo optimization. Choose your objective and the optimizer will search for the best allocation.
        </p>

        <div className="mb-4">
          <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">Optimization Objective</label>
          <div className="grid grid-cols-5 gap-2">
            {OBJECTIVES.map((obj) => (
              <button key={obj.value} onClick={() => setObjective(obj.value)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  objective === obj.value
                    ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30"
                    : "bg-stone-50 border-stone-200 hover:border-stone-300 dark:bg-slate-800/30 dark:border-slate-700/30 dark:hover:border-slate-600/50"
                }`}>
                <div className={`text-xs font-semibold mb-0.5 ${objective === obj.value ? "text-indigo-600 dark:text-indigo-400" : "text-stone-600 dark:text-slate-300"}`}>{obj.label}</div>
                <div className="text-[10px] text-stone-400 dark:text-slate-500">{obj.description}</div>
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleOptimize} disabled={isOptimizing} className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          {isOptimizing ? (<><Loader2 className="w-4 h-4 animate-spin" />Optimizing weights (this may take 30-60s)...</>) : (<><Target className="w-4 h-4" />Optimize Weights</>)}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm mt-4">{error}</div>
        )}
      </div>

      {/* Results */}
      {lastOptimization && (
        <div className="space-y-4">
          <div className={`text-xs font-mono px-3 py-1.5 rounded-lg inline-block ${
            lastOptimization.converged
              ? "bg-green-50 text-green-700 border border-green-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
              : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
          }`}>
            {lastOptimization.converged ? "Optimization converged" : "Did not fully converge (results may still be useful)"}
          </div>

          {/* Weight Comparison Table */}
          <div className="bg-stone-50 border border-stone-200 dark:bg-slate-800/30 dark:border-slate-700/30 rounded-xl p-4">
            <h4 className="text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-3">Weight Comparison</h4>
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-stone-500 dark:text-slate-500 border-b border-stone-200 dark:border-slate-700/30">
                  <th className="text-left pb-2 pr-4">Asset</th>
                  <th className="text-right pb-2 pr-4">Original %</th>
                  <th className="text-right pb-2 pr-4">Optimal %</th>
                  <th className="text-right pb-2">Change</th>
                </tr>
              </thead>
              <tbody>
                {lastOptimization.weights.map((w, i) => {
                  const change = w.optimal_pct - w.original_pct;
                  return (
                    <tr key={i} className="border-b border-stone-100 dark:border-slate-800/50">
                      <td className={`py-2 pr-4 font-bold ${ASSET_TEXT_COLORS[i % ASSET_TEXT_COLORS.length]}`}>
                        {w.ticker}<span className="text-stone-400 dark:text-slate-600 font-normal ml-2">{w.name}</span>
                      </td>
                      <td className="text-right py-2 pr-4 text-stone-400 dark:text-slate-400">{w.original_pct.toFixed(1)}%</td>
                      <td className="text-right py-2 pr-4 text-stone-900 dark:text-slate-200 font-bold">{w.optimal_pct.toFixed(1)}%</td>
                      <td className={`text-right py-2 font-bold ${change > 0.5 ? "text-green-600 dark:text-emerald-400" : change < -0.5 ? "text-red-600 dark:text-red-400" : "text-stone-400 dark:text-slate-500"}`}>
                        {change > 0 ? "+" : ""}{change.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Metrics Comparison */}
          <div className="bg-stone-50 border border-stone-200 dark:bg-slate-800/30 dark:border-slate-700/30 rounded-xl p-4">
            <h4 className="text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-3">Metrics: Original vs Optimized</h4>
            <div className="grid grid-cols-3 gap-3">
              <MetricCompare label="Sharpe Ratio" original={lastOptimization.original_risk_metrics.sharpe_ratio} optimized={lastOptimization.optimized_risk_metrics.sharpe_ratio} format={(v) => v.toFixed(3)} higherIsBetter={true} />
              <MetricCompare label="Expected Return" original={lastOptimization.original_risk_metrics.expected_return} optimized={lastOptimization.optimized_risk_metrics.expected_return} format={(v) => formatPct(v)} higherIsBetter={true} />
              <MetricCompare label="Volatility" original={lastOptimization.original_risk_metrics.volatility} optimized={lastOptimization.optimized_risk_metrics.volatility} format={(v) => formatPct(v)} higherIsBetter={false} />
              <MetricCompare label="VaR (95%)" original={lastOptimization.original_risk_metrics.var_95} optimized={lastOptimization.optimized_risk_metrics.var_95} format={(v) => formatCurrency(v)} higherIsBetter={false} />
              <MetricCompare label="CVaR (95%)" original={lastOptimization.original_risk_metrics.cvar_95} optimized={lastOptimization.optimized_risk_metrics.cvar_95} format={(v) => formatCurrency(v)} higherIsBetter={false} />
              <MetricCompare label="Max Drawdown" original={lastOptimization.original_risk_metrics.max_drawdown} optimized={lastOptimization.optimized_risk_metrics.max_drawdown} format={(v) => formatPct(v)} higherIsBetter={false} />
            </div>
          </div>

          {/* AI Narrative */}
          <div className="bg-stone-50 border border-indigo-200 dark:bg-slate-800/30 dark:border-indigo-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">AI Analysis</h4>
            </div>
            <p className="text-sm text-stone-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{lastOptimization.narrative}</p>
          </div>

          {/* Apply Button */}
          <button
            onClick={onApplyWeights}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-emerald-400 hover:to-teal-400 transition-all"
          >
            <Target className="w-4 h-4" />
            Apply Optimized Weights to Portfolio
          </button>
        </div>
      )}
    </div>
  );
}

function MetricCompare({ label, original, optimized, format, higherIsBetter }: {
  label: string; original: number; optimized: number; format: (v: number) => string; higherIsBetter: boolean;
}) {
  const diff = optimized - original;
  const improved = higherIsBetter ? diff > 0.0001 : diff < -0.0001;
  const worsened = higherIsBetter ? diff < -0.0001 : diff > 0.0001;
  return (
    <div className="bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/30 rounded-lg p-3">
      <div className="text-[10px] font-mono text-stone-400 dark:text-slate-500 uppercase tracking-wider mb-2">{label}</div>
      <div className="flex items-baseline justify-between">
        <div className="text-xs text-stone-400 dark:text-slate-500 font-mono">{format(original)}</div>
        <div className="text-stone-300 dark:text-slate-600 text-xs mx-1">&rarr;</div>
        <div className={`text-sm font-mono font-bold ${improved ? "text-green-600 dark:text-emerald-400" : worsened ? "text-red-600 dark:text-red-400" : "text-stone-600 dark:text-slate-300"}`}>
          {format(optimized)}
        </div>
      </div>
    </div>
  );
}
