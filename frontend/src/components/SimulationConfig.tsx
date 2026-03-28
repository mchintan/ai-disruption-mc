import { useState } from "react";
import { ArrowRight, ArrowLeft, Settings, Loader2, Play } from "lucide-react";
import type { AssetParams } from "../types/portfolio";

interface Props {
  assets: AssetParams[];
  correlationMatrix: number[][];
  onRun: (config: {
    numSimulations: number;
    numYears: number;
    model: "gbm" | "merton";
    initialInvestment: number;
    seed: number | null;
  }) => void;
  onBack: () => void;
  isLoading: boolean;
}

export function SimulationConfig({ assets, onRun, onBack, isLoading }: Props) {
  const [numSimulations, setNumSimulations] = useState(500);
  const [numYears, setNumYears] = useState(10);
  const [model, setModel] = useState<"gbm" | "merton">("merton");
  const [initialInvestment, setInitialInvestment] = useState(100000);
  const [seed, setSeed] = useState<number | null>(42);

  const handleRun = () => {
    onRun({ numSimulations, numYears, model, initialInvestment, seed });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
          <Settings className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono font-semibold text-amber-400 tracking-wide">
            STEP 3 — CONFIGURE SIMULATION
          </span>
        </div>
        <h2 className="text-2xl font-bold text-slate-100 mb-3">
          Simulation Parameters
        </h2>
        <p className="text-slate-400 text-sm max-w-lg mx-auto">
          Configure the Monte Carlo simulation engine. Choose between GBM and Merton Jump Diffusion models.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Model Selection */}
        <div className="col-span-2">
          <label className="block text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Simulation Model
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setModel("gbm")}
              className={`p-4 rounded-xl border text-left transition-all ${
                model === "gbm"
                  ? "bg-cyan-500/10 border-cyan-500/30"
                  : "bg-slate-900/30 border-slate-700/30 hover:border-slate-600/50"
              }`}
            >
              <div className={`text-sm font-semibold mb-1 ${model === "gbm" ? "text-cyan-400" : "text-slate-300"}`}>
                Geometric Brownian Motion
              </div>
              <div className="text-xs text-slate-500 font-mono">
                dS/S = μdt + σdW
              </div>
              <div className="text-xs text-slate-600 mt-2">
                Standard model. Continuous price paths with no jumps. Good for stable assets.
              </div>
            </button>
            <button
              onClick={() => setModel("merton")}
              className={`p-4 rounded-xl border text-left transition-all ${
                model === "merton"
                  ? "bg-violet-500/10 border-violet-500/30"
                  : "bg-slate-900/30 border-slate-700/30 hover:border-slate-600/50"
              }`}
            >
              <div className={`text-sm font-semibold mb-1 ${model === "merton" ? "text-violet-400" : "text-slate-300"}`}>
                Merton Jump Diffusion
              </div>
              <div className="text-xs text-slate-500 font-mono">
                dS/S = (μ-λk)dt + σdW + JdN
              </div>
              <div className="text-xs text-slate-600 mt-2">
                Adds Poisson jumps for crashes and spikes. More realistic for volatile assets.
              </div>
            </button>
          </div>
        </div>

        {/* Number of Simulations */}
        <div>
          <label className="block text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Number of Simulations: <span className="text-cyan-400">{numSimulations.toLocaleString()}</span>
          </label>
          <input
            type="range"
            min={50}
            max={2000}
            step={50}
            value={numSimulations}
            onChange={(e) => setNumSimulations(Number(e.target.value))}
            className="w-full accent-cyan-500"
          />
          <div className="flex justify-between text-xs text-slate-600 font-mono mt-1">
            <span>50</span>
            <span>1,000</span>
            <span>2,000</span>
          </div>
        </div>

        {/* Number of Years */}
        <div>
          <label className="block text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Simulation Horizon: <span className="text-cyan-400">{numYears} years</span>
          </label>
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={numYears}
            onChange={(e) => setNumYears(Number(e.target.value))}
            className="w-full accent-cyan-500"
          />
          <div className="flex justify-between text-xs text-slate-600 font-mono mt-1">
            <span>1yr</span>
            <span>15yr</span>
            <span>30yr</span>
          </div>
        </div>

        {/* Initial Investment */}
        <div>
          <label className="block text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Initial Investment
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
            <input
              type="number"
              value={initialInvestment}
              onChange={(e) => setInitialInvestment(Number(e.target.value))}
              min={1000}
              step={10000}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-7 pr-4 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>

        {/* Seed */}
        <div>
          <label className="block text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Random Seed
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={seed ?? ""}
              onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : null)}
              placeholder="Random"
              className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={() => setSeed(Math.floor(Math.random() * 10000))}
              className="px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-xs text-slate-400 hover:text-cyan-400 font-mono transition-colors"
            >
              Reseed
            </button>
          </div>
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4 mb-6">
        <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">Portfolio Summary</div>
        <div className="flex flex-wrap gap-2">
          {assets.map((asset, i) => {
            const colors = ["text-cyan-400", "text-violet-400", "text-amber-400", "text-emerald-400", "text-pink-400", "text-blue-400", "text-orange-400", "text-teal-400"];
            return (
              <div key={i} className="bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-1.5">
                <span className={`text-xs font-mono font-bold ${colors[i % colors.length]}`}>{asset.ticker}</span>
                <span className="text-xs text-slate-500 ml-2">{asset.allocation_pct}%</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-xs text-slate-500 font-mono">
          {model === "merton" ? "Merton Jump Diffusion" : "Geometric Brownian Motion"} · {numSimulations.toLocaleString()} paths · {numYears}yr · ${initialInvestment.toLocaleString()}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors text-sm flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={handleRun}
          disabled={isLoading}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running Simulation...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Monte Carlo
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
