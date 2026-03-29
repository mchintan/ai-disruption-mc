import { useState } from "react";
import { Sparkles, Shield, Scale, TrendingUp, Zap, ChevronDown, ChevronUp, Loader2, Trash2, Plus, FileText, AlertTriangle, CheckCircle } from "lucide-react";
import { analyzePortfolio, generateTheses, critiqueTheses, analyzeDNA } from "../api";
import { track } from "../telemetry";
import { humanizeRisk, humanizeDrift, humanizeGrade } from "../utils/humanize";
import type { AssetParams, Thesis, DNAResponse } from "../types/portfolio";

const PRESETS: { name: string; icon: React.ReactNode; description: string; risk: string; assets: AssetParams[] }[] = [
  {
    name: "Conservative",
    icon: <Shield className="w-5 h-5" />,
    description: "Low risk, steady income",
    risk: "low",
    assets: [
      { ticker: "BND", name: "Total Bond Market ETF", allocation_pct: 40, drift: 0.04, volatility: 0.06, jump_intensity: 0.2, jump_mean: -0.02, jump_vol: 0.03, rationale: "Core fixed income" },
      { ticker: "VTI", name: "Total Stock Market ETF", allocation_pct: 25, drift: 0.08, volatility: 0.18, jump_intensity: 0.6, jump_mean: -0.05, jump_vol: 0.10, rationale: "Broad equity exposure" },
      { ticker: "GLD", name: "Gold ETF", allocation_pct: 15, drift: 0.06, volatility: 0.15, jump_intensity: 0.3, jump_mean: 0.02, jump_vol: 0.05, rationale: "Inflation hedge" },
      { ticker: "SCHD", name: "Dividend ETF", allocation_pct: 10, drift: 0.07, volatility: 0.14, jump_intensity: 0.4, jump_mean: -0.04, jump_vol: 0.08, rationale: "Quality dividends" },
      { ticker: "TIPS", name: "TIPS Bond ETF", allocation_pct: 10, drift: 0.03, volatility: 0.05, jump_intensity: 0.1, jump_mean: -0.01, jump_vol: 0.02, rationale: "Inflation-protected" },
    ],
  },
  {
    name: "Balanced",
    icon: <Scale className="w-5 h-5" />,
    description: "Growth with protection",
    risk: "moderate",
    assets: [
      { ticker: "VTI", name: "Total Stock Market ETF", allocation_pct: 30, drift: 0.08, volatility: 0.18, jump_intensity: 0.6, jump_mean: -0.05, jump_vol: 0.10, rationale: "Broad US equities" },
      { ticker: "QQQ", name: "Nasdaq-100 ETF", allocation_pct: 20, drift: 0.12, volatility: 0.22, jump_intensity: 0.8, jump_mean: -0.06, jump_vol: 0.12, rationale: "Tech growth" },
      { ticker: "GLD", name: "Gold ETF", allocation_pct: 15, drift: 0.06, volatility: 0.15, jump_intensity: 0.3, jump_mean: 0.02, jump_vol: 0.05, rationale: "Portfolio stabilizer" },
      { ticker: "TLT", name: "20+ Year Treasury ETF", allocation_pct: 20, drift: 0.03, volatility: 0.15, jump_intensity: 0.4, jump_mean: -0.03, jump_vol: 0.06, rationale: "Bond hedge" },
      { ticker: "VNQ", name: "Real Estate ETF", allocation_pct: 15, drift: 0.05, volatility: 0.20, jump_intensity: 0.5, jump_mean: -0.04, jump_vol: 0.08, rationale: "Real asset income" },
    ],
  },
  {
    name: "Growth",
    icon: <TrendingUp className="w-5 h-5" />,
    description: "Higher returns, more volatility",
    risk: "moderate",
    assets: [
      { ticker: "QQQ", name: "Nasdaq-100 ETF", allocation_pct: 35, drift: 0.12, volatility: 0.22, jump_intensity: 0.8, jump_mean: -0.06, jump_vol: 0.12, rationale: "Core tech exposure" },
      { ticker: "VTI", name: "Total Stock Market ETF", allocation_pct: 25, drift: 0.08, volatility: 0.18, jump_intensity: 0.6, jump_mean: -0.05, jump_vol: 0.10, rationale: "Broad market growth" },
      { ticker: "BTC-USD", name: "Bitcoin", allocation_pct: 10, drift: 0.15, volatility: 0.60, jump_intensity: 1.5, jump_mean: -0.10, jump_vol: 0.20, rationale: "Asymmetric upside" },
      { ticker: "GLD", name: "Gold ETF", allocation_pct: 15, drift: 0.06, volatility: 0.15, jump_intensity: 0.3, jump_mean: 0.02, jump_vol: 0.05, rationale: "Crisis hedge" },
      { ticker: "TLT", name: "20+ Year Treasury ETF", allocation_pct: 15, drift: 0.03, volatility: 0.15, jump_intensity: 0.4, jump_mean: -0.03, jump_vol: 0.06, rationale: "Volatility buffer" },
    ],
  },
  {
    name: "Aggressive",
    icon: <Zap className="w-5 h-5" />,
    description: "Maximum growth, high risk",
    risk: "aggressive",
    assets: [
      { ticker: "QQQ", name: "Nasdaq-100 ETF", allocation_pct: 30, drift: 0.12, volatility: 0.22, jump_intensity: 0.8, jump_mean: -0.06, jump_vol: 0.12, rationale: "Core tech" },
      { ticker: "NVDA", name: "NVIDIA", allocation_pct: 15, drift: 0.18, volatility: 0.40, jump_intensity: 1.2, jump_mean: -0.08, jump_vol: 0.15, rationale: "AI leader" },
      { ticker: "BTC-USD", name: "Bitcoin", allocation_pct: 15, drift: 0.15, volatility: 0.60, jump_intensity: 1.5, jump_mean: -0.10, jump_vol: 0.20, rationale: "Digital store of value" },
      { ticker: "BOTZ", name: "Robotics & AI ETF", allocation_pct: 15, drift: 0.14, volatility: 0.28, jump_intensity: 0.6, jump_mean: -0.05, jump_vol: 0.10, rationale: "Automation wave" },
      { ticker: "GLD", name: "Gold ETF", allocation_pct: 15, drift: 0.06, volatility: 0.15, jump_intensity: 0.3, jump_mean: 0.02, jump_vol: 0.05, rationale: "Tail risk hedge" },
      { ticker: "URA", name: "Uranium ETF", allocation_pct: 10, drift: 0.10, volatility: 0.30, jump_intensity: 0.7, jump_mean: -0.04, jump_vol: 0.08, rationale: "Energy infrastructure" },
    ],
  },
];

