import { useState } from "react";
import { PortfolioDescriber } from "./components/PortfolioDescriber";
import { AnalysisReview } from "./components/AnalysisReview";
import { SimulationConfig } from "./components/SimulationConfig";
import { SimulationDashboard } from "./components/SimulationDashboard";
import { analyzePortfolio, runSimulation } from "./api";
import type { AppStep, AssetParams, AnalyzeResponse, SimulateResponse } from "./types/portfolio";

function App() {
  const [step, setStep] = useState<AppStep>("describe");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State passed between steps
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [assets, setAssets] = useState<AssetParams[]>([]);
  const [correlationMatrix, setCorrelationMatrix] = useState<number[][]>([]);
  const [simulationResult, setSimulationResult] = useState<SimulateResponse | null>(null);

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
              MC
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100">Portfolio Monte Carlo</h1>
              <p className="text-xs text-slate-500">Enterprise Simulator</p>
            </div>
          </div>

          {/* Step Progress */}
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-colors ${
                  i <= currentIdx
                    ? i === currentIdx
                      ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                      : "text-cyan-500/60"
                    : "text-slate-600"
                }`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i < currentIdx ? "bg-cyan-500 text-slate-950" : i === currentIdx ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-800 text-slate-600"
                  }`}>
                    {i < currentIdx ? "\u2713" : s.num}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-6 h-px mx-1 ${i < currentIdx ? "bg-cyan-500/40" : "bg-slate-700/30"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="max-w-6xl mx-auto px-6 mt-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400">
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
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
        {step === "simulate" && simulationResult && (
          <SimulationDashboard result={simulationResult} onBack={() => setStep("configure")} onRestart={handleRestart} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/30 py-6 text-center text-xs text-slate-600 font-mono">
        Monte Carlo Portfolio Simulator &middot; GBM & Merton Jump Diffusion
      </footer>
    </div>
  );
}

export default App;
