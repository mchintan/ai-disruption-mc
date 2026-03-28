import { ArrowLeft, BarChart3, TrendingDown, TrendingUp, Activity, RefreshCw } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import type { SimulateResponse } from "../types/portfolio";

interface Props {
  result: SimulateResponse;
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

export function SimulationDashboard({ result, onBack, onRestart }: Props) {
  const { portfolio_percentiles, portfolio_risk_metrics: risk, portfolio_sample_paths, asset_results } = result;

  // Fan chart data
  const fanData = portfolio_percentiles.map((p) => ({
    year: p.year,
    p10: p.p10,
    p25: p.p25,
    median: p.median,
    p75: p.p75,
    p90: p.p90,
    mean: p.mean,
    band_outer_low: p.p10,
    band_outer_high: p.p90,
    band_inner_low: p.p25,
    band_inner_high: p.p75,
  }));

  // Sample paths data
  const samplePathData: Record<string, number | string>[] = [];
  if (portfolio_sample_paths.length > 0) {
    const numSteps = portfolio_sample_paths[0].length;
    for (let t = 0; t < numSteps; t++) {
      const row: Record<string, number | string> = { year: portfolio_sample_paths[0][t].year };
      portfolio_sample_paths.forEach((path, i) => {
        row[`path_${i}`] = path[t].value;
      });
      samplePathData.push(row);
    }
  }

  const pathColors = ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899", "#3b82f6"];

  const terminalMedian = portfolio_percentiles[portfolio_percentiles.length - 1]?.median ?? 0;
  const totalReturn = ((terminalMedian - result.initial_investment) / result.initial_investment) * 100;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-semibold text-emerald-400 tracking-wide">
            STEP 4 — SIMULATION RESULTS
          </span>
        </div>
        <h2 className="text-2xl font-bold text-slate-100 mb-3">
          Monte Carlo Results
        </h2>
        <p className="text-slate-400 text-sm">
          {result.model_used === "merton" ? "Merton Jump Diffusion" : "Geometric Brownian Motion"} · {result.num_simulations.toLocaleString()} simulations · {result.num_years} years
        </p>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <MetricCard
          label="Median Terminal Value"
          value={formatCurrency(risk.median_terminal)}
          sub={`${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(1)}% return`}
          color={totalReturn >= 0 ? "emerald" : "red"}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <MetricCard
          label="VaR (95%)"
          value={formatCurrency(risk.var_95)}
          sub="Worst-case loss at 95% confidence"
          color="amber"
          icon={<TrendingDown className="w-4 h-4" />}
        />
        <MetricCard
          label="Sharpe Ratio"
          value={risk.sharpe_ratio.toFixed(2)}
          sub="Risk-adjusted return"
          color="cyan"
          icon={<Activity className="w-4 h-4" />}
        />
        <MetricCard
          label="Max Drawdown"
          value={formatPct(risk.max_drawdown)}
          sub="Worst peak-to-trough"
          color="pink"
          icon={<TrendingDown className="w-4 h-4" />}
        />
      </div>

      {/* Fan Chart */}
      <div className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-mono font-semibold text-slate-400 mb-4">Portfolio Percentile Bands</h3>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={fanData}>
            <defs>
              <linearGradient id="outerBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="innerBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 11 }} label={{ value: "Year", position: "insideBottom", offset: -5, fill: "#64748b", fontSize: 11 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
              formatter={(value: number) => [formatCurrency(value), ""]}
              labelFormatter={(label) => `Year ${label}`}
            />
            <Area type="monotone" dataKey="p90" stroke="none" fill="url(#outerBand)" name="P90" />
            <Area type="monotone" dataKey="p75" stroke="none" fill="url(#innerBand)" name="P75" />
            <Area type="monotone" dataKey="p25" stroke="none" fill="url(#innerBand)" name="P25" />
            <Area type="monotone" dataKey="p10" stroke="none" fill="#0f172a" name="P10" />
            <Line type="monotone" dataKey="median" stroke="#f59e0b" strokeWidth={2} dot={false} name="Median" />
            <Line type="monotone" dataKey="mean" stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Mean" />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Sample Paths Chart */}
      {samplePathData.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-mono font-semibold text-slate-400 mb-4">Sample Simulation Paths</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={samplePathData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
                formatter={(value: number) => [formatCurrency(value), ""]}
                labelFormatter={(label) => `Year ${label}`}
              />
              {portfolio_sample_paths.map((_, i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`path_${i}`}
                  stroke={pathColors[i % pathColors.length]}
                  strokeWidth={1.5}
                  dot={false}
                  strokeOpacity={0.7}
                  name={`Path ${i + 1}`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Risk Metrics Table */}
      <div className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-mono font-semibold text-slate-400 mb-4">Detailed Risk Metrics</h3>
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
        <div className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-mono font-semibold text-slate-400 mb-4">Per-Asset Results</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700/30">
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
                {asset_results.map((a, i) => {
                  const colors = ["text-cyan-400", "text-violet-400", "text-amber-400", "text-emerald-400", "text-pink-400", "text-blue-400"];
                  return (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className={`py-2 pr-4 font-bold ${colors[i % colors.length]}`}>{a.ticker}</td>
                      <td className="text-right py-2 pr-4 text-slate-300">{a.allocation_pct}%</td>
                      <td className="text-right py-2 pr-4 text-slate-300">{formatCurrency(a.risk_metrics.median_terminal)}</td>
                      <td className="text-right py-2 pr-4 text-slate-300">{formatPct(a.risk_metrics.expected_return)}</td>
                      <td className="text-right py-2 pr-4 text-slate-300">{formatPct(a.risk_metrics.volatility)}</td>
                      <td className="text-right py-2 pr-4 text-slate-300">{a.risk_metrics.sharpe_ratio.toFixed(2)}</td>
                      <td className="text-right py-2 text-slate-300">{formatPct(a.risk_metrics.max_drawdown)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors text-sm flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Reconfigure
        </button>
        <button
          onClick={onRestart}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-emerald-400 hover:to-teal-400 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Build New Portfolio
        </button>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color, icon }: { label: string; value: string; sub: string; color: string; icon: React.ReactNode }) {
  const colorClasses: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    pink: "text-pink-400 bg-pink-500/10 border-pink-500/20",
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
    <div className="flex justify-between items-center py-1.5 border-b border-slate-800/30">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-mono text-slate-200 font-semibold">{value}</span>
    </div>
  );
}
