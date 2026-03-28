import { useState } from "react";
import { Sun, Moon, Plus, ChevronDown, Copy, Trash2 } from "lucide-react";
import { ThemeProvider, useTheme } from "./components/ThemeProvider";
import { useExperiment } from "./store/useExperiment";
import { PortfolioBar } from "./components/PortfolioBar";
import { WorkspaceTabs } from "./components/WorkspaceTabs";
import { BuildTab } from "./components/BuildTab";
import { SimulateTab } from "./components/SimulateTab";
import { BacktestTab } from "./components/BacktestTab";
import { OptimizeTab } from "./components/OptimizeTab";
import { ExecuteTab } from "./components/ExecuteTab";
import { track } from "./telemetry";
import type { AppTab } from "./types/portfolio";

function AppContent() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<AppTab>("build");
  const [isLoading] = useState(false);
  const [showExperiments, setShowExperiments] = useState(false);

  const {
    experiment, allExperiments, isLoaded,
    updatePortfolio, saveSimulation, saveOptimization, saveBacktest,
    applyOptimizedWeights, switchExperiment, createExperiment,
    duplicateExperiment, deleteCurrentExperiment,
  } = useExperiment();

  if (!isLoaded || !experiment) {
    return <div className="min-h-screen bg-stone-50 dark:bg-slate-950 flex items-center justify-center text-stone-400 dark:text-slate-500">Loading...</div>;
  }

  const hasPortfolio = experiment.portfolio.assets.length > 0;
  const hasSimulation = !!experiment.lastSimulation;

  const handleTabChange = (tab: AppTab) => {
    setActiveTab(tab);
    track("tab_switched", { tab });
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-slate-950 text-stone-900 dark:text-slate-100 transition-colors">
      {/* Header */}
      <header className="border-b border-stone-200 dark:border-slate-800/50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 dark:from-cyan-400 dark:to-blue-500 flex items-center justify-center text-white font-bold text-sm">MC</div>
              <div>
                <h1 className="text-sm font-bold text-stone-900 dark:text-slate-100">Portfolio Monte Carlo</h1>
                <p className="text-xs text-stone-400 dark:text-slate-500">Enterprise Simulator</p>
              </div>
            </div>

            {/* Experiment Selector */}
            <div className="relative ml-4">
              <button
                onClick={() => setShowExperiments(!showExperiments)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-700/50 text-sm"
              >
                <span className="font-medium text-stone-700 dark:text-slate-300 max-w-[200px] truncate">{experiment.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 dark:text-slate-500" />
              </button>

              {showExperiments && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700/50 rounded-xl shadow-xl z-50 py-2">
                  {allExperiments.map(exp => (
                    <button
                      key={exp.id}
                      onClick={() => { switchExperiment(exp.id); setShowExperiments(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-stone-50 dark:hover:bg-slate-800/50 ${exp.id === experiment.id ? "bg-stone-50 dark:bg-slate-800/50 font-medium" : ""}`}
                    >
                      <div className="text-stone-700 dark:text-slate-300 truncate">{exp.name}</div>
                      <div className="text-xs text-stone-400 dark:text-slate-500">
                        {exp.portfolio.assets.length} assets &middot; {new Date(exp.updatedAt).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                  <div className="border-t border-stone-100 dark:border-slate-800 mt-1 pt-1">
                    <button onClick={() => { createExperiment(); setShowExperiments(false); }} className="w-full text-left px-4 py-2 text-sm text-teal-600 dark:text-cyan-400 hover:bg-stone-50 dark:hover:bg-slate-800/50 flex items-center gap-2">
                      <Plus className="w-3.5 h-3.5" /> New Experiment
                    </button>
                    <button onClick={() => { duplicateExperiment(); setShowExperiments(false); }} className="w-full text-left px-4 py-2 text-sm text-stone-500 dark:text-slate-400 hover:bg-stone-50 dark:hover:bg-slate-800/50 flex items-center gap-2">
                      <Copy className="w-3.5 h-3.5" /> Duplicate Current
                    </button>
                    {allExperiments.length > 1 && (
                      <button onClick={() => { deleteCurrentExperiment(); setShowExperiments(false); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-stone-50 dark:hover:bg-slate-800/50 flex items-center gap-2">
                        <Trash2 className="w-3.5 h-3.5" /> Delete Current
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <button onClick={toggleTheme} className="p-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 dark:border-slate-700/50 dark:bg-slate-800/50 dark:hover:bg-slate-800 transition-colors" aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="w-4 h-4 text-slate-400" /> : <Moon className="w-4 h-4 text-stone-500" />}
          </button>
        </div>
      </header>

      {/* Portfolio Bar */}
      {hasPortfolio && (
        <PortfolioBar
          assets={experiment.portfolio.assets}
          totalAllocation={experiment.portfolio.assets.reduce((s, a) => s + a.allocation_pct, 0)}
          onEditClick={() => setActiveTab("build")}
        />
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 pt-4">
        <WorkspaceTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          hasPortfolio={hasPortfolio}
          hasSimulation={hasSimulation}
        />
      </div>

      {/* Tab Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "build" && (
          <BuildTab
            assets={experiment.portfolio.assets}
            correlationMatrix={experiment.portfolio.correlationMatrix}
            description={experiment.portfolio.description}
            riskTolerance={experiment.portfolio.riskTolerance}
            onPortfolioChange={updatePortfolio}
            isLoading={isLoading}
          />
        )}
        {activeTab === "simulate" && (
          <SimulateTab
            assets={experiment.portfolio.assets}
            correlationMatrix={experiment.portfolio.correlationMatrix}
            lastSimulation={experiment.lastSimulation}
            onSimulationComplete={saveSimulation}
          />
        )}
        {activeTab === "backtest" && (
          <BacktestTab
            assets={experiment.portfolio.assets}
            lastBacktest={experiment.lastBacktest}
            onBacktestComplete={saveBacktest}
            onUseInPortfolio={(assets) => { updatePortfolio(assets, experiment.portfolio.correlationMatrix); setActiveTab("build"); }}
          />
        )}
        {activeTab === "optimize" && (
          <OptimizeTab
            assets={experiment.portfolio.assets}
            correlationMatrix={experiment.portfolio.correlationMatrix}
            lastSimulation={experiment.lastSimulation}
            lastOptimization={experiment.lastOptimization}
            onOptimizationComplete={saveOptimization}
            onApplyWeights={() => { applyOptimizedWeights(); setActiveTab("build"); }}
          />
        )}
        {activeTab === "execute" && (
          <ExecuteTab
            assets={experiment.portfolio.assets}
            investmentAmount={experiment.lastSimulation?.config.initialInvestment ?? 100000}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 dark:border-slate-800/30 py-6 text-center text-xs text-stone-400 dark:text-slate-600 font-mono">
        Portfolio Monte Carlo Simulator &middot; GBM & Merton Jump Diffusion
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
