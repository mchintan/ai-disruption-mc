import { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { ThemeProvider, useTheme } from "./components/ThemeProvider";
import { PortfolioDescriber } from "./components/PortfolioDescriber";
import { AnalysisReview } from "./components/AnalysisReview";
import { SimulationConfig } from "./components/SimulationConfig";
import { SimulationDashboard } from "./components/SimulationDashboard";
import { BacktestPanel } from "./components/BacktestPanel";
import { analyzePortfolio, runSimulation } from "./api";
import type { AppStep, AppMode, AssetParams, AnalyzeResponse, SimulateResponse } from "./types/portfolio";

function AppContent() {
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<AppMode>("simulate");
  const [step, setStep] = useState<AppStep>("describe");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [assets, setAssets] = useState<AssetParams[]>([]);
  const [correlationMatrix, setCorrelationMatrix] = useState<number[][]>([]);
  const [simulationResult, setSimulationResult] = useState<SimulateResponse | null>(null);
  const [simulationConfig, setSimulationConfig] = useState<{
    numSimulations: number;
    numYears: number;
    model: "gbm" | "merton";
    initialInvestment: number;
    seed: number | null;
  } | null>(null);

  const handleDescribe = async (description: string, riskTolerance: string, horizonYears: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await analyzePortfolio({ description, risk_tolerance: riskTolerance, horizon_years: horizonYears });
      setAnalysis(result);
      setAssets(result.assets);
      setCorrelationMatrix(result.correlation_matrix);
      setStep("analyze");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAnalysis = (confirmedAssets: AssetParams[], confirmedCorrelation: number[][]) => {
    setAssets(confirmedAssets);
    setCorrelationMatrix(confirmedCorrelation);
    setStep("configure");
  };

  const handleRunSimulation = async (config: {
    numSimulations: number;
    numYears: number;
    model: "gbm" | "merton";
    initialInvestment: number;
    seed: number | null;
  }) => {
    setIsLoading(true);
    setError(null);
    setSimulationConfig(config);
    try {
      const result = await runSimulation({
        assets,
        correlation_matrix: correlationMatrix,
        num_simulations: config.numSimulations,
        num_years: config.numYears,
        model: config.model,
        initial_investment: config.initialInvestment,
        seed: config.seed,
      });
      setSimulationResult(result);
      setStep("simulate");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestart = () => {
    setStep("describe");
    setAnalysis(null);
    setAssets([]);
    setCorrelationMatrix([]);
    setSimulationResult(null);
    setSimulationConfig(null);
    setError(null);
  };

  const steps: { key: AppStep; label: string; num: number }[] = [
    { key: "describe", label: "Describe", num: 1 },
    { key: "analyze", label: "Analyze", num: 2 },
    { key: "configure", label: "Configure", num: 3 },
    { key: "simulate", label: "Simulate", num: 4 },
  ];

  const stepOrder: AppStep[] = ["describe", "analyze", "configure", "simulate"];
  const currentIdx = stepOrder.indexOf(step);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 dark:border-slate-800/50 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 dark:from-cyan-400 dark:to-blue-500 flex items-center justify-center text-white font-bold text-sm">
              MC
            </div>
            <div>
              <h1 className="text-sm font-bold text-stone-900 dark:text-slate-100">Portfolio Monte Carlo</h1>
              <p className="text-xs text-stone-500 dark:text-slate-500">Enterprise Simulator</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Mode Switcher */}
            <div className="flex items-center bg-stone-100 dark:bg-slate-800/50 rounded-lg p-0.5">
              <button
                onClick={() => setMode("simulate")}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all ${
                  mode === "simulate"
                    ? "bg-white text-teal-700 shadow-sm dark:bg-slate-700 dark:text-cyan-400"
                    : "text-stone-500 hover:text-stone-700 dark:text-slate-500 dark:hover:text-slate-300"
                }`}
              >
                Forward Sim
              </button>
              <button
                onClick={() => setMode("backtest")}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all ${
                  mode === "backtest"
                    ? "bg-white text-red-700 shadow-sm dark:bg-slate-700 dark:text-red-400"
                    : "text-stone-500 hover:text-stone-700 dark:text-slate-500 dark:hover:text-slate-300"
                }`}
              >
                Stress Test
              </button>
            </div>

            {/* Step Progress (only in simulate mode) */}
            {mode === "simulate" && (
            <div className="flex items-center gap-1">
              {steps.map((s, i) => (
                <div key={s.key} className="flex items-center">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-colors ${
                    i <= currentIdx
                      ? i === currentIdx
                        ? "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-500/30"
                        : "text-teal-600/60 dark:text-cyan-500/60"
                      : "text-stone-400 dark:text-slate-600"
                  }`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      i < currentIdx
                        ? "bg-teal-600 text-white dark:bg-cyan-500 dark:text-slate-950"
                        : i === currentIdx
                        ? "bg-teal-100 text-teal-700 dark:bg-cyan-500/20 dark:text-cyan-400"
                        : "bg-stone-100 text-stone-400 dark:bg-slate-800 dark:text-slate-600"
                    }`}>
                      {i < currentIdx ? "\u2713" : s.num}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`w-6 h-px mx-1 ${i < currentIdx ? "bg-teal-400/40 dark:bg-cyan-500/40" : "bg-stone-200 dark:bg-slate-700/30"}`} />
                  )}
                </div>
              ))}
            </div>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 dark:border-slate-700/50 dark:bg-slate-800/50 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-slate-400" />
              ) : (
                <Moon className="w-4 h-4 text-stone-500" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="max-w-6xl mx-auto px-6 mt-4">
          <div className="bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-500 dark:hover:text-red-400">
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {mode === "backtest" ? (
          <BacktestPanel />
        ) : (
          <>
            {step === "describe" && (
              <PortfolioDescriber onSubmit={handleDescribe} isLoading={isLoading} />
            )}
            {step === "analyze" && analysis && (
              <AnalysisReview analysis={analysis} onConfirm={handleConfirmAnalysis} onBack={() => setStep("describe")} />
            )}
            {step === "configure" && (
              <SimulationConfig
                assets={assets}
                correlationMatrix={correlationMatrix}
                onRun={handleRunSimulation}
                onBack={() => setStep("analyze")}
                isLoading={isLoading}
              />
            )}
            {step === "simulate" && simulationResult && simulationConfig && (
              <SimulationDashboard
                result={simulationResult}
                simulationConfig={{
                  assets,
                  correlationMatrix,
                  ...simulationConfig,
                }}
                onBack={() => setStep("configure")}
                onRestart={handleRestart}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 dark:border-slate-800/30 py-6 text-center text-xs text-stone-400 dark:text-slate-600 font-mono">
        Monte Carlo Portfolio Simulator &middot; GBM & Merton Jump Diffusion
      </footer>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
