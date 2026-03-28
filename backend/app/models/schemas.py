from pydantic import BaseModel, Field
from typing import Optional


class AssetParams(BaseModel):
    ticker: str
    name: str
    allocation_pct: float = Field(ge=0, le=100)
    drift: float = Field(description="Annual drift (mu) as decimal, e.g. 0.08 for 8%")
    volatility: float = Field(gt=0, description="Annual volatility (sigma) as decimal, e.g. 0.20 for 20%")
    jump_intensity: float = Field(
        default=0.0, ge=0,
        description="Poisson jump intensity (lambda) - avg jumps per year"
    )
    jump_mean: float = Field(
        default=0.0,
        description="Mean of log-normal jump size (mu_J)"
    )
    jump_vol: float = Field(
        default=0.0, ge=0,
        description="Volatility of log-normal jump size (sigma_J)"
    )
    rationale: str = ""


class AnalyzeRequest(BaseModel):
    description: str = Field(
        min_length=10,
        description="Natural language portfolio description"
    )
    risk_tolerance: str = Field(
        default="moderate",
        description="low, moderate, or aggressive"
    )
    horizon_years: int = Field(default=10, ge=1, le=30)


class AnalyzeResponse(BaseModel):
    assets: list[AssetParams]
    correlation_matrix: list[list[float]]
    analysis_summary: str


class SimulateRequest(BaseModel):
    assets: list[AssetParams]
    correlation_matrix: list[list[float]] = Field(default_factory=list)
    num_simulations: int = Field(default=500, ge=50, le=5000)
    num_years: int = Field(default=10, ge=1, le=30)
    model: str = Field(
        default="merton",
        description="Simulation model: 'gbm' or 'merton'"
    )
    initial_investment: float = Field(default=100000, gt=0)
    seed: Optional[int] = Field(default=42)


class PercentileData(BaseModel):
    year: float
    p10: float
    p25: float
    median: float
    p75: float
    p90: float
    mean: float


class RiskMetrics(BaseModel):
    var_95: float = Field(description="Value at Risk at 95% confidence")
    var_99: float = Field(description="Value at Risk at 99% confidence")
    cvar_95: float = Field(description="Conditional VaR (Expected Shortfall) at 95%")
    sharpe_ratio: float
    max_drawdown: float = Field(description="Maximum drawdown as decimal")
    expected_return: float
    volatility: float
    median_terminal: float
    mean_terminal: float


class AssetResult(BaseModel):
    ticker: str
    name: str
    allocation_pct: float
    percentiles: list[PercentileData]
    risk_metrics: RiskMetrics
    sample_paths: list[list[dict]]


class SimulateResponse(BaseModel):
    portfolio_percentiles: list[PercentileData]
    portfolio_risk_metrics: RiskMetrics
    portfolio_sample_paths: list[list[dict]]
    asset_results: list[AssetResult]
    model_used: str
    num_simulations: int
    num_years: int
    initial_investment: float


class OptimizeRequest(BaseModel):
    assets: list[AssetParams]
    correlation_matrix: list[list[float]] = Field(default_factory=list)
    num_simulations: int = Field(default=500, ge=50, le=5000)
    num_years: int = Field(default=10, ge=1, le=30)
    model: str = Field(default="merton")
    initial_investment: float = Field(default=100000, gt=0)
    objective: str = Field(
        description="Optimization objective: max_sharpe, min_var, min_cvar, min_max_drawdown, max_return"
    )
    seed: Optional[int] = Field(default=42)


class WeightResult(BaseModel):
    ticker: str
    name: str
    original_pct: float
    optimal_pct: float


class OptimizeResponse(BaseModel):
    weights: list[WeightResult]
    original_risk_metrics: RiskMetrics
    optimized_risk_metrics: RiskMetrics
    objective: str
    converged: bool
    narrative: str
    optimized_simulation: SimulateResponse
