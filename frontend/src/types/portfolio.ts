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
