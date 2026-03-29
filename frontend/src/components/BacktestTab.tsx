import { useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { BacktestPanel } from "./BacktestPanel";
import { calibrateScenario, runScenario } from "../api";
import type { AssetParams, BacktestResponse } from "../types/portfolio";

interface Props {
  assets: AssetParams[];
  lastBacktest: { crisisId: string; config: any; result: BacktestResponse } | null;
  onBacktestComplete: (crisisId: string, config: any, result: BacktestResponse) => void;
  onUseInPortfolio: (assets: AssetParams[]) => void;
}

export function BacktestTab({ assets }: Props) {
  const [mode, setMode] = useState<"historical" | "custom">("historical");
  const [scenarioDesc, setScenarioDesc] = useState("");
  const [tradingDays, setTradingDays] = useState(60);
  const [calibrating, setCalibrating] = useState(false);
  const [running, setRunning] = useState(false);
  const [calibrated, setCalibrated] = useState<any>(null);
  const [scenarioResult, setScenarioResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalibrate = async () => {
    setCalibrating(true); setError(null); setCalibrated(null); setScenarioResult(null);
    try {
      const tickers = assets.map(a => a.ticker);
      const result = await calibrateScenario({ description: scenarioDesc, asset_tickers: tickers, trading_days: tradingDays });
      setCalibrated(result.scenario);
    } catch (e) { setError(e instanceof Error ? e.message : "Calibration failed"); }
    finally { setCalibrating(false); }
  };

  const handleRun = async () => {
    if (!calibrated) return;
    setRunning(true); setError(null);
    try {
      const portfolio = assets.map(a => ({ ticker: a.ticker, allocation_pct: a.allocation_pct }));
      const result = await runScenario({ scenario: calibrated, portfolio, num_simulations: 500, initial_investment: 100000, model: "merton", rebalance: false, seed: 42 });
      setScenarioResult(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Scenario run failed"); }
    finally { setRunning(false); }
  };

  return (
    <div>
      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6 max-w-4xl mx-auto">
        <button onClick={() => setMode("historical")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === "historical"
            ? "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/30"
            : "bg-white text-stone-500 border border-stone-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/50"}`}>
          Historical Crises
        </button>
        <button onClick={() => setMode("custom")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === "custom"
            ? "bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/30"
            : "bg-white text-stone-500 border border-stone-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/50"}`}>
          Custom Scenario
        </button>
      </div>

      {mode === "historical" ? (
        <BacktestPanel />
      ) : (
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-50 border border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/20 mb-4">
              <FlaskConical className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400 tracking-wide">CUSTOM SCENARIO</span>
            </div>
            <h2 className="text-2xl font-bold text-stone-900 dark:text-slate-100 mb-2">What-If Scenario Builder</h2>
            <p className="text-stone-500 dark:text-slate-400 text-sm">Describe a hypothetical crisis. AI calibrates simulation parameters.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">Scenario Description</label>
              <textarea value={scenarioDesc} onChange={e => setScenarioDesc(e.target.value)} placeholder="What if inflation hits 8%, Fed hikes 300bps, and tech earnings disappoint by 40%?" rows={3}
                className="w-full bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/50 rounded-xl px-4 py-3 text-stone-900 dark:text-slate-200 placeholder-stone-400 dark:placeholder-slate-600 text-sm focus:outline-none focus:border-violet-400 dark:focus:border-violet-500/50 resize-none" />
            </div>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">Duration (trading days)</label>
                <input type="number" value={tradingDays} onChange={e => setTradingDays(Number(e.target.value))} min={5} max={500}
                  className="w-full bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-stone-900 dark:text-slate-200 font-mono focus:outline-none focus:border-violet-400" />
              </div>
              <button onClick={handleCalibrate} disabled={calibrating || scenarioDesc.length < 10}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-500 dark:to-purple-500 text-white font-semibold text-sm disabled:opacity-40 transition-all">
                {calibrating ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Calibrating...</> : "Calibrate with AI"}
              </button>
            </div>

            {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm">{error}</div>}

            {calibrated && (
              <div className="bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 rounded-xl p-4">
                <h4 className="text-sm font-mono font-semibold text-violet-700 dark:text-violet-400 mb-3">{calibrated.name}</h4>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {Object.entries(calibrated.assets || {}).map(([ticker, params]: [string, any]) => (
                    <div key={ticker} className="bg-white dark:bg-slate-900/50 border border-stone-200 dark:border-slate-700/30 rounded-lg p-2">
                      <div className="font-mono font-bold text-xs text-stone-900 dark:text-slate-200">{ticker}</div>
                      <div className="text-[10px] text-stone-400 dark:text-slate-500 mt-1">
                        drift: {params.drift?.toFixed(2)} · vol: {params.volatility?.toFixed(2)} · jumps: {params.jump_intensity?.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={handleRun} disabled={running}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-semibold text-sm disabled:opacity-40">
                  {running ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Running Scenario...</> : "Run Scenario Simulation"}
                </button>
              </div>
            )}

            {scenarioResult && (
              <div className="bg-white dark:bg-slate-900/50 border border-stone-200 dark:border-slate-700/30 rounded-xl p-4">
                <h4 className="text-sm font-mono font-semibold text-stone-500 dark:text-slate-400 mb-3">Scenario Results</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="text-center"><div className="text-xs text-stone-400 dark:text-slate-500">Total Return</div><div className="font-mono font-bold text-stone-900 dark:text-slate-200">{scenarioResult.statistics?.total_return_pct?.toFixed(1)}%</div></div>
                  <div className="text-center"><div className="text-xs text-stone-400 dark:text-slate-500">Max Drawdown</div><div className="font-mono font-bold text-stone-900 dark:text-slate-200">{scenarioResult.statistics?.max_drawdown_pct?.toFixed(1)}%</div></div>
                  <div className="text-center"><div className="text-xs text-stone-400 dark:text-slate-500">Sharpe</div><div className="font-mono font-bold text-stone-900 dark:text-slate-200">{scenarioResult.statistics?.sharpe_ratio?.toFixed(2)}</div></div>
                  <div className="text-center"><div className="text-xs text-stone-400 dark:text-slate-500">Recovery</div><div className="font-mono font-bold text-stone-900 dark:text-slate-200">{scenarioResult.statistics?.recovery_days ?? "\u2014"} days</div></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
