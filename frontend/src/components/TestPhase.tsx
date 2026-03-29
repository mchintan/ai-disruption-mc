import { useState } from "react";
import {
  Play, Loader2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Activity,
  Settings, Sparkles, FlaskConical, Fingerprint,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import { useTheme } from "./ThemeProvider";
import { runSimulation, optimizeWeights, fetchCrisisPeriods, runBacktest, analyzeDNA, calibrateScenario, runScenario } from "../api";
import { track } from "../telemetry";
import { humanizeCurrency, humanizeModel, humanizeSharpe, humanizeGrade } from "../utils/humanize";
import type {
  AssetParams, SimConfig, SimulateResponse, OptimizeResponse,
  OptimizationObjective, BacktestResponse, DNAResponse, CrisisPeriodSummary,
} from "../types/portfolio";

interface Props {
  assets: AssetParams[];
  correlationMatrix: number[][];
  lastSimulation: { config: SimConfig; result: SimulateResponse } | null;
  lastOptimization: OptimizeResponse | null;
  lastBacktest: { crisisId: string; config: any; result: BacktestResponse } | null;
  dna: DNAResponse | null;
  onSimulationComplete: (config: SimConfig, result: SimulateResponse) => void;
  onOptimizationComplete: (result: OptimizeResponse) => void;
  onApplyWeights: () => void;
  onBacktestComplete: (crisisId: string, config: any, result: BacktestResponse) => void;
  onDNAComplete: (dna: DNAResponse) => void;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const OBJECTIVES: { value: OptimizationObjective; label: string }[] = [
  { value: "max_sharpe", label: "Best risk-adjusted" },
  { value: "min_var", label: "Minimize losses" },
  { value: "min_cvar", label: "Minimize crash risk" },
  { value: "min_max_drawdown", label: "Minimize drops" },
  { value: "max_return", label: "Maximum growth" },
];

export function TestPhase({ assets, correlationMatrix, lastSimulation, lastOptimization, lastBacktest, dna, onSimulationComplete, onOptimizationComplete, onApplyWeights, onBacktestComplete, onDNAComplete }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Simulation config
  const [numSimulations, setNumSimulations] = useState(lastSimulation?.config.numSimulations ?? 500);
  const [numYears, setNumYears] = useState(lastSimulation?.config.numYears ?? 10);
  const [model, setModel] = useState<"gbm" | "merton" | "regime">(lastSimulation?.config.model ?? "merton");
  const [initialInvestment, setInitialInvestment] = useState(lastSimulation?.config.initialInvestment ?? 100000);
  const [seed, setSeed] = useState<number | null>(lastSimulation?.config.seed ?? 42);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  // Optimize state
  const [objective, setObjective] = useState<OptimizationObjective>("max_sharpe");
  const [optLoading, setOptLoading] = useState(false);
  const [optError, setOptError] = useState<string | null>(null);

  // Backtest state
  const [crisisPeriods, setCrisisPeriods] = useState<CrisisPeriodSummary[]>([]);
  const [crisisLoading, setCrisisLoading] = useState(false);
  const [selectedCrisis, setSelectedCrisis] = useState<string>("");
  const [btLoading, setBtLoading] = useState(false);
  const [btError, setBtError] = useState<string | null>(null);
  const [showCustomScenario, setShowCustomScenario] = useState(false);
  const [scenarioDesc, setScenarioDesc] = useState("");
  const [tradingDays, setTradingDays] = useState(60);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrated, setCalibrated] = useState<any>(null);
  const [scenarioRunning, setScenarioRunning] = useState(false);
  const [scenarioResult, setScenarioResult] = useState<any>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  // Collapsibles
  const [showSamplePaths, setShowSamplePaths] = useState(false);
  const [showPerAsset, setShowPerAsset] = useState(false);
  const [showDNADetails, setShowDNADetails] = useState(false);

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

  const handleRunSimulation = async () => {
    setSimLoading(true);
    setSimError(null);
    try {
      const result = await runSimulation({
        assets, correlation_matrix: correlationMatrix,
        num_simulations: numSimulations, num_years: numYears, model,
        initial_investment: initialInvestment, seed,
      });
      const config: SimConfig = { numSimulations, numYears, model, initialInvestment, seed };
      onSimulationComplete(config, result);
      track("simulation_run", { model, numSimulations, numYears });
    } catch (err) {
      setSimError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setSimLoading(false);
    }
  };

  const handleOptimize = async () => {
    if (!lastSimulation) return;
    setOptLoading(true);
    setOptError(null);
    try {
      const result = await optimizeWeights({
        assets, correlation_matrix: correlationMatrix,
        num_simulations: lastSimulation.config.numSimulations,
        num_years: lastSimulation.config.numYears,
        model: lastSimulation.config.model,
        initial_investment: lastSimulation.config.initialInvestment,
        objective, seed: lastSimulation.config.seed,
      });
      onOptimizationComplete(result);
      track("optimization_run", { objective });
    } catch (err) {
      setOptError(err instanceof Error ? err.message : "Optimization failed");
    } finally {
      setOptLoading(false);
    }
  };

  const loadCrisisPeriods = async () => {
    if (crisisPeriods.length > 0) return;
    setCrisisLoading(true);
    try {
      const periods = await fetchCrisisPeriods();
      setCrisisPeriods(periods);
      if (periods.length > 0) setSelectedCrisis(periods[0].id);
    } catch (e) { console.error(e); }
    finally { setCrisisLoading(false); }
  };

  const handleBacktest = async () => {
    if (!selectedCrisis) return;
    setBtLoading(true);
    setBtError(null);
    try {
      const portfolio = assets.map(a => ({ ticker: a.ticker, allocation_pct: a.allocation_pct }));
      const result = await runBacktest({
        crisis_id: selectedCrisis, portfolio,
        num_simulations: 500, initial_investment: initialInvestment,
        model: "merton", rebalance: false, seed: 42,
      });
      const config = { numSimulations: 500, initialInvestment, model: "merton", rebalance: false };
      onBacktestComplete(selectedCrisis, config, result);
      track("backtest_run", { crisis: selectedCrisis });
    } catch (err) {
      setBtError(err instanceof Error ? err.message : "Backtest failed");
    } finally {
      setBtLoading(false);
    }
  };

  const handleCalibrate = async () => {
    setCalibrating(true); setScenarioError(null); setCalibrated(null); setScenarioResult(null);
    try {
      const tickers = assets.map(a => a.ticker);
      const result = await calibrateScenario({ description: scenarioDesc, asset_tickers: tickers, trading_days: tradingDays });
      setCalibrated(result.scenario);
    } catch (e) { setScenarioError(e instanceof Error ? e.message : "Calibration failed"); }
    finally { setCalibrating(false); }
  };

  const handleRunScenario = async () => {
    if (!calibrated) return;
    setScenarioRunning(true); setScenarioError(null);
    try {
      const portfolio = assets.map(a => ({ ticker: a.ticker, allocation_pct: a.allocation_pct }));
      const result = await runScenario({ scenario: calibrated, portfolio, num_simulations: 500, initial_investment: initialInvestment, model: "merton", rebalance: false, seed: 42 });
      setScenarioResult(result);
    } catch (e) { setScenarioError(e instanceof Error ? e.message : "Scenario run failed"); }
    finally { setScenarioRunning(false); }
  };

  const handleAnalyzeDNA = async () => {
    try {
      const result = await analyzeDNA({ assets, correlation_matrix: correlationMatrix });
      onDNAComplete(result as unknown as DNAResponse);
    } catch (e) { console.error("DNA analysis failed:", e); }
  };

  const gradeInfo = dna ? humanizeGrade(dna.scores as unknown as Record<string, number>) : null;

  if (assets.length === 0) {
    return (
      <div className="text-center py-16 text-stone-400 dark:text-slate-500">
        <p className="text-sm">Build a portfolio first, then come back to test it.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* A. Simulation Config + Run */}
      <div className="bg-white dark:bg-slate-900/50 border border-stone-200 dark:border-slate-700/30 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-stone-700 dark:text-slate-300 mb-4">Run Monte Carlo Simulation</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">Investment Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-slate-500 text-sm">$</span>
              <input type="number" value={initialInvestment} onChange={(e) => setInitialInvestment(Number(e.target.value))} min={1000} step={10000} className="w-full bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/50 rounded-xl pl-7 pr-4 py-2.5 text-sm text-stone-900 dark:text-slate-200 focus:outline-none focus:border-teal-400 dark:focus:border-cyan-500/50" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">
              Time Horizon: {numYears} years
            </label>
            <input type="range" min={1} max={30} step={1} value={numYears} onChange={(e) => setNumYears(Number(e.target.value))} className="w-full accent-teal-600 dark:accent-cyan-500 mt-1" />
            <div className="flex justify-between text-xs text-stone-400 dark:text-slate-600 mt-1"><span>1yr</span><span>15yr</span><span>30yr</span></div>
          </div>
        </div>

        {/* Model selector */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">Simulation Model</label>
          <div className="grid grid-cols-3 gap-2">
            {(["gbm", "merton", "regime"] as const).map((m) => (
              <button key={m} onClick={() => setModel(m)}
                className={`py-2.5 px-3 rounded-lg text-xs font-medium transition-all ${
                  model === m
                    ? "bg-teal-50 border border-teal-200 text-teal-700 dark:bg-cyan-500/10 dark:border-cyan-500/30 dark:text-cyan-400"
                    : "bg-white border border-stone-200 text-stone-500 hover:border-stone-300 dark:bg-slate-800/50 dark:border-slate-700/30 dark:text-slate-400 dark:hover:border-slate-600/50"
                }`}
              >
                {humanizeModel(m)}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced toggle */}
        <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-xs text-stone-400 dark:text-slate-500 hover:text-stone-600 dark:hover:text-slate-300 mb-3">
          <Settings className="w-3 h-3" />
          Advanced
          {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-stone-500 dark:text-slate-500 mb-2">
                Simulations: <span className="text-teal-600 dark:text-cyan-400">{numSimulations.toLocaleString()}</span>
              </label>
              <input type="range" min={50} max={2000} step={50} value={numSimulations} onChange={(e) => setNumSimulations(Number(e.target.value))} className="w-full accent-teal-600 dark:accent-cyan-500" />
            </div>
            <div>
              <label className="block text-xs text-stone-500 dark:text-slate-500 mb-2">Random Seed</label>
              <div className="flex gap-2">
                <input type="number" value={seed ?? ""} onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : null)} placeholder="Random" className="flex-1 bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/50 rounded-xl px-4 py-2 text-sm text-stone-900 dark:text-slate-200 focus:outline-none focus:border-teal-400 dark:focus:border-cyan-500/50" />
                <button onClick={() => setSeed(Math.floor(Math.random() * 10000))} className="px-3 py-2 bg-white border border-stone-200 dark:bg-slate-800/50 dark:border-slate-700/50 rounded-xl text-xs text-stone-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-cyan-400 transition-colors">Reseed</button>
              </div>
            </div>
          </div>
        )}

        {simError && (
          <div className="bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm mb-4">{simError}</div>
        )}

        <button onClick={handleRunSimulation} disabled={simLoading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          {simLoading ? (<><Loader2 className="w-4 h-4 animate-spin" />Running Simulation...</>) : (<><Play className="w-4 h-4" />Run {numSimulations.toLocaleString()} Simulations</>)}
        </button>
      </div>

      {/* B. Results */}
      {sim && (
        <>
          {/* Plain language summary */}
          <div className="bg-teal-50 dark:bg-cyan-500/5 border border-teal-200 dark:border-cyan-500/20 rounded-xl p-5">
            <p className="text-base font-medium text-teal-800 dark:text-cyan-300">
              After {sim.num_years} years, your {humanizeCurrency(sim.initial_investment)} will likely be worth{" "}
              <span className="font-bold">{humanizeCurrency(sim.portfolio_risk_metrics.median_terminal)}</span>.
            </p>
          </div>

          {/* 4 metric cards */}
          <div className="grid grid-cols-2 gap-3">
            {(() => {
              const risk = sim.portfolio_risk_metrics;
              const totalReturn = ((risk.median_terminal - sim.initial_investment) / sim.initial_investment) * 100;
              const sharpeInfo = humanizeSharpe(risk.sharpe_ratio);
              return (
                <>
                  <MetricCard label="Median Outcome" value={formatCurrency(risk.median_terminal)} sub={`${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(1)}% return`} color={totalReturn >= 0 ? "emerald" : "red"} icon={<TrendingUp className="w-4 h-4" />} />
                  <MetricCard label="Worst Month" value={formatCurrency(risk.var_95)} sub="Loss at 95% confidence" color="amber" icon={<TrendingDown className="w-4 h-4" />} />
                  <MetricCard label="Risk-Adjusted Score" value={risk.sharpe_ratio.toFixed(2)} sub={sharpeInfo.label} color="cyan" icon={<Activity className="w-4 h-4" />} />
                  <MetricCard label="Biggest Drop" value={formatPct(risk.max_drawdown)} sub="Worst peak-to-trough" color="pink" icon={<TrendingDown className="w-4 h-4" />} />
                </>
              );
            })()}
          </div>

          {/* Fan Chart */}
          <div className="bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/30 rounded-xl p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-stone-500 dark:text-slate-400 mb-4">Portfolio Percentile Bands</h3>
            <ResponsiveContainer width="100%" height={250} className="sm:!h-[350px]">
              <AreaChart data={sim.portfolio_percentiles.map((p) => ({ year: p.year, p10: p.p10, p25: p.p25, median: p.median, p75: p.p75, p90: p.p90, mean: p.mean }))}>
                <defs>
                  <linearGradient id="testOuterBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={outerBandColor} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={outerBandColor} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="testInnerBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="year" stroke={chartAxis} tick={{ fontSize: 11 }} label={{ value: "Year", position: "insideBottom", offset: -5, fill: chartAxis, fontSize: 11 }} />
                <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
                <Tooltip contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => [formatCurrency(value), ""]} labelFormatter={(label) => `Year ${label}`} />
                <Area type="monotone" dataKey="p90" stroke="none" fill="url(#testOuterBand)" name="P90" />
                <Area type="monotone" dataKey="p75" stroke="none" fill="url(#testInnerBand)" name="P75" />
                <Area type="monotone" dataKey="p25" stroke="none" fill="url(#testInnerBand)" name="P25" />
                <Area type="monotone" dataKey="p10" stroke="none" fill={chartBgFill} name="P10" />
                <Line type="monotone" dataKey="median" stroke={medianColor} strokeWidth={2} dot={false} name="Median" />
                <Line type="monotone" dataKey="mean" stroke={meanColor} strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Mean" />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Sample Paths (collapsible) */}
          {sim.portfolio_sample_paths.length > 0 && (
            <div className="bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/30 rounded-xl">
              <button onClick={() => setShowSamplePaths(!showSamplePaths)} className="w-full flex items-center justify-between px-5 py-4">
                <span className="text-sm font-semibold text-stone-500 dark:text-slate-400">Sample Simulation Paths</span>
                {showSamplePaths ? <ChevronUp className="w-4 h-4 text-stone-400 dark:text-slate-500" /> : <ChevronDown className="w-4 h-4 text-stone-400 dark:text-slate-500" />}
              </button>
              {showSamplePaths && (() => {
                const samplePathData: Record<string, number | string>[] = [];
                const numSteps = sim.portfolio_sample_paths[0].length;
                for (let t = 0; t < numSteps; t++) {
                  const row: Record<string, number | string> = { year: sim.portfolio_sample_paths[0][t].year };
                  sim.portfolio_sample_paths.forEach((path, i) => { row[`path_${i}`] = path[t].value; });
                  samplePathData.push(row);
                }
                return (
                  <div className="px-4 pb-4 sm:px-6 sm:pb-6">
                    <ResponsiveContainer width="100%" height={250} className="sm:!h-[300px]">
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
            </div>
          )}

          {/* Per-Asset table (collapsible) */}
          {sim.asset_results.length > 1 && (
            <div className="bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/30 rounded-xl">
              <button onClick={() => setShowPerAsset(!showPerAsset)} className="w-full flex items-center justify-between px-5 py-4">
                <span className="text-sm font-semibold text-stone-500 dark:text-slate-400">Per-Asset Results</span>
                {showPerAsset ? <ChevronUp className="w-4 h-4 text-stone-400 dark:text-slate-500" /> : <ChevronDown className="w-4 h-4 text-stone-400 dark:text-slate-500" />}
              </button>
              {showPerAsset && (
                <div className="px-4 pb-4 sm:px-6 sm:pb-6 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-stone-500 dark:text-slate-500 border-b border-stone-200 dark:border-slate-700/30">
                        <th className="text-left pb-2 pr-4">Asset</th>
                        <th className="text-right pb-2 pr-4">Alloc</th>
                        <th className="text-right pb-2 pr-4">Median</th>
                        <th className="text-right pb-2 pr-4">Return</th>
                        <th className="text-right pb-2 pr-4">Vol</th>
                        <th className="text-right pb-2 pr-4">Sharpe</th>
                        <th className="text-right pb-2">Max DD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sim.asset_results.map((a, i) => (
                        <tr key={i} className="border-b border-stone-100 dark:border-slate-800/50">
                          <td className="py-2 pr-4 font-bold text-stone-700 dark:text-slate-300">{a.ticker}</td>
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
              )}
            </div>
          )}
        </>
      )}

      {/* C. Can It Be Better? (Optimize) */}
      <div className="bg-white dark:bg-slate-900/50 border border-stone-200 dark:border-slate-700/30 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <h2 className="text-sm font-semibold text-violet-600 dark:text-violet-400">Can It Be Better?</h2>
        </div>
        <p className="text-xs text-stone-500 dark:text-slate-400 mb-4">Optimize your allocation weights for a specific goal.</p>

        {!lastSimulation ? (
          <p className="text-xs text-stone-400 dark:text-slate-500">Run a simulation first to unlock optimization.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
              {OBJECTIVES.map((obj) => (
                <button key={obj.value} onClick={() => setObjective(obj.value)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                    objective === obj.value
                      ? "bg-violet-50 border border-violet-200 text-violet-700 dark:bg-violet-500/10 dark:border-violet-500/30 dark:text-violet-400"
                      : "bg-white border border-stone-200 text-stone-500 dark:bg-slate-800/50 dark:border-slate-700/30 dark:text-slate-400"
                  }`}
                >
                  {obj.label}
                </button>
              ))}
            </div>

            {optError && (
              <div className="bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm mb-4">{optError}</div>
            )}

            <button onClick={handleOptimize} disabled={optLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-violet-400 hover:to-purple-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all mb-4">
              {optLoading ? (<><Loader2 className="w-4 h-4 animate-spin" />Optimizing...</>) : "Optimize"}
            </button>

            {/* Optimization results */}
            {lastOptimization && (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-stone-500 dark:text-slate-500 border-b border-stone-200 dark:border-slate-700/30">
                        <th className="text-left pb-2 pr-4">Asset</th>
                        <th className="text-right pb-2 pr-4">Current</th>
                        <th className="text-right pb-2 pr-4">Optimal</th>
                        <th className="text-right pb-2">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lastOptimization.weights.map((w, i) => (
                        <tr key={i} className="border-b border-stone-100 dark:border-slate-800/50">
                          <td className="py-2 pr-4 font-bold text-stone-700 dark:text-slate-300">{w.ticker}</td>
                          <td className="text-right py-2 pr-4 text-stone-600 dark:text-slate-300">{w.original_pct.toFixed(1)}%</td>
                          <td className="text-right py-2 pr-4 font-semibold text-violet-700 dark:text-violet-400">{w.optimal_pct.toFixed(1)}%</td>
                          <td className={`text-right py-2 ${w.optimal_pct - w.original_pct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {w.optimal_pct - w.original_pct >= 0 ? "+" : ""}{(w.optimal_pct - w.original_pct).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {lastOptimization.narrative && (
                  <p className="text-xs text-stone-600 dark:text-slate-300 leading-relaxed bg-stone-50 dark:bg-slate-800/30 rounded-lg p-3">{lastOptimization.narrative}</p>
                )}

                <button onClick={onApplyWeights}
                  className="w-full py-2.5 rounded-xl border-2 border-violet-300 dark:border-violet-500/30 text-violet-700 dark:text-violet-400 font-semibold text-sm hover:bg-violet-50 dark:hover:bg-violet-500/5 transition-all">
                  Apply Optimized Weights
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* D. What If a Crisis Hits? */}
      <div className="bg-white dark:bg-slate-900/50 border border-stone-200 dark:border-slate-700/30 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <h2 className="text-sm font-semibold text-amber-600 dark:text-amber-400">What If a Crisis Hits?</h2>
        </div>
        <p className="text-xs text-stone-500 dark:text-slate-400 mb-4">Stress-test your portfolio against historical crises.</p>

        <div className="mb-4">
          <select
            value={selectedCrisis}
            onChange={(e) => setSelectedCrisis(e.target.value)}
            onFocus={loadCrisisPeriods}
            className="w-full bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-stone-900 dark:text-slate-200 focus:outline-none focus:border-amber-400 dark:focus:border-amber-500/50"
          >
            {crisisPeriods.length === 0 && <option value="">Click to load crisis periods...</option>}
            {crisisLoading && <option value="">Loading...</option>}
            {crisisPeriods.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.start_date} to {c.end_date})</option>
            ))}
          </select>
        </div>

        {btError && (
          <div className="bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm mb-4">{btError}</div>
        )}

        <button onClick={handleBacktest} disabled={btLoading || !selectedCrisis}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all mb-4">
          {btLoading ? (<><Loader2 className="w-4 h-4 animate-spin" />Testing...</>) : "Test Against This Crisis"}
        </button>

        {/* Backtest result summary card */}
        {lastBacktest && (
          <div className="bg-stone-50 dark:bg-slate-800/30 border border-stone-200 dark:border-slate-700/30 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-stone-600 dark:text-slate-300 mb-3">{lastBacktest.result.crisis.name}</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-[10px] text-stone-400 dark:text-slate-500 uppercase">Return</div>
                <div className={`text-sm font-bold ${lastBacktest.result.statistics.total_return_pct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {lastBacktest.result.statistics.total_return_pct >= 0 ? "+" : ""}{lastBacktest.result.statistics.total_return_pct.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-[10px] text-stone-400 dark:text-slate-500 uppercase">Max Drawdown</div>
                <div className="text-sm font-bold text-red-600 dark:text-red-400">{lastBacktest.result.statistics.max_drawdown_pct.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-[10px] text-stone-400 dark:text-slate-500 uppercase">Recovery</div>
                <div className="text-sm font-bold text-stone-700 dark:text-slate-300">
                  {lastBacktest.result.statistics.recovery_days != null ? `${lastBacktest.result.statistics.recovery_days}d` : "N/A"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Custom scenario builder */}
        <button onClick={() => setShowCustomScenario(!showCustomScenario)} className="flex items-center gap-1 text-xs text-stone-400 dark:text-slate-500 hover:text-stone-600 dark:hover:text-slate-300 mt-4">
          {showCustomScenario ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Build Custom Scenario
        </button>

        {showCustomScenario && (
          <div className="mt-3 space-y-3">
            <textarea value={scenarioDesc} onChange={(e) => setScenarioDesc(e.target.value)}
              placeholder="What if inflation hits 8%, Fed hikes 300bps, and tech earnings disappoint by 40%?" rows={3}
              className="w-full bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/50 rounded-xl px-4 py-3 text-stone-900 dark:text-slate-200 placeholder-stone-400 dark:placeholder-slate-600 text-sm focus:outline-none focus:border-amber-400 dark:focus:border-amber-500/50 resize-none" />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-stone-500 dark:text-slate-500 mb-1">Trading Days</label>
                <input type="number" value={tradingDays} onChange={(e) => setTradingDays(Number(e.target.value))} min={5} max={500}
                  className="w-full bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/50 rounded-lg px-3 py-2 text-sm text-stone-900 dark:text-slate-200 focus:outline-none focus:border-amber-400 dark:focus:border-amber-500/50" />
              </div>
              <button onClick={handleCalibrate} disabled={calibrating || scenarioDesc.trim().length < 10}
                className="self-end px-4 py-2 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 text-xs font-medium disabled:opacity-40">
                {calibrating ? "Calibrating..." : "Calibrate"}
              </button>
              {calibrated && (
                <button onClick={handleRunScenario} disabled={scenarioRunning}
                  className="self-end px-4 py-2 rounded-lg bg-amber-500 text-white text-xs font-medium disabled:opacity-40">
                  {scenarioRunning ? "Running..." : "Run Scenario"}
                </button>
              )}
            </div>
            {scenarioError && (
              <div className="text-xs text-red-600 dark:text-red-400">{scenarioError}</div>
            )}
            {scenarioResult && (
              <div className="bg-stone-50 dark:bg-slate-800/30 rounded-lg p-3 text-xs text-stone-600 dark:text-slate-300">
                Scenario complete. Return: {((scenarioResult as any).statistics?.total_return_pct ?? 0).toFixed(1)}%
              </div>
            )}
          </div>
        )}
      </div>

      {/* E. Portfolio Grade (DNA) */}
      <div className="bg-white dark:bg-slate-900/50 border border-stone-200 dark:border-slate-700/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Portfolio Grade</h2>
          </div>
          <button onClick={handleAnalyzeDNA}
            className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/30 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors">
            {dna ? "Refresh" : "Analyze"}
          </button>
        </div>

        {gradeInfo && dna && (
          <div>
            <div className="flex items-center gap-4 mb-3">
              <div className={`text-4xl font-bold ${gradeInfo.color}`}>{gradeInfo.grade}</div>
              <p className="text-sm text-stone-600 dark:text-slate-300">{gradeInfo.explanation}</p>
            </div>

            <button onClick={() => setShowDNADetails(!showDNADetails)} className="flex items-center gap-1 text-xs text-stone-400 dark:text-slate-500 hover:text-stone-600 dark:hover:text-slate-300">
              {showDNADetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              View Details
            </button>

            {showDNADetails && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                {Object.entries(dna.scores).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center py-1.5 px-2 bg-stone-50 dark:bg-slate-800/30 rounded-lg">
                    <span className="text-xs text-stone-500 dark:text-slate-500 capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-xs font-semibold text-stone-900 dark:text-slate-200">{val}/100</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!dna && (
          <p className="text-xs text-stone-400 dark:text-slate-500">Click Analyze to grade your portfolio across 8 dimensions.</p>
        )}
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
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-60 mt-1">{sub}</div>
    </div>
  );
}
