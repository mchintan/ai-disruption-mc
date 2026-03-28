export interface AssetParams {
  ticker: string;
  name: string;
  allocation_pct: number;
  drift: number;
  volatility: number;
  jump_intensity: number;
  jump_mean: number;
  jump_vol: number;
  rationale: string;
}

export interface AnalyzeRequest {
  description: string;
  risk_tolerance: string;
  horizon_years: number;
}

export interface AnalyzeResponse {
  assets: AssetParams[];
  correlation_matrix: number[][];
  analysis_summary: string;
}

export interface SimulateRequest {
  assets: AssetParams[];
  correlation_matrix: number[][];
  num_simulations: number;
  num_years: number;
  model: "gbm" | "merton";
  initial_investment: number;
  seed: number | null;
}

export interface PercentileData {
  year: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  mean: number;
}

export interface RiskMetrics {
  var_95: number;
  var_99: number;
  cvar_95: number;
  sharpe_ratio: number;
  max_drawdown: number;
  expected_return: number;
  volatility: number;
  median_terminal: number;
  mean_terminal: number;
}

export interface AssetResult {
  ticker: string;
  name: string;
  allocation_pct: number;
  percentiles: PercentileData[];
  risk_metrics: RiskMetrics;
  sample_paths: Array<Array<{ year: number; value: number }>>;
}

export interface SimulateResponse {
  portfolio_percentiles: PercentileData[];
  portfolio_risk_metrics: RiskMetrics;
  portfolio_sample_paths: Array<Array<{ year: number; value: number }>>;
  asset_results: AssetResult[];
  model_used: string;
  num_simulations: number;
  num_years: number;
  initial_investment: number;
}

export type AppStep = "describe" | "analyze" | "configure" | "simulate";

export type OptimizationObjective =
  | "max_sharpe"
  | "min_var"
  | "min_cvar"
  | "min_max_drawdown"
  | "max_return";

export interface OptimizeRequest {
  assets: AssetParams[];
  correlation_matrix: number[][];
  num_simulations: number;
  num_years: number;
  model: "gbm" | "merton";
  initial_investment: number;
  objective: OptimizationObjective;
  seed: number | null;
}

export interface WeightResult {
  ticker: string;
  name: string;
  original_pct: number;
  optimal_pct: number;
}

export interface OptimizeResponse {
  weights: WeightResult[];
  original_risk_metrics: RiskMetrics;
  optimized_risk_metrics: RiskMetrics;
  objective: string;
  converged: boolean;
  narrative: string;
  optimized_simulation: SimulateResponse;
}

// Backtest types

export interface BacktestAsset {
  ticker: string;
  allocation_pct: number;
}

export interface BacktestRequest {
  crisis_id: string;
  portfolio: BacktestAsset[];
  num_simulations: number;
  initial_investment: number;
  model: "gbm" | "merton";
  rebalance: boolean;
  seed: number | null;
}

export interface BacktestStatistics {
  total_return_pct: number;
  annualized_return_pct: number;
  final_value_median: number;
  final_value_p5: number;
  final_value_p95: number;
  max_drawdown_pct: number;
  max_drawdown_p95: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  var_95: number;
  var_99: number;
  best_day_pct: number;
  worst_day_pct: number;
  positive_days_pct: number;
  recovery_days: number | null;
  volatility_ann_pct: number;
}

export interface CrisisInfo {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  trading_days: number;
  description: string;
}

export interface AssetCurveResult {
  ticker: string;
  name: string;
  allocation_pct: number;
  median_curve: number[];
  final_median: number;
  final_return_pct: number;
}

export interface EquityPercentile {
  day: number;
  p5: number;
  p25: number;
  median: number;
  p75: number;
  p95: number;
}

export interface DrawdownPercentile {
  day: number;
  median: number;
  p75: number;
  p95: number;
}

export interface ReturnsHistogramBin {
  bin: number;
  count: number;
  is_negative: boolean;
}

export interface BacktestResponse {
  crisis: CrisisInfo;
  portfolio: Array<{ ticker: string; name: string; allocation_pct: number }>;
  equity_percentiles: EquityPercentile[];
  drawdown_curve: number[];
  drawdown_percentiles: DrawdownPercentile[];
  sample_paths: Array<Array<{ day: number; value: number }>>;
  asset_curves: AssetCurveResult[];
  returns_histogram: ReturnsHistogramBin[];
  statistics: BacktestStatistics;
  config: {
    num_simulations: number;
    initial_investment: number;
    model: string;
    rebalance: boolean;
  };
}

export interface CrisisPeriodSummary {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  trading_days: number;
  description: string;
  available_assets: string[];
}

export interface BacktestAssetInfo {
  ticker: string;
  name: string;
}

export type AppMode = "simulate" | "backtest";

// Simulation config shorthand (matches PortfolioExperiment.lastSimulation.config)
export interface SimConfig {
  numSimulations: number;
  numYears: number;
  model: "gbm" | "merton";
  initialInvestment: number;
  seed: number | null;
}

// Workspace navigation
export type AppTab = "build" | "simulate" | "backtest" | "optimize" | "execute";

// Portfolio experiment (persisted to IndexedDB)
export interface PortfolioExperiment {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  portfolio: {
    assets: AssetParams[];
    correlationMatrix: number[][];
    description: string;
    riskTolerance: string;
  };
  lastSimulation: {
    config: {
      numSimulations: number;
      numYears: number;
      model: "gbm" | "merton";
      initialInvestment: number;
      seed: number | null;
    };
    result: SimulateResponse;
  } | null;
  lastOptimization: OptimizeResponse | null;
  lastBacktest: {
    crisisId: string;
    config: {
      numSimulations: number;
      initialInvestment: number;
      model: string;
      rebalance: boolean;
    };
    result: BacktestResponse;
  } | null;
}
