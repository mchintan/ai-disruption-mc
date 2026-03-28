import { useState, useEffect } from "react";
import {
  AlertTriangle, TrendingDown, TrendingUp, Activity,
  Loader2, Play, RefreshCw, Clock, Shield, Info,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, BarChart, Bar, Cell,
} from "recharts";
import { useTheme } from "./ThemeProvider";
import { fetchCrisisPeriods, fetchBacktestAssets, runBacktest } from "../api";
import type { CrisisPeriodSummary, BacktestAssetInfo, BacktestResponse } from "../types/portfolio";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PORTFOLIO_PRESETS: Record<string, { label: string; weights: Record<string, number> }> = {
  balanced: { label: "Balanced", weights: { "SPY": 30, "QQQ": 20, "BTC-USD": 10, "GLD": 20, "TLT": 20 } },
  aggressive: { label: "Aggressive Growth", weights: { "QQQ": 35, "BTC-USD": 25, "SPY": 20, "GLD": 10, "TLT": 10 } },
  conservative: { label: "Conservative", weights: { "TLT": 35, "GLD": 25, "SPY": 25, "VTI": 15 } },
  crypto_heavy: { label: "Crypto Heavy", weights: { "BTC-USD": 50, "QQQ": 20, "SPY": 15, "GLD": 15 } },
  equity_only: { label: "Equity Only", weights: { "SPY": 40, "QQQ": 35, "VTI": 25 } },
};

