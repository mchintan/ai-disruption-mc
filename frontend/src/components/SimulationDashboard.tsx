import { useState } from "react";
import { ArrowLeft, BarChart3, TrendingDown, TrendingUp, Activity, RefreshCw, Target, Loader2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import { useTheme } from "./ThemeProvider";
import { optimizeWeights } from "../api";
import type { AssetParams, SimulateResponse, OptimizeResponse, OptimizationObjective } from "../types/portfolio";

interface Props {
  result: SimulateResponse;
  simulationConfig: {
    assets: AssetParams[];
    correlationMatrix: number[][];
    numSimulations: number;
    numYears: number;
    model: "gbm" | "merton";
    initialInvestment: number;
    seed: number | null;
  };
  onBack: () => void;
  onRestart: () => void;
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

export function SimulationDashboard({ result, simulationConfig, onBack, onRestart }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { portfolio_percentiles, portfolio_risk_metrics: risk, portfolio_sample_paths, asset_results } = result;

  const [optimizeObjective, setOptimizeObjective] = useState<OptimizationObjective>("max_sharpe");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResponse | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [optimizeExpanded, setOptimizeExpanded] = useState(true);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setOptimizeError(null);
    try {
      const res = await optimizeWeights({
        assets: simulationConfig.assets,
        correlation_matrix: simulationConfig.correlationMatrix,
        num_simulations: simulationConfig.numSimulations,
        num_years: simulationConfig.numYears,
        model: simulationConfig.model,
        initial_investment: simulationConfig.initialInvestment,
        objective: optimizeObjective,
        seed: simulationConfig.seed,
      });
      setOptimizeResult(res);
    } catch (err) {
      setOptimizeError(err instanceof Error ? err.message : "Optimization failed");
    } finally {
      setIsOptimizing(false);
    }
  };

  // Chart colors
  const chartGrid = isDark ? "#334155" : "#e7e5e4";
  const chartAxis = isDark ? "#64748b" : "#a8a29e";
  const chartTooltipBg = isDark ? "#0f172a" : "#ffffff";
  const chartTooltipBorder = isDark ? "#334155" : "#d6d3d1";
  const chartBgFill = isDark ? "#020617" : "#fafaf9";
  const outerBandColor = isDark ? "#06b6d4" : "#0d9488";
  const medianColor = isDark ? "#f59e0b" : "#d97706";
  const meanColor = isDark ? "#06b6d4" : "#0d9488";
  const pathColors = isDark
    ? ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899", "#3b82f6"]
    : ["#0d9488", "#7c3aed", "#d97706", "#16a34a", "#db2777", "#2563eb"];

  const fanData = portfolio_percentiles.map((p) => ({
    year: p.year, p10: p.p10, p25: p.p25, median: p.median, p75: p.p75, p90: p.p90, mean: p.mean,
  }));

  const samplePathData: Record<string, number | string>[] = [];
  if (portfolio_sample_paths.length > 0) {
    const numSteps = portfolio_sample_paths[0].length;
    for (let t = 0; t < numSteps; t++) {
      const row: Record<string, number | string> = { year: portfolio_sample_paths[0][t].year };
      portfolio_sample_paths.forEach((path, i) => { row[`path_${i}`] = path[t].value; });
      samplePathData.push(row);
    }
  }

  const terminalMedian = portfolio_percentiles[portfolio_percentiles.length - 1]?.median ?? 0;
  const totalReturn = ((terminalMedian - result.initial_investment) / result.initial_investment) * 100;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-50 border border-green-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 mb-6">
          <BarChart3 className="w-4 h-4 text-green-600 dark:text-emerald-400" />
          <span className="text-xs font-mono font-semibold text-green-600 dark:text-emerald-400 tracking-wide">
            STEP 4 — SIMULATION RESULTS
          </span>
        </div>
        <h2 className="text-2xl font-bold text-stone-900 dark:text-slate-100 mb-3">Monte Carlo Results</h2>
        <p className="text-stone-500 dark:text-slate-400 text-sm">
          {result.model_used === "merton" ? "Merton Jump Diffusion" : "Geometric Brownian Motion"} · {result.num_simulations.toLocaleString()} simulations · {result.num_years} years
        </p>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <MetricCard label="Median Terminal Value" value={formatCurrency(risk.median_terminal)} sub={`${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(1)}% return`} color={totalReturn >= 0 ? "emerald" : "red"} icon={<TrendingUp className="w-4 h-4" />} />
        <MetricCard label="VaR (95%)" value={formatCurrency(risk.var_95)} sub="Worst-case loss at 95% confidence" color="amber" icon={<TrendingDown className="w-4 h-4" />} />
        <MetricCard label="Sharpe Ratio" value={risk.sharpe_ratio.toFixed(2)} sub="Risk-adjusted return" color="cyan" icon={<Activity className="w-4 h-4" />} />
        <MetricCard label="Max Drawdown" value={formatPct(risk.max_drawdown)} sub="Worst peak-to-trough" color="pink" icon={<TrendingDown className="w-4 h-4" />} />
      </div>

      {/* Fan Chart */}
      <div className="bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/30 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-mono font-semibold text-stone-500 dark:text-slate-400 mb-4">Portfolio Percentile Bands</h3>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={fanData}>
            <defs>
              <linearGradient id="outerBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={outerBandColor} stopOpacity={0.1} />
                <stop offset="95%" stopColor={outerBandColor} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="innerBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
            <XAxis dataKey="year" stroke={chartAxis} tick={{ fontSize: 11 }} label={{ value: "Year", position: "insideBottom", offset: -5, fill: chartAxis, fontSize: 11 }} />
            <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
            <Tooltip contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => [formatCurrency(value), ""]} labelFormatter={(label) => `Year ${label}`} />
            <Area type="monotone" dataKey="p90" stroke="none" fill="url(#outerBand)" name="P90" />
            <Area type="monotone" dataKey="p75" stroke="none" fill="url(#innerBand)" name="P75" />
            <Area type="monotone" dataKey="p25" stroke="none" fill="url(#innerBand)" name="P25" />
            <Area type="monotone" dataKey="p10" stroke="none" fill={chartBgFill} name="P10" />
            <Line type="monotone" dataKey="median" stroke={medianColor} strokeWidth={2} dot={false} name="Median" />
            <Line type="monotone" dataKey="mean" stroke={meanColor} strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Mean" />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Sample Paths Chart */}
      {samplePathData.length > 0 && (
        <div className="bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/30 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-mono font-semibold text-stone-500 dark:text-slate-400 mb-4">Sample Simulation Paths</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={samplePathData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="year" stroke={chartAxis} tick={{ fontSize: 11 }} />
              <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
              <Tooltip contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => [formatCurrency(value), ""]} labelFormatter={(label) => `Year ${label}`} />
              {portfolio_sample_paths.map((_, i) => (
                <Line key={i} type="monotone" dataKey={`path_${i}`} stroke={pathColors[i % pathColors.length]} strokeWidth={1.5} dot={false} strokeOpacity={0.7} name={`Path ${i + 1}`} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Risk Metrics Table */}
      <div className="bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/30 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-mono font-semibold text-stone-500 dark:text-slate-400 mb-4">Detailed Risk Metrics</h3>
        <div className="grid grid-cols-3 gap-4">
          <RiskRow label="Expected Annual Return" value={formatPct(risk.expected_return)} />
          <RiskRow label="Annual Volatility" value={formatPct(risk.volatility)} />
          <RiskRow label="Sharpe Ratio" value={risk.sharpe_ratio.toFixed(3)} />
          <RiskRow label="VaR 95%" value={formatCurrency(risk.var_95)} />
          <RiskRow label="VaR 99%" value={formatCurrency(risk.var_99)} />
          <RiskRow label="CVaR 95% (Expected Shortfall)" value={formatCurrency(risk.cvar_95)} />
          <RiskRow label="Max Drawdown" value={formatPct(risk.max_drawdown)} />
          <RiskRow label="Median Terminal Value" value={formatCurrency(risk.median_terminal)} />
          <RiskRow label="Mean Terminal Value" value={formatCurrency(risk.mean_terminal)} />
        </div>
      </div>

      {/* Per-Asset Results */}
      {asset_results.length > 1 && (
        <div className="bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/30 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-mono font-semibold text-stone-500 dark:text-slate-400 mb-4">Per-Asset Results</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-stone-500 dark:text-slate-500 border-b border-stone-200 dark:border-slate-700/30">
                  <th className="text-left pb-2 pr-4">Asset</th>
                  <th className="text-right pb-2 pr-4">Alloc</th>
                  <th className="text-right pb-2 pr-4">Median Term.</th>
                  <th className="text-right pb-2 pr-4">Exp. Return</th>
                  <th className="text-right pb-2 pr-4">Volatility</th>
                  <th className="text-right pb-2 pr-4">Sharpe</th>
                  <th className="text-right pb-2">Max DD</th>
                </tr>
              </thead>
              <tbody>
                {asset_results.map((a, i) => (
                  <tr key={i} className="border-b border-stone-100 dark:border-slate-800/50">
                    <td className={`py-2 pr-4 font-bold ${ASSET_TEXT_COLORS[i % ASSET_TEXT_COLORS.length]}`}>{a.ticker}</td>
                    <td className="text-right py-2 pr-4 text-stone-600 dark:text-slate-300">{a.allocation_pct}%</td>
                    <td className="text-right py-2 pr-4 text-stone-600 dark:text-slate-300">{formatCurrency(a.risk_metrics.median_terminal)}</td>
                    <td className="text-right py-2 pr-4 text-stone-600 dark:text-slate-300">{formatPct(a.risk_metrics.expected_return)}</td>
                    <td className="text-right py-2 pr-4 text-stone-600 dark:text-slate-300">{formatPct(a.risk_metrics.volatility)}</td>
                    <td className="text-right py-2 pr-4 text-stone-600 dark:text-slate-300">{a.risk_metrics.sharpe_ratio.toFixed(2)}</td>
                    <td className="text-right py-2 text-stone-600 dark:text-slate-300">{formatPct(a.risk_metrics.max_drawdown)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Weight Optimization Section */}
      <div className="bg-white border border-indigo-200 dark:bg-slate-900/50 dark:border-indigo-500/30 rounded-xl p-6 mb-6">
        <button onClick={() => setOptimizeExpanded(!optimizeExpanded)} className="w-full flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-mono font-semibold text-indigo-600 dark:text-indigo-400">Optimize Portfolio Weights</h3>
          </div>
          {optimizeExpanded ? <ChevronUp className="w-4 h-4 text-stone-400 dark:text-slate-500" /> : <ChevronDown className="w-4 h-4 text-stone-400 dark:text-slate-500" />}
        </button>

        {optimizeExpanded && (
          <div>
            <p className="text-xs text-stone-500 dark:text-slate-500 mb-4">
              Find optimal asset weights by running Monte Carlo optimization. Choose your objective and the optimizer will search for the best allocation.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">Optimization Objective</label>
              <div className="grid grid-cols-5 gap-2">
                {OBJECTIVES.map((obj) => (
                  <button key={obj.value} onClick={() => { setOptimizeObjective(obj.value); setOptimizeResult(null); }}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      optimizeObjective === obj.value
                        ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30"
                        : "bg-stone-50 border-stone-200 hover:border-stone-300 dark:bg-slate-800/30 dark:border-slate-700/30 dark:hover:border-slate-600/50"
                    }`}>
                    <div className={`text-xs font-semibold mb-0.5 ${optimizeObjective === obj.value ? "text-indigo-600 dark:text-indigo-400" : "text-stone-600 dark:text-slate-300"}`}>{obj.label}</div>
                    <div className="text-[10px] text-stone-400 dark:text-slate-500">{obj.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleOptimize} disabled={isOptimizing} className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all mb-4">
              {isOptimizing ? (<><Loader2 className="w-4 h-4 animate-spin" />Optimizing weights (this may take 30-60s)...</>) : (<><Target className="w-4 h-4" />Optimize Weights</>)}
            </button>

            {optimizeError && (
              <div className="bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm mb-4">{optimizeError}</div>
            )}

            {optimizeResult && (
              <div className="space-y-4">
                <div className={`text-xs font-mono px-3 py-1.5 rounded-lg inline-block ${
                  optimizeResult.converged
                    ? "bg-green-50 text-green-700 border border-green-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                    : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                }`}>
                  {optimizeResult.converged ? "Optimization converged" : "Did not fully converge (results may still be useful)"}
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
                      {optimizeResult.weights.map((w, i) => {
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
                    <MetricCompare label="Sharpe Ratio" original={optimizeResult.original_risk_metrics.sharpe_ratio} optimized={optimizeResult.optimized_risk_metrics.sharpe_ratio} format={(v) => v.toFixed(3)} higherIsBetter={true} />
                    <MetricCompare label="Expected Return" original={optimizeResult.original_risk_metrics.expected_return} optimized={optimizeResult.optimized_risk_metrics.expected_return} format={(v) => formatPct(v)} higherIsBetter={true} />
                    <MetricCompare label="Volatility" original={optimizeResult.original_risk_metrics.volatility} optimized={optimizeResult.optimized_risk_metrics.volatility} format={(v) => formatPct(v)} higherIsBetter={false} />
                    <MetricCompare label="VaR (95%)" original={optimizeResult.original_risk_metrics.var_95} optimized={optimizeResult.optimized_risk_metrics.var_95} format={(v) => formatCurrency(v)} higherIsBetter={false} />
                    <MetricCompare label="CVaR (95%)" original={optimizeResult.original_risk_metrics.cvar_95} optimized={optimizeResult.optimized_risk_metrics.cvar_95} format={(v) => formatCurrency(v)} higherIsBetter={false} />
                    <MetricCompare label="Max Drawdown" original={optimizeResult.original_risk_metrics.max_drawdown} optimized={optimizeResult.optimized_risk_metrics.max_drawdown} format={(v) => formatPct(v)} higherIsBetter={false} />
                  </div>
                </div>

                {/* AI Narrative */}
                <div className="bg-stone-50 border border-indigo-200 dark:bg-slate-800/30 dark:border-indigo-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h4 className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">AI Analysis</h4>
                  </div>
                  <p className="text-sm text-stone-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{optimizeResult.narrative}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="px-6 py-3 rounded-xl border border-stone-200 text-stone-500 hover:text-stone-700 dark:border-slate-700/50 dark:text-slate-400 dark:hover:text-slate-200 transition-colors text-sm flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />Reconfigure
        </button>
        <button onClick={onRestart} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-emerald-400 hover:to-teal-400 transition-all">
          <RefreshCw className="w-4 h-4" />Build New Portfolio
        </button>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color, icon }: { label: string; value: string; sub: string; color: string; icon: React.ReactNode }) {
  const colorClasses: Record<string, string> = {
    emerald: "text-green-700 bg-green-50 border-green-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20",
    red: "text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20",
    amber: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20",
    cyan: "text-teal-700 bg-teal-50 border-teal-200 dark:text-cyan-400 dark:bg-cyan-500/10 dark:border-cyan-500/20",
    pink: "text-pink-700 bg-pink-50 border-pink-200 dark:text-pink-400 dark:bg-pink-500/10 dark:border-pink-500/20",
  };
  const cls = colorClasses[color] || colorClasses.cyan;
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="flex items-center gap-2 mb-2 opacity-70">
        {icon}
        <span className="text-xs font-mono uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold font-mono">{value}</div>
      <div className="text-xs opacity-60 mt-1">{sub}</div>
    </div>
  );
}

function RiskRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-stone-100 dark:border-slate-800/30">
      <span className="text-xs text-stone-500 dark:text-slate-500">{label}</span>
      <span className="text-xs font-mono text-stone-900 dark:text-slate-200 font-semibold">{value}</span>
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