const DEFAULT_CORRELATION = (n: number): number[][] => {
  const m: number[][] = [];
  for (let i = 0; i < n; i++) {
    m[i] = [];
    for (let j = 0; j < n; j++) {
      m[i][j] = i === j ? 1.0 : 0.1;
    }
  }
  return m;
};

const EXAMPLES = [
  "I want a tech-heavy growth portfolio with AI exposure, hedged against inflation. 10-year horizon, moderate risk.",
  "Conservative retirement portfolio focused on income and capital preservation. Low volatility, 5-year horizon.",
  "Aggressive crypto and emerging tech portfolio. High risk tolerance, maximum growth over 15 years.",
  "Balanced portfolio with real estate, gold, and equities. Moderate risk, 10 years.",
];

const ASSET_COLORS = [
  { text: "text-teal-700 dark:text-cyan-400", border: "border-teal-300 dark:border-cyan-500/30", bg: "bg-teal-500 dark:bg-cyan-500" },
  { text: "text-violet-700 dark:text-violet-400", border: "border-violet-300 dark:border-violet-500/30", bg: "bg-violet-500" },
  { text: "text-amber-700 dark:text-amber-400", border: "border-amber-300 dark:border-amber-500/30", bg: "bg-amber-500" },
  { text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-300 dark:border-emerald-500/30", bg: "bg-emerald-500" },
  { text: "text-pink-700 dark:text-pink-400", border: "border-pink-300 dark:border-pink-500/30", bg: "bg-pink-500" },
  { text: "text-blue-700 dark:text-blue-400", border: "border-blue-300 dark:border-blue-500/30", bg: "bg-blue-500" },
  { text: "text-orange-700 dark:text-orange-400", border: "border-orange-300 dark:border-orange-500/30", bg: "bg-orange-500" },
  { text: "text-cyan-700 dark:text-teal-400", border: "border-cyan-300 dark:border-teal-500/30", bg: "bg-cyan-500 dark:bg-teal-500" },
];

interface Props {
  assets: AssetParams[];
  correlationMatrix: number[][];
  description: string;
  riskTolerance: string;
  onPortfolioChange: (assets: AssetParams[], correlationMatrix: number[][], description?: string, riskTolerance?: string) => void;
  theses: Thesis[] | null;
  onThesesChange: (theses: Thesis[]) => void;
  lastSimulationMetrics: Record<string, number> | null;
  dna: DNAResponse | null;
  onDNAChange: (dna: DNAResponse) => void;
  onGoToTest: () => void;
}

export function PlanPhase(props: Props) {
  const { assets, correlationMatrix, description, riskTolerance, onPortfolioChange, onThesesChange, dna, onDNAChange, onGoToTest } = props;

  const [localDesc, setLocalDesc] = useState(description);
  const [localRisk, setLocalRisk] = useState(riskTolerance || "moderate");
  const [horizonYears, setHorizonYears] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  const [thesisLoading, setThesisLoading] = useState(false);
  const [critiqueLoading, setCritiqueLoading] = useState(false);
  const [showFineTune, setShowFineTune] = useState(false);
  const [showTheses, setShowTheses] = useState(false);

  // Local copy of assets for editing
  const [localAssets, setLocalAssets] = useState<AssetParams[]>(assets);
  const [localCorrelation, setLocalCorrelation] = useState<number[][]>(correlationMatrix);

  // Sync if parent assets change (e.g. optimized weights applied)
  const parentKey = assets.map(a => `${a.ticker}:${a.allocation_pct}`).join(",");
  const localKey = localAssets.map(a => `${a.ticker}:${a.allocation_pct}`).join(",");
  if (parentKey !== localKey && parentKey !== "" && !generating) {
    setLocalAssets(assets);
    setLocalCorrelation(correlationMatrix);
  }

  const triggerDNA = async (a: AssetParams[], corr: number[][]) => {
    try {
      const result = await analyzeDNA({ assets: a, correlation_matrix: corr });
      onDNAChange(result as unknown as DNAResponse);
    } catch (e) {
      console.error("DNA analysis failed:", e);
    }
  };

  const handlePresetSelect = (preset: typeof PRESETS[number]) => {
    const corr = DEFAULT_CORRELATION(preset.assets.length);
    setLocalAssets(preset.assets);
    setLocalCorrelation(corr);
    onPortfolioChange(preset.assets, corr, preset.name + " portfolio", preset.risk);
    track("preset_selected", { preset: preset.name });
    triggerDNA(preset.assets, corr);
  };

  const handleGenerate = async () => {
    if (localDesc.trim().length < 10) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await analyzePortfolio({ description: localDesc, risk_tolerance: localRisk, horizon_years: horizonYears });
      setLocalAssets(result.assets);
      setLocalCorrelation(result.correlation_matrix);
      setAnalysisSummary(result.analysis_summary);
      onPortfolioChange(result.assets, result.correlation_matrix, localDesc, localRisk);
      track("ai_portfolio_generated");
      triggerDNA(result.assets, result.correlation_matrix);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateTheses = async () => {
    setThesisLoading(true);
    try {
      const result = await generateTheses({ assets: localAssets, description: localDesc, risk_tolerance: localRisk });
      onThesesChange(result.theses as Thesis[]);
    } catch (e) { console.error(e); }
    finally { setThesisLoading(false); }
  };

  const handleCritiqueTheses = async () => {
    if (!props.theses || !props.lastSimulationMetrics) return;
    setCritiqueLoading(true);
    try {
      const result = await critiqueTheses({ theses: props.theses, risk_metrics: props.lastSimulationMetrics });
      onThesesChange(result.theses as Thesis[]);
    } catch (e) { console.error(e); }
    finally { setCritiqueLoading(false); }
  };

  const updateAsset = (index: number, field: keyof AssetParams, value: string | number) => {
    const updated = [...localAssets];
    updated[index] = { ...updated[index], [field]: value };
    setLocalAssets(updated);
    onPortfolioChange(updated, localCorrelation);
  };

  const removeAsset = (index: number) => {
    const updated = localAssets.filter((_, i) => i !== index);
    const newCorr = localCorrelation
      .filter((_, i) => i !== index)
      .map(row => row.filter((_, j) => j !== index));
    setLocalAssets(updated);
    setLocalCorrelation(newCorr);
    onPortfolioChange(updated, newCorr);
  };

  const addAsset = () => {
    const newAsset: AssetParams = {
      ticker: "NEW", name: "New Asset", allocation_pct: 0,
      drift: 0.08, volatility: 0.20, jump_intensity: 0.5, jump_mean: -0.05, jump_vol: 0.10, rationale: "User-added asset",
    };
    const updated = [...localAssets, newAsset];
    const n = localCorrelation.length;
    const newCorr = localCorrelation.map(row => [...row, 0.1]);
    newCorr.push([...Array(n).fill(0.1), 1.0]);
    setLocalAssets(updated);
    setLocalCorrelation(newCorr);
    onPortfolioChange(updated, newCorr);
  };

  const totalAllocation = localAssets.reduce((sum, a) => sum + a.allocation_pct, 0);

  const gradeInfo = dna ? humanizeGrade(dna.scores as unknown as Record<string, number>) : null;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Quick Start Presets */}
      <div>
        <h2 className="text-lg font-bold text-stone-900 dark:text-slate-100 mb-1">Quick Start</h2>
        <p className="text-sm text-stone-500 dark:text-slate-400 mb-4">Pick a starting point and customize later.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handlePresetSelect(preset)}
              className="text-left p-4 rounded-xl border border-stone-200 dark:border-slate-700/30 bg-white dark:bg-slate-900/50 hover:border-teal-300 dark:hover:border-cyan-500/30 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-2 mb-2 text-stone-600 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-cyan-400 transition-colors">
                {preset.icon}
                <span className="font-semibold text-sm">{preset.name}</span>
              </div>
              <p className="text-xs text-stone-400 dark:text-slate-500">{preset.description}</p>
              <p className="text-[10px] text-stone-300 dark:text-slate-600 mt-1">{preset.assets.length} assets</p>
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-stone-200 dark:bg-slate-700/50" />
        <span className="text-xs text-stone-400 dark:text-slate-500 font-medium">or</span>
        <div className="flex-1 h-px bg-stone-200 dark:bg-slate-700/50" />
      </div>

      {/* AI Portfolio Builder */}
      <div className="bg-white dark:bg-slate-900/50 border border-stone-200 dark:border-slate-700/30 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-teal-600 dark:text-cyan-400" />
          <h2 className="text-sm font-semibold text-teal-600 dark:text-cyan-400">AI Portfolio Builder</h2>
        </div>
        <p className="text-sm text-stone-500 dark:text-slate-400 mb-4">
          Describe your ideal portfolio in plain English. Our AI will recommend specific assets with calibrated simulation parameters.
        </p>

        <textarea
          value={localDesc}
          onChange={(e) => setLocalDesc(e.target.value)}
          placeholder="Describe your investment goals, preferences, and constraints..."
          className="w-full h-28 bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/50 rounded-xl px-4 py-3 text-stone-900 dark:text-slate-200 placeholder-stone-400 dark:placeholder-slate-600 focus:outline-none focus:border-teal-400 dark:focus:border-cyan-500/50 focus:ring-1 focus:ring-teal-400/20 dark:focus:ring-cyan-500/20 resize-none text-sm mb-3"
        />

        <div className="flex flex-wrap gap-2 mb-4">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => setLocalDesc(ex)}
              className="text-xs px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-500 hover:text-teal-600 hover:border-teal-300 dark:bg-slate-800/50 dark:border-slate-700/30 dark:text-slate-400 dark:hover:text-cyan-400 dark:hover:border-cyan-500/30 transition-colors"
            >
              {ex.slice(0, 60)}...
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">Risk Tolerance</label>
            <div className="flex gap-2">
              {(["low", "moderate", "aggressive"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setLocalRisk(level)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    localRisk === level
                      ? level === "low"
                        ? "bg-green-50 border border-green-200 text-green-700 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400"
                        : level === "moderate"
                        ? "bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400"
                        : "bg-red-50 border border-red-200 text-red-700 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-400"
                      : "bg-white border border-stone-200 text-stone-500 hover:text-stone-700 dark:bg-slate-800/50 dark:border-slate-700/30 dark:text-slate-500 dark:hover:text-slate-300"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-2">
              Investment Horizon: {horizonYears} years
            </label>
            <input
              type="range" min={1} max={30} value={horizonYears}
              onChange={(e) => setHorizonYears(Number(e.target.value))}
              className="w-full accent-teal-600 dark:accent-cyan-500 mt-2"
            />
            <div className="flex justify-between text-xs text-stone-400 dark:text-slate-600 mt-1">
              <span>1yr</span><span>15yr</span><span>30yr</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating || localDesc.trim().length < 10}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 dark:from-cyan-500 dark:to-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-teal-500 hover:to-teal-400 dark:hover:from-cyan-400 dark:hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {generating ? (<><Loader2 className="w-4 h-4 animate-spin" />Building your portfolio...</>) : (<><Sparkles className="w-4 h-4" />Build My Portfolio</>)}
        </button>
      </div>

      {/* Portfolio Output */}
      {localAssets.length > 0 && (
        <div className="space-y-6">
          {/* Analysis Summary */}
          {analysisSummary && (
            <div className="bg-white border border-stone-200 dark:bg-slate-800/30 dark:border-slate-700/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-teal-600 dark:text-cyan-400" />
                <h3 className="text-sm font-semibold text-teal-600 dark:text-cyan-400">AI Analysis</h3>
              </div>
              <p className="text-sm text-stone-700 dark:text-slate-300 leading-relaxed">{analysisSummary}</p>
            </div>
          )}

          {/* Portfolio Grade Card */}
          {gradeInfo && (
            <div className="bg-white dark:bg-slate-900/50 border border-stone-200 dark:border-slate-700/30 rounded-xl p-5">
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${gradeInfo.color}`}>{gradeInfo.grade}</div>
                <div>
                  <h3 className="text-sm font-semibold text-stone-700 dark:text-slate-300">Portfolio Health Grade</h3>
                  <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">{gradeInfo.explanation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Allocation Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-stone-500 dark:text-slate-500">Total Allocation</span>
              <span className={`text-xs font-semibold ${Math.abs(totalAllocation - 100) < 0.5 ? "text-green-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {totalAllocation.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-stone-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              {localAssets.map((asset, i) => (
                <div key={i} className={`${ASSET_COLORS[i % ASSET_COLORS.length].bg} h-full transition-all`} style={{ width: `${asset.allocation_pct}%` }} />
              ))}
            </div>
          </div>

          {/* Asset Cards */}
          <div className="space-y-3">
            {localAssets.map((asset, i) => {
              const color = ASSET_COLORS[i % ASSET_COLORS.length];
              const riskInfo = humanizeRisk(asset.volatility);
              return (
                <div key={i} className={`bg-white dark:bg-slate-900/50 border ${color.border} rounded-xl p-4`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`text-lg font-bold ${color.text}`}>{asset.ticker}</span>
                      <span className="text-sm text-stone-600 dark:text-slate-300 truncate">{asset.name}</span>
                      <span className="text-sm font-semibold text-stone-900 dark:text-slate-200 ml-auto mr-2">{asset.allocation_pct}%</span>
                    </div>
                    <button onClick={() => removeAsset(i)} className="text-stone-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-stone-400 dark:text-slate-500 italic">{asset.rationale}</span>
                    <span className={`text-[10px] font-semibold ${riskInfo.color}`}>{riskInfo.label} risk</span>
                    <span className="text-[10px] text-stone-400 dark:text-slate-500">{humanizeDrift(asset.drift)}</span>
                  </div>

                  {/* Fine-tune panel */}
                  {showFineTune && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-stone-100 dark:border-slate-800/50">
                      <div>
                        <label className="block text-xs text-stone-400 dark:text-slate-600 mb-1">Allocation %</label>
                        <input type="number" value={asset.allocation_pct} onChange={(e) => updateAsset(i, "allocation_pct", Number(e.target.value))} min={0} max={100} step={1} className="w-full bg-stone-50 border border-stone-200 dark:bg-slate-800/50 dark:border-slate-700/50 rounded-lg px-3 py-1.5 text-sm text-stone-900 dark:text-slate-200 focus:outline-none focus:border-teal-400 dark:focus:border-cyan-500/50" />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-400 dark:text-slate-600 mb-1">Drift</label>
                        <input type="number" value={asset.drift} onChange={(e) => updateAsset(i, "drift", Number(e.target.value))} step={0.01} className="w-full bg-stone-50 border border-stone-200 dark:bg-slate-800/50 dark:border-slate-700/50 rounded-lg px-3 py-1.5 text-sm text-stone-900 dark:text-slate-200 focus:outline-none focus:border-teal-400 dark:focus:border-cyan-500/50" />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-400 dark:text-slate-600 mb-1">Volatility</label>
                        <input type="number" value={asset.volatility} onChange={(e) => updateAsset(i, "volatility", Number(e.target.value))} step={0.01} min={0.01} className="w-full bg-stone-50 border border-stone-200 dark:bg-slate-800/50 dark:border-slate-700/50 rounded-lg px-3 py-1.5 text-sm text-stone-900 dark:text-slate-200 focus:outline-none focus:border-teal-400 dark:focus:border-cyan-500/50" />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-400 dark:text-slate-600 mb-1">Jump intensity</label>
                        <input type="number" value={asset.jump_intensity} onChange={(e) => updateAsset(i, "jump_intensity", Number(e.target.value))} step={0.1} min={0} className="w-full bg-stone-50 border border-stone-200 dark:bg-slate-800/50 dark:border-slate-700/50 rounded-lg px-3 py-1.5 text-sm text-stone-900 dark:text-slate-200 focus:outline-none focus:border-teal-400 dark:focus:border-cyan-500/50" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Fine-tune toggle + Add asset */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowFineTune(!showFineTune)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-200 dark:border-slate-700/50 text-xs text-stone-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-cyan-400 transition-colors"
            >
              {showFineTune ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Fine-tune parameters
            </button>
            <button
              onClick={addAsset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-stone-300 dark:border-slate-700/50 text-xs text-stone-400 dark:text-slate-500 hover:text-teal-600 hover:border-teal-300 dark:hover:text-cyan-400 dark:hover:border-cyan-500/30 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add Asset
            </button>
          </div>

          {/* Theses Section (collapsed) */}
          <div className="bg-white dark:bg-slate-900/50 border border-stone-200 dark:border-slate-700/30 rounded-xl">
            <button
              onClick={() => setShowTheses(!showTheses)}
              className="w-full flex items-center justify-between px-5 py-4"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Investment Theses</span>
                {props.theses && <span className="text-xs text-stone-400 dark:text-slate-500 ml-2">({props.theses.length})</span>}
              </div>
              {showTheses ? <ChevronUp className="w-4 h-4 text-stone-400 dark:text-slate-500" /> : <ChevronDown className="w-4 h-4 text-stone-400 dark:text-slate-500" />}
            </button>
            {showTheses && (
              <div className="px-5 pb-5 border-t border-stone-100 dark:border-slate-800/50 pt-4">
                <div className="flex gap-2 mb-4">
                  {props.theses && props.lastSimulationMetrics && (
                    <button onClick={handleCritiqueTheses} disabled={critiqueLoading}
                      className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30 text-xs font-medium disabled:opacity-50">
                      {critiqueLoading ? "Critiquing..." : "Critique Theses"}
                    </button>
                  )}
                  <button onClick={handleGenerateTheses} disabled={thesisLoading}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30 text-xs font-medium disabled:opacity-50">
                    {thesisLoading ? "Generating..." : props.theses ? "Regenerate" : "Generate Theses"}
                  </button>
                </div>
                {props.theses && props.theses.length > 0 && (
                  <div className="space-y-3">
                    {props.theses.map((t, i) => (
                      <div key={i} className="bg-stone-50 dark:bg-slate-800/30 border border-stone-200 dark:border-slate-700/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-sm text-stone-900 dark:text-slate-200">{t.asset_ticker}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            t.status === "valid" ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400" :
                            t.status === "weakening" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" :
                            "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                          }`}>
                            {t.status === "valid" && <CheckCircle className="w-3 h-3 inline mr-0.5" />}
                            {t.status === "weakening" && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}
                            {t.status}
                          </span>
                        </div>
                        <p className="text-xs text-stone-600 dark:text-slate-300 mb-2">{t.narrative}</p>
                        {t.key_assumptions.length > 0 && (
                          <div className="text-[10px] text-stone-400 dark:text-slate-500">
                            <span className="font-semibold">Assumptions:</span> {t.key_assumptions.join(" · ")}
                          </div>
                        )}
                        {t.critique && (
                          <div className="mt-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/5 rounded p-2 italic">{t.critique}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CTA: Test This Portfolio */}
          <button
            onClick={onGoToTest}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-base flex items-center justify-center gap-2 hover:from-amber-400 hover:to-orange-400 transition-all shadow-sm"
          >
            Test This Portfolio
            <span className="text-lg">&rarr;</span>
          </button>
        </div>
      )}

      {/* Empty state */}
      {localAssets.length === 0 && (
        <div className="text-center py-8 text-stone-400 dark:text-slate-500">
          <TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Choose a preset above or describe your ideal portfolio to get started.</p>
        </div>
      )}
    </div>
  );
}