const ASSET_COLORS: Record<string, { line: string; text: string }> = {
  "SPY": { line: "#06b6d4", text: "text-cyan-500" },
  "QQQ": { line: "#8b5cf6", text: "text-violet-500" },
  "BTC-USD": { line: "#f59e0b", text: "text-amber-500" },
  "GLD": { line: "#eab308", text: "text-yellow-500" },
  "TLT": { line: "#10b981", text: "text-emerald-500" },
  "VTI": { line: "#3b82f6", text: "text-blue-500" },
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-block ml-1 cursor-help">
      <Info className="w-3.5 h-3.5 text-stone-400 dark:text-slate-600 inline" />
      <span className="invisible group-hover:visible absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs bg-stone-900 dark:bg-slate-700 text-white rounded-lg whitespace-nowrap shadow-lg">
        {text}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BacktestPanel() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Data from API
  const [crisisPeriods, setCrisisPeriods] = useState<CrisisPeriodSummary[]>([]);
  const [availableAssets, setAvailableAssets] = useState<BacktestAssetInfo[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Config state
  const [selectedCrisis, setSelectedCrisis] = useState("");
  const [portfolio, setPortfolio] = useState<Record<string, number>>({});
  const [numSimulations, setNumSimulations] = useState(500);
  const [initialInvestment, setInitialInvestment] = useState(100000);
  const [model, setModel] = useState<"gbm" | "merton">("merton");
  const [rebalance, setRebalance] = useState(false);
  const [seed] = useState<number | null>(42);

  // Result state
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active result tab
  const [activeTab, setActiveTab] = useState<"equity" | "drawdown" | "assets" | "paths" | "returns" | "details">("equity");

  // Fetch crisis periods and assets on mount
  useEffect(() => {
    (async () => {
      try {
        const [periods, assets] = await Promise.all([
          fetchCrisisPeriods(),
          fetchBacktestAssets(),
        ]);
        setCrisisPeriods(periods);
        setAvailableAssets(assets);
        if (periods.length > 0) {
          setSelectedCrisis(periods[0].id);
        }
        // Default to balanced preset
        setPortfolio(PORTFOLIO_PRESETS.balanced.weights);
        setDataLoaded(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load backtest data");
      }
    })();
  }, []);

  const selectedCrisisData = crisisPeriods.find((c) => c.id === selectedCrisis);

  // Filter portfolio to only available assets for selected crisis
  const availableForCrisis = selectedCrisisData?.available_assets ?? [];

  const totalWeight = Object.values(portfolio).reduce((s, v) => s + v, 0);

  const handlePreset = (key: string) => {
    setPortfolio({ ...PORTFOLIO_PRESETS[key].weights });
    setResult(null);
  };

  const handleWeightChange = (ticker: string, value: number) => {
    setPortfolio((prev) => ({ ...prev, [ticker]: Math.max(0, Math.min(100, value)) }));
  };

  const handleRunBacktest = async () => {
    if (!selectedCrisis) return;
    setIsLoading(true);
    setError(null);
    try {
      const portfolioArr = Object.entries(portfolio)
        .filter(([ticker, pct]) => pct > 0 && availableForCrisis.includes(ticker))
        .map(([ticker, pct]) => ({ ticker, allocation_pct: pct }));

      if (portfolioArr.length === 0) {
        throw new Error("No valid assets with non-zero allocation for the selected crisis period.");
      }

      const res = await runBacktest({
        crisis_id: selectedCrisis,
        portfolio: portfolioArr,
        num_simulations: numSimulations,
        initial_investment: initialInvestment,
        model,
        rebalance,
        seed,
      });
      setResult(res);
      setActiveTab("equity");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backtest failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setPortfolio(PORTFOLIO_PRESETS.balanced.weights);
    if (crisisPeriods.length > 0) setSelectedCrisis(crisisPeriods[0].id);
  };

  // Chart theme
  const chartGrid = isDark ? "#334155" : "#e7e5e4";
  const chartAxis = isDark ? "#64748b" : "#a8a29e";
  const chartTooltipBg = isDark ? "#0f172a" : "#ffffff";
  const chartTooltipBorder = isDark ? "#334155" : "#d6d3d1";
  const medianColor = isDark ? "#f59e0b" : "#d97706";
  const pathColors = isDark
    ? ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899", "#3b82f6"]
    : ["#0d9488", "#7c3aed", "#d97706", "#16a34a", "#db2777", "#2563eb"];

  if (!dataLoaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-red-400 mr-3" />
        <span className="text-sm text-stone-500 dark:text-slate-400">Loading backtest data...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 mb-6">
          <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
          <span className="text-xs font-mono font-semibold text-red-600 dark:text-red-400 tracking-wide">
            PORTFOLIO STRESS TEST
          </span>
        </div>
        <h2 className="text-2xl font-bold text-stone-900 dark:text-slate-100 mb-3">
          Historical Crisis Backtest
        </h2>
        <p className="text-stone-500 dark:text-slate-400 text-sm max-w-lg mx-auto">
          Simulate how a portfolio would have performed during historical market crises
          using Monte Carlo simulation calibrated to crisis-era parameters.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-500 dark:hover:text-red-400">&times;</button>
        </div>
      )}

      {/* Configuration Section */}
      {!result && (
        <div className="space-y-6">
          {/* Crisis Period Selector */}
          <div>
            <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-3">
              Crisis Period
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {crisisPeriods.map((crisis) => (
                <button
                  key={crisis.id}
                  onClick={() => { setSelectedCrisis(crisis.id); setResult(null); }}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedCrisis === crisis.id
                      ? "bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30"
                      : "bg-white border-stone-200 hover:border-stone-300 dark:bg-slate-900/30 dark:border-slate-700/30 dark:hover:border-slate-600/50"
                  }`}
                >
                  <div className={`text-sm font-semibold mb-1 ${selectedCrisis === crisis.id ? "text-red-700 dark:text-red-400" : "text-stone-700 dark:text-slate-300"}`}>
                    {crisis.name}
                  </div>
                  <div className="text-[10px] font-mono text-stone-400 dark:text-slate-500 mb-2">
                    {crisis.start_date} → {crisis.end_date} · {crisis.trading_days} days
                  </div>
                  <div className="text-xs text-stone-500 dark:text-slate-500 line-clamp-2">
                    {crisis.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Portfolio Presets */}
          <div>
            <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-3">
              Portfolio Preset
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PORTFOLIO_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handlePreset(key)}
                  className="px-4 py-2 rounded-lg text-xs font-mono border bg-white border-stone-200 text-stone-600 hover:text-red-600 hover:border-red-300 dark:bg-slate-800/50 dark:border-slate-700/30 dark:text-slate-400 dark:hover:text-red-400 dark:hover:border-red-500/30 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Asset Weights */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider">
                Asset Allocation
              </label>
              <span className={`text-xs font-mono font-semibold ${Math.abs(totalWeight - 100) < 0.5 ? "text-green-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                Total: {totalWeight.toFixed(0)}%
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {availableAssets.map((asset) => {
                const isAvailable = availableForCrisis.includes(asset.ticker);
                const color = ASSET_COLORS[asset.ticker];
                return (
                  <div key={asset.ticker} className={`bg-white border rounded-xl p-3 dark:bg-slate-900/30 ${isAvailable ? "border-stone-200 dark:border-slate-700/30" : "border-stone-100 dark:border-slate-800/20 opacity-50"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-mono font-bold ${color?.text ?? "text-stone-600 dark:text-slate-300"}`}>{asset.ticker}</span>
                      <span className="text-[10px] text-stone-400 dark:text-slate-600">{asset.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={portfolio[asset.ticker] ?? 0}
                        onChange={(e) => handleWeightChange(asset.ticker, Number(e.target.value))}
                        disabled={!isAvailable}
                        className="flex-1 accent-red-500 dark:accent-red-400"
                      />
                      <span className="text-xs font-mono text-stone-700 dark:text-slate-300 w-10 text-right">{portfolio[asset.ticker] ?? 0}%</span>
                    </div>
                    {!isAvailable && (
                      <div className="text-[10px] text-amber-500 mt-1">Not available in this period</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Simulation Settings */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">
                Simulations: <span className="text-red-600 dark:text-red-400">{numSimulations}</span>
              </label>
              <input type="range" min={50} max={2000} step={50} value={numSimulations} onChange={(e) => setNumSimulations(Number(e.target.value))} className="w-full accent-red-500 dark:accent-red-400" />
            </div>
            <div>
              <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">
                Initial Investment
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-slate-500 text-sm">$</span>
                <input type="number" value={initialInvestment} onChange={(e) => setInitialInvestment(Number(e.target.value))} min={1000} step={10000} className="w-full bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/50 rounded-xl pl-7 pr-4 py-2.5 text-sm text-stone-900 dark:text-slate-200 font-mono focus:outline-none focus:border-red-400 dark:focus:border-red-500/50" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">
                Model
              </label>
              <div className="flex gap-2">
                {(["gbm", "merton"] as const).map((m) => (
                  <button key={m} onClick={() => setModel(m)} className={`flex-1 py-2.5 rounded-lg text-xs font-mono font-semibold uppercase transition-all ${
                    model === m
                      ? "bg-red-50 border border-red-200 text-red-700 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-400"
                      : "bg-white border border-stone-200 text-stone-500 dark:bg-slate-800/50 dark:border-slate-700/30 dark:text-slate-500"
                  }`}>
                    {m === "gbm" ? "GBM" : "Merton"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">
                Rebalancing
              </label>
              <button
                onClick={() => setRebalance(!rebalance)}
                className={`w-full py-2.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  rebalance
                    ? "bg-red-50 border border-red-200 text-red-700 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-400"
                    : "bg-white border border-stone-200 text-stone-500 dark:bg-slate-800/50 dark:border-slate-700/30 dark:text-slate-500"
                }`}
              >
                {rebalance ? "Daily Rebalance" : "Buy & Hold"}
              </button>
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={handleRunBacktest}
            disabled={isLoading || totalWeight < 1}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 dark:from-red-500 dark:to-rose-400 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-red-500 hover:to-rose-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Running Backtest...</>
            ) : (
              <><Play className="w-4 h-4" />Run Crisis Backtest</>
            )}
          </button>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div>
          {/* Crisis Summary Banner */}
          <div className="bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-red-700 dark:text-red-400">{result.crisis.name}</h3>
                <p className="text-xs text-red-600/70 dark:text-red-400/60 font-mono mt-1">
                  {result.crisis.start_date} → {result.crisis.end_date} · {result.crisis.trading_days} trading days
                </p>
                <p className="text-xs text-stone-500 dark:text-slate-400 mt-2 max-w-2xl">{result.crisis.description}</p>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono text-stone-400 dark:text-slate-500">
                  {result.config.model === "merton" ? "Merton JD" : "GBM"} · {result.config.num_simulations} sims
                </div>
                <div className="text-xs font-mono text-stone-400 dark:text-slate-500">
                  {result.config.rebalance ? "Daily rebalance" : "Buy & hold"}
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <MetricCard
              label="Median Final Value"
              value={formatCurrency(result.statistics.final_value_median)}
              sub={`${result.statistics.total_return_pct > 0 ? "+" : ""}${result.statistics.total_return_pct}% return`}
              color={result.statistics.total_return_pct >= 0 ? "emerald" : "red"}
              icon={<TrendingUp className="w-4 h-4" />}
            />
            <MetricCard
              label="Max Drawdown"
              value={`${result.statistics.max_drawdown_pct.toFixed(1)}%`}
              sub={`P95: ${result.statistics.max_drawdown_p95.toFixed(1)}%`}
              color="red"
              icon={<TrendingDown className="w-4 h-4" />}
            />
            <MetricCard
              label="Sharpe Ratio"
              value={result.statistics.sharpe_ratio.toFixed(2)}
              sub={`Sortino: ${result.statistics.sortino_ratio.toFixed(2)}`}
              color="cyan"
              icon={<Activity className="w-4 h-4" />}
            />
            <MetricCard
              label="Recovery"
              value={result.statistics.recovery_days !== null ? `${result.statistics.recovery_days}d` : "No recovery"}
              sub={`Calmar: ${result.statistics.calmar_ratio.toFixed(2)}`}
              color={result.statistics.recovery_days !== null ? "amber" : "pink"}
              icon={<Clock className="w-4 h-4" />}
            />
          </div>

          {/* Result Tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto">
            {([
              { key: "equity" as const, label: "Equity Curve" },
              { key: "drawdown" as const, label: "Drawdown" },
              { key: "assets" as const, label: "Assets" },
              { key: "paths" as const, label: "Sample Paths" },
              { key: "returns" as const, label: "Returns" },
              { key: "details" as const, label: "Details" },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? "bg-red-50 border border-red-200 text-red-700 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-400"
                    : "text-stone-500 hover:text-stone-700 dark:text-slate-500 dark:hover:text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/30 rounded-xl p-6 mb-6">
            {activeTab === "equity" && <EquityCurveTab result={result} chartGrid={chartGrid} chartAxis={chartAxis} chartTooltipBg={chartTooltipBg} chartTooltipBorder={chartTooltipBorder} medianColor={medianColor} isDark={isDark} />}
            {activeTab === "drawdown" && <DrawdownTab result={result} chartGrid={chartGrid} chartAxis={chartAxis} chartTooltipBg={chartTooltipBg} chartTooltipBorder={chartTooltipBorder} isDark={isDark} />}
            {activeTab === "assets" && <AssetsTab result={result} chartGrid={chartGrid} chartAxis={chartAxis} chartTooltipBg={chartTooltipBg} chartTooltipBorder={chartTooltipBorder} />}
            {activeTab === "paths" && <SamplePathsTab result={result} chartGrid={chartGrid} chartAxis={chartAxis} chartTooltipBg={chartTooltipBg} chartTooltipBorder={chartTooltipBorder} pathColors={pathColors} />}
            {activeTab === "returns" && <ReturnsTab result={result} chartGrid={chartGrid} chartAxis={chartAxis} chartTooltipBg={chartTooltipBg} chartTooltipBorder={chartTooltipBorder} isDark={isDark} />}
            {activeTab === "details" && <DetailsTab result={result} />}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button onClick={handleReset} className="px-6 py-3 rounded-xl border border-stone-200 text-stone-500 hover:text-stone-700 dark:border-slate-700/50 dark:text-slate-400 dark:hover:text-slate-200 transition-colors text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />New Backtest
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric Card (reusable)
// ---------------------------------------------------------------------------

function MetricCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub: string; color: string; icon: React.ReactNode;
}) {
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

// ---------------------------------------------------------------------------
// Tab: Equity Curve
// ---------------------------------------------------------------------------

interface ChartProps {
  result: BacktestResponse;
  chartGrid: string;
  chartAxis: string;
  chartTooltipBg: string;
  chartTooltipBorder: string;
  medianColor?: string;
  isDark?: boolean;
  pathColors?: string[];
}

function EquityCurveTab({ result, chartGrid, chartAxis, chartTooltipBg, chartTooltipBorder, medianColor, isDark }: ChartProps) {
  const outerBandColor = isDark ? "#ef4444" : "#dc2626";

  const data = result.equity_percentiles.map((p) => ({
    day: p.day, p5: p.p5, p25: p.p25, median: p.median, p75: p.p75, p95: p.p95,
  }));

  return (
    <div>
      <h3 className="text-sm font-mono font-semibold text-stone-500 dark:text-slate-400 mb-1">Portfolio Equity Curve</h3>
      <p className="text-xs text-stone-400 dark:text-slate-600 mb-4">Percentile bands across {result.config.num_simulations} simulations</p>
      <ResponsiveContainer width="100%" height={380}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="btOuterBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={outerBandColor} stopOpacity={0.1} />
              <stop offset="95%" stopColor={outerBandColor} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="btInnerBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
          <XAxis dataKey="day" stroke={chartAxis} tick={{ fontSize: 11 }} label={{ value: "Trading Day", position: "insideBottom", offset: -5, fill: chartAxis, fontSize: 11 }} />
          <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
          <Tooltip contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => [formatCurrency(value), ""]} labelFormatter={(label) => `Day ${label}`} />
          <Area type="monotone" dataKey="p95" stroke="none" fill="url(#btOuterBand)" name="P95" />
          <Area type="monotone" dataKey="p75" stroke="none" fill="url(#btInnerBand)" name="P75" />
          <Area type="monotone" dataKey="p25" stroke="none" fill="url(#btInnerBand)" name="P25" />
          <Area type="monotone" dataKey="p5" stroke="none" fill={isDark ? "#020617" : "#fafaf9"} name="P5" />
          <Line type="monotone" dataKey="median" stroke={medianColor} strokeWidth={2} dot={false} name="Median" />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Drawdown
// ---------------------------------------------------------------------------

function DrawdownTab({ result, chartGrid, chartAxis, chartTooltipBg, chartTooltipBorder, isDark }: ChartProps) {
  const data = result.drawdown_percentiles.map((d) => ({
    day: d.day, median: -d.median, p75: -d.p75, p95: -d.p95,
  }));

  return (
    <div>
      <h3 className="text-sm font-mono font-semibold text-stone-500 dark:text-slate-400 mb-1">Portfolio Drawdown</h3>
      <p className="text-xs text-stone-400 dark:text-slate-600 mb-4">Peak-to-trough decline over time (negative = loss)</p>
      <ResponsiveContainer width="100%" height={380}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="btDDFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
          <XAxis dataKey="day" stroke={chartAxis} tick={{ fontSize: 11 }} />
          <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
          <Tooltip contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => [`${value.toFixed(2)}%`, ""]} labelFormatter={(label) => `Day ${label}`} />
          <Area type="monotone" dataKey="p95" stroke="none" fill="url(#btDDFill)" name="P95 DD" />
          <Line type="monotone" dataKey="p75" stroke={isDark ? "#fb923c" : "#ea580c"} strokeWidth={1} dot={false} strokeDasharray="4 4" name="P75 DD" />
          <Line type="monotone" dataKey="median" stroke={isDark ? "#ef4444" : "#dc2626"} strokeWidth={2} dot={false} name="Median DD" />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Per-Asset Breakdown
// ---------------------------------------------------------------------------

function AssetsTab({ result, chartGrid, chartAxis, chartTooltipBg, chartTooltipBorder }: ChartProps) {
  // Build comparison chart data from asset curves
  const maxLen = Math.max(...result.asset_curves.map((a) => a.median_curve.length));
  const assetChartData: Record<string, number | string>[] = [];
  for (let t = 0; t < maxLen; t++) {
    const row: Record<string, number | string> = { day: t };
    result.asset_curves.forEach((a) => {
      if (t < a.median_curve.length) row[a.ticker] = a.median_curve[t];
    });
    assetChartData.push(row);
  }

  return (
    <div>
      <h3 className="text-sm font-mono font-semibold text-stone-500 dark:text-slate-400 mb-1">Per-Asset Performance</h3>
      <p className="text-xs text-stone-400 dark:text-slate-600 mb-4">Median equity curve for each asset (dollar-weighted)</p>
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={assetChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
          <XAxis dataKey="day" stroke={chartAxis} tick={{ fontSize: 11 }} />
          <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
          <Tooltip contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => [formatCurrency(value), ""]} labelFormatter={(label) => `Day ${label}`} />
          {result.asset_curves.map((a) => (
            <Line key={a.ticker} type="monotone" dataKey={a.ticker} stroke={ASSET_COLORS[a.ticker]?.line ?? "#94a3b8"} strokeWidth={2} dot={false} name={`${a.ticker} (${a.allocation_pct}%)`} />
          ))}
          <Legend wrapperStyle={{ fontSize: "11px" }} />
        </LineChart>
      </ResponsiveContainer>

      {/* Asset summary table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-stone-500 dark:text-slate-500 border-b border-stone-200 dark:border-slate-700/30">
              <th className="text-left pb-2 pr-4">Asset</th>
              <th className="text-right pb-2 pr-4">Alloc</th>
              <th className="text-right pb-2 pr-4">Final Median</th>
              <th className="text-right pb-2">Return</th>
            </tr>
          </thead>
          <tbody>
            {result.asset_curves.map((a) => (
              <tr key={a.ticker} className="border-b border-stone-100 dark:border-slate-800/50">
                <td className={`py-2 pr-4 font-bold ${ASSET_COLORS[a.ticker]?.text ?? "text-stone-600 dark:text-slate-300"}`}>
                  {a.ticker} <span className="text-stone-400 dark:text-slate-600 font-normal">{a.name}</span>
                </td>
                <td className="text-right py-2 pr-4 text-stone-600 dark:text-slate-300">{a.allocation_pct}%</td>
                <td className="text-right py-2 pr-4 text-stone-600 dark:text-slate-300">{formatCurrency(a.final_median)}</td>
                <td className={`text-right py-2 font-bold ${a.final_return_pct >= 0 ? "text-green-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {a.final_return_pct > 0 ? "+" : ""}{a.final_return_pct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Sample Paths
// ---------------------------------------------------------------------------

function SamplePathsTab({ result, chartGrid, chartAxis, chartTooltipBg, chartTooltipBorder, pathColors }: ChartProps) {
  const data: Record<string, number | string>[] = [];
  if (result.sample_paths.length > 0) {
    const numSteps = result.sample_paths[0].length;
    for (let t = 0; t < numSteps; t++) {
      const row: Record<string, number | string> = { day: result.sample_paths[0][t].day };
      result.sample_paths.forEach((path, i) => { row[`path_${i}`] = path[t].value; });
      data.push(row);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-mono font-semibold text-stone-500 dark:text-slate-400 mb-1">Sample Simulation Paths</h3>
      <p className="text-xs text-stone-400 dark:text-slate-600 mb-4">{result.sample_paths.length} individual portfolio trajectories</p>
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
          <XAxis dataKey="day" stroke={chartAxis} tick={{ fontSize: 11 }} />
          <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
          <Tooltip contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => [formatCurrency(value), ""]} labelFormatter={(label) => `Day ${label}`} />
          {result.sample_paths.map((_, i) => (
            <Line key={i} type="monotone" dataKey={`path_${i}`} stroke={pathColors?.[i % (pathColors?.length ?? 6)] ?? "#94a3b8"} strokeWidth={1.5} dot={false} strokeOpacity={0.7} name={`Path ${i + 1}`} />
          ))}
          <Legend wrapperStyle={{ fontSize: "11px" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Returns Distribution
// ---------------------------------------------------------------------------

function ReturnsTab({ result, chartGrid, chartAxis, chartTooltipBg, chartTooltipBorder, isDark }: ChartProps) {
  return (
    <div>
      <h3 className="text-sm font-mono font-semibold text-stone-500 dark:text-slate-400 mb-1">Daily Returns Distribution</h3>
      <p className="text-xs text-stone-400 dark:text-slate-600 mb-4">
        Histogram of daily portfolio returns. Best day: {result.statistics.best_day_pct > 0 ? "+" : ""}{result.statistics.best_day_pct}%, Worst: {result.statistics.worst_day_pct}%
      </p>
      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={result.returns_histogram}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
          <XAxis dataKey="bin" stroke={chartAxis} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
          <YAxis stroke={chartAxis} tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => [value, "Days"]} labelFormatter={(label) => `${label}%`} />
          <Bar dataKey="count" name="Frequency">
            {result.returns_histogram.map((entry, i) => (
              <Cell key={i} fill={entry.is_negative ? (isDark ? "#ef4444" : "#dc2626") : (isDark ? "#10b981" : "#16a34a")} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Detailed Statistics
// ---------------------------------------------------------------------------

function DetailsTab({ result }: { result: BacktestResponse }) {
  const stats = result.statistics;

  const sections = [
    {
      title: "Returns",
      rows: [
        { label: "Total Return (Median)", value: `${stats.total_return_pct > 0 ? "+" : ""}${stats.total_return_pct}%` },
        { label: "Annualized Return", value: `${stats.annualized_return_pct > 0 ? "+" : ""}${stats.annualized_return_pct}%` },
        { label: "Annualized Volatility", value: `${stats.volatility_ann_pct}%` },
      ],
    },
    {
      title: "Terminal Value",
      rows: [
        { label: "Median", value: formatCurrency(stats.final_value_median) },
        { label: "5th Percentile (Bear)", value: formatCurrency(stats.final_value_p5) },
        { label: "95th Percentile (Bull)", value: formatCurrency(stats.final_value_p95) },
      ],
    },
    {
      title: "Risk Metrics",
      rows: [
        { label: "Sharpe Ratio", value: stats.sharpe_ratio.toFixed(3) },
        { label: "Sortino Ratio", value: stats.sortino_ratio.toFixed(3) },
        { label: "Calmar Ratio", value: stats.calmar_ratio.toFixed(3) },
        { label: "VaR (95%)", value: formatCurrency(stats.var_95) },
        { label: "VaR (99%)", value: formatCurrency(stats.var_99) },
      ],
    },
    {
      title: "Drawdown & Recovery",
      rows: [
        { label: "Max Drawdown (Median)", value: `${stats.max_drawdown_pct}%` },
        { label: "Max Drawdown (P95)", value: `${stats.max_drawdown_p95}%` },
        { label: "Recovery (Median Path)", value: stats.recovery_days !== null ? `${stats.recovery_days} trading days` : "Did not recover" },
      ],
    },
    {
      title: "Daily Statistics",
      rows: [
        { label: "Best Day", value: `${stats.best_day_pct > 0 ? "+" : ""}${stats.best_day_pct}%` },
        { label: "Worst Day", value: `${stats.worst_day_pct}%` },
        { label: "Positive Days", value: `${stats.positive_days_pct}%` },
      ],
    },
  ];

  return (
    <div>
      <h3 className="text-sm font-mono font-semibold text-stone-500 dark:text-slate-400 mb-4">Detailed Backtest Statistics</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section) => (
          <div key={section.title} className="bg-stone-50 border border-stone-200 dark:bg-slate-800/30 dark:border-slate-700/30 rounded-xl p-4">
            <h4 className="text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-3">{section.title}</h4>
            {section.rows.map((row) => (
              <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-stone-100 dark:border-slate-800/30 last:border-0">
                <span className="text-xs text-stone-500 dark:text-slate-500">{row.label}<InfoTooltip text={row.label} /></span>
                <span className="text-xs font-mono text-stone-900 dark:text-slate-200 font-semibold">{row.value}</span>
              </div>
            ))}
          </div>
        ))}

        {/* Portfolio Composition */}
        <div className="bg-stone-50 border border-stone-200 dark:bg-slate-800/30 dark:border-slate-700/30 rounded-xl p-4">
          <h4 className="text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-3">Portfolio Composition</h4>
          {result.portfolio.map((a) => (
            <div key={a.ticker} className="flex justify-between items-center py-1.5 border-b border-stone-100 dark:border-slate-800/30 last:border-0">
              <span className={`text-xs font-mono font-bold ${ASSET_COLORS[a.ticker]?.text ?? "text-stone-600 dark:text-slate-300"}`}>
                {a.ticker} <span className="font-normal text-stone-400 dark:text-slate-600">{a.name}</span>
              </span>
              <span className="text-xs font-mono text-stone-900 dark:text-slate-200 font-semibold">{a.allocation_pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
