import { useState } from "react";
import {
  BarChart3, TrendingDown, TrendingUp, Activity,
  Settings, Loader2, Play, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import { useTheme } from "./ThemeProvider";
import { runSimulation } from "../api";
import { track } from "../telemetry";
import type { AssetParams, SimConfig, SimulateResponse } from "../types/portfolio";

interface Props {
  assets: AssetParams[];
  correlationMatrix: number[][];
  lastSimulation: { config: SimConfig; result: SimulateResponse } | null;
  onSimulationComplete: (config: SimConfig, result: SimulateResponse) => void;
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

export function SimulateTab({ assets, correlationMatrix, lastSimulation, onSimulationComplete }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [configOpen, setConfigOpen] = useState(!lastSimulation);
  const [numSimulations, setNumSimulations] = useState(lastSimulation?.config.numSimulations ?? 500);
  const [numYears, setNumYears] = useState(lastSimulation?.config.numYears ?? 10);
  const [model, setModel] = useState<"gbm" | "merton">(lastSimulation?.config.model ?? "merton");
  const [initialInvestment, setInitialInvestment] = useState(lastSimulation?.config.initialInvestment ?? 100000);
  const [seed, setSeed] = useState<number | null>(lastSimulation?.config.seed ?? 42);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await runSimulation({
        assets,
        correlation_matrix: correlationMatrix,
        num_simulations: numSimulations,
        num_years: numYears,
        model,
        initial_investment: initialInvestment,
        seed,
      });
      const config: SimConfig = { numSimulations, numYears, model, initialInvestment, seed };
      onSimulationComplete(config, result);
      setConfigOpen(false);
      track("simulation_run", { model, numSimulations, numYears });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setIsLoading(false);
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

  const sim = lastSimulation?.result;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Config Section */}
      <div className="bg-white dark:bg-slate-900/50 border border-stone-200 dark:border-slate-700/30 rounded-xl mb-6">
        <button
          onClick={() => setConfigOpen(!configOpen)}
          className="w-full flex items-center justify-between px-5 py-4"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-mono font-semibold text-amber-600 dark:text-amber-400">
              Simulation Configuration
            </span>
            {sim && (
              <span className="text-xs text-stone-400 dark:text-slate-500 ml-2">
                {sim.model_used === "merton" ? "Merton" : "GBM"} &middot; {sim.num_simulations.toLocaleString()} paths &middot; {sim.num_years}yr
              </span>
            )}
          </div>
          {configOpen ? <ChevronUp className="w-4 h-4 text-stone-400 dark:text-slate-500" /> : <ChevronDown className="w-4 h-4 text-stone-400 dark:text-slate-500" />}
        </button>

        {configOpen && (
          <div className="px-5 pb-5 border-t border-stone-100 dark:border-slate-800/50 pt-4">
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Model Selection */}
              <div className="col-span-2">
                <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-3">
                  Simulation Model
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setModel("gbm")}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      model === "gbm"
                        ? "bg-teal-50 border-teal-200 dark:bg-cyan-500/10 dark:border-cyan-500/30"
                        : "bg-white border-stone-200 hover:border-stone-300 dark:bg-slate-900/30 dark:border-slate-700/30 dark:hover:border-slate-600/50"
                    }`}
                  >
                    <div className={`text-sm font-semibold mb-1 ${model === "gbm" ? "text-teal-700 dark:text-cyan-400" : "text-stone-700 dark:text-slate-300"}`}>
                      Geometric Brownian Motion
                    </div>
                    <div className="text-xs text-stone-500 dark:text-slate-500 font-mono">dS/S = &mu;dt + &sigma;dW</div>
                    <div className="text-xs text-stone-400 dark:text-slate-600 mt-2">Standard model. Continuous price paths with no jumps. Good for stable assets.</div>
                  </button>
                  <button
                    onClick={() => setModel("merton")}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      model === "merton"
                        ? "bg-violet-50 border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/30"
                        : "bg-white border-stone-200 hover:border-stone-300 dark:bg-slate-900/30 dark:border-slate-700/30 dark:hover:border-slate-600/50"
                    }`}
                  >
                    <div className={`text-sm font-semibold mb-1 ${model === "merton" ? "text-violet-700 dark:text-violet-400" : "text-stone-700 dark:text-slate-300"}`}>
                      Merton Jump Diffusion
                    </div>
                    <div className="text-xs text-stone-500 dark:text-slate-500 font-mono">dS/S = (&mu;-&lambda;k)dt + &sigma;dW + JdN</div>
                    <div className="text-xs text-stone-400 dark:text-slate-600 mt-2">Adds Poisson jumps for crashes and spikes. More realistic for volatile assets.</div>
                  </button>
                </div>
              </div>

              {/* Number of Simulations */}
              <div>
                <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Number of Simulations: <span className="text-teal-600 dark:text-cyan-400">{numSimulations.toLocaleString()}</span>
                </label>
                <input type="range" min={50} max={2000} step={50} value={numSimulations} onChange={(e) => setNumSimulations(Number(e.target.value))} className="w-full accent-teal-600 dark:accent-cyan-500" />
                <div className="flex justify-between text-xs text-stone-400 dark:text-slate-600 font-mono mt-1"><span>50</span><span>1,000</span><span>2,000</span></div>
              </div>

              {/* Number of Years */}
              <div>
                <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Simulation Horizon: <span className="text-teal-600 dark:text-cyan-400">{numYears} years</span>
                </label>
                <input type="range" min={1} max={30} step={1} value={numYears} onChange={(e) => setNumYears(Number(e.target.value))} className="w-full accent-teal-600 dark:accent-cyan-500" />
                <div className="flex justify-between text-xs text-stone-400 dark:text-slate-600 font-mono mt-1"><span>1yr</span><span>15yr</span><span>30yr</span></div>
              </div>

              {/* Initial Investment */}
              <div>
                <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">Initial Investment</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-slate-500 text-sm">$</span>
                  <input type="number" value={initialInvestment} onChange={(e) => setInitialInvestment(Number(e.target.value))} min={1000} step={10000} className="w-full bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/50 rounded-xl pl-7 pr-4 py-2.5 text-sm text-stone-900 dark:text-slate-200 font-mono focus:outline-none focus:border-teal-400 dark:focus:border-cyan-500/50" />
                </div>
              </div>

              {/* Seed */}
              <div>
                <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">Random Seed</label>
                <div className="flex gap-2">
                  <input type="number" value={seed ?? ""} onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : null)} placeholder="Random" className="flex-1 bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-stone-900 dark:text-slate-200 font-mono focus:outline-none focus:border-teal-400 dark:focus:border-cyan-500/50" />
                  <button onClick={() => setSeed(Math.floor(Math.random() * 10000))} className="px-3 py-2.5 bg-white border border-stone-200 dark:bg-slate-800/50 dark:border-slate-700/50 rounded-xl text-xs text-stone-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-cyan-400 font-mono transition-colors">Reseed</button>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm mb-4">
                {error}
              </div>
            )}

            <button onClick={handleRun} disabled={isLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {isLoading ? (<><Loader2 className="w-4 h-4 animate-spin" />Running Simulation...</>) : (<><Play className="w-4 h-4" />Run Monte Carlo</>)}
            </button>
          </div>
        )}
      </div>

      {/* Results Section */}
      {sim && (
        <>
          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {(() => {
              const risk = sim.portfolio_risk_metrics;
              const terminalMedian = sim.portfolio_percentiles[sim.portfolio_percentiles.length - 1]?.median ?? 0;
              const totalReturn = ((terminalMedian - sim.initial_investment) / sim.initial_investment) * 100;
              return (
                <>
                  <MetricCard label="Median Terminal Value" value={formatCurrency(risk.median_terminal)} sub={`${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(1)}% return`} color={totalReturn >= 0 ? "emerald" : "red"} icon={<TrendingUp className="w-4 h-4" />} />
                  <MetricCard label="VaR (95%)" value={formatCurrency(risk.var_95)} sub="Worst-case loss at 95% confidence" color="amber" icon={<TrendingDown className="w-4 h-4" />} />
                  <MetricCard label="Sharpe Ratio" value={risk.sharpe_ratio.toFixed(2)} sub="Risk-adjusted return" color="cyan" icon={<Activity className="w-4 h-4" />} />
                  <MetricCard label="Max Drawdown" value={formatPct(risk.max_drawdown)} sub="Worst peak-to-trough" color="pink" icon={<TrendingDown className="w-4 h-4" />} />
                </>
              );
            })()}
          </div>

          {/* Fan Chart */}
          <div className="bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/30 rounded-xl p-6 mb-6">
            <h3 className="text-sm font-mono font-semibold text-stone-500 dark:text-slate-400 mb-4">Portfolio Percentile Bands</h3>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={sim.portfolio_percentiles.map((p) => ({ year: p.year, p10: p.p10, p25: p.p25, median: p.median, p75: p.p75, p90: p.p90, mean: p.mean }))}>
                <defs>
                  <linearGradient id="simOuterBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={outerBandColor} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={outerBandColor} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="simInnerBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="year" stroke={chartAxis} tick={{ fontSize: 11 }} label={{ value: "Year", position: "insideBottom", offset: -5, fill: chartAxis, fontSize: 11 }} />
                <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
                <Tooltip contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => [formatCurrency(value), ""]} labelFormatter={(label) => `Year ${label}`} />
                <Area type="monotone" dataKey="p90" stroke="none" fill="url(#simOuterBand)" name="P90" />
                <Area type="monotone" dataKey="p75" stroke="none" fill="url(#simInnerBand)" name="P75" />
                <Area type="monotone" dataKey="p25" stroke="none" fill="url(#simInnerBand)" name="P25" />
                <Area type="monotone" dataKey="p10" stroke="none" fill={chartBgFill} name="P10" />
                <Line type="monotone" dataKey="median" stroke={medianColor} strokeWidth={2} dot={false} name="Median" />
                <Line type="monotone" dataKey="mean" stroke={meanColor} strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Mean" />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Sample Paths Chart */}
          {sim.portfolio_sample_paths.length > 0 && (() => {
            const samplePathData: Record<string, number | string>[] = [];
            const numSteps = sim.portfolio_sample_paths[0].length;
            for (let t = 0; t < numSteps; t++) {
              const row: Record<string, number | string> = { year: sim.portfolio_sample_paths[0][t].year };
              sim.portfolio_sample_paths.forEach((path, i) => { row[`path_${i}`] = path[t].value; });
              samplePathData.push(row);
            }
            return (
              <div className="bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/30 rounded-xl p-6 mb-6">
                <h3 className="text-sm font-mono font-semibold text-stone-500 dark:text-slate-400 mb-4">Sample Simulation Paths</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={samplePathData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                    <XAxis dataKey="year" stroke={chartAxis} tick={{ fontSize: 11 }} />
                    <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
                    <Tooltip contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => [formatCurrency(value), ""]} labelFormatter={(label) => `Year ${label}`} />
                    {sim.portfolio_sample_paths.map((_, i) => (
                      <Line key={i} type="monotone" dataKey={`path_${i}`} stroke={pathColors[i % pathColors.length]} strokeWidth={1.5} dot={false} strokeOpacity={0.7} name={`Path ${i + 1}`} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {/* Risk Metrics Table */}
          <div className="bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/30 rounded-xl p-6 mb-6">
            <h3 className="text-sm font-mono font-semibold text-stone-500 dark:text-slate-400 mb-4">Detailed Risk Metrics</h3>
            <div className="grid grid-cols-3 gap-4">
              {(() => {
                const risk = sim.portfolio_risk_metrics;
                return (
                  <>
                    <RiskRow label="Expected Annual Return" value={formatPct(risk.expected_return)} />
                    <RiskRow label="Annual Volatility" value={formatPct(risk.volatility)} />
                    <RiskRow label="Sharpe Ratio" value={risk.sharpe_ratio.toFixed(3)} />
                    <RiskRow label="VaR 95%" value={formatCurrency(risk.var_95)} />
                    <RiskRow label="VaR 99%" value={formatCurrency(risk.var_99)} />
                    <RiskRow label="CVaR 95% (Expected Shortfall)" value={formatCurrency(risk.cvar_95)} />
                    <RiskRow label="Max Drawdown" value={formatPct(risk.max_drawdown)} />
                    <RiskRow label="Median Terminal Value" value={formatCurrency(risk.median_terminal)} />
                    <RiskRow label="Mean Terminal Value" value={formatCurrency(risk.mean_terminal)} />
                  </>
                );
              })()}
            </div>
          </div>

          {/* Per-Asset Results */}
          {sim.asset_results.length > 1 && (
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
                    {sim.asset_results.map((a, i) => (
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
        </>
      )}

      {!sim && !configOpen && (
        <div className="text-center py-16 text-stone-400 dark:text-slate-500">
          <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Configure and run a simulation to see results.</p>
        </div>
      )}
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
