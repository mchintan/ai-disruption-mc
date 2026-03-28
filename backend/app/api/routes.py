from fastapi import APIRouter

from app.engine.analyzer import analyze_portfolio, explain_optimization
from app.engine.backtest import BACKTEST_ASSETS, CRISIS_PERIODS, run_backtest
from app.engine.monte_carlo import run_simulation
from app.engine.optimizer import optimize_weights
from app.models.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    BacktestAssetInfo,
    BacktestRequest,
    BacktestResponse,
    CrisisPeriodSummary,
    OptimizeRequest,
    OptimizeResponse,
    SimulateRequest,
    SimulateResponse,
)

router = APIRouter(prefix="/api")


@router.post("/analyze-portfolio", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    """Analyze a natural language portfolio description and return AI recommendations."""
    result = analyze_portfolio(
        description=request.description,
        risk_tolerance=request.risk_tolerance,
        horizon_years=request.horizon_years,
    )
    return AnalyzeResponse(**result)


@router.post("/simulate", response_model=SimulateResponse)
def simulate(request: SimulateRequest) -> SimulateResponse:
    """Run Monte Carlo simulation on a configured portfolio."""
    assets = [a.model_dump() for a in request.assets]

    result = run_simulation(
        assets=assets,
        correlation_matrix=request.correlation_matrix,
        num_simulations=request.num_simulations,
        num_years=request.num_years,
        model=request.model,
        initial_investment=request.initial_investment,
        seed=request.seed,
    )
    return SimulateResponse(**result)


@router.post("/optimize-weights", response_model=OptimizeResponse)
def optimize(request: OptimizeRequest) -> OptimizeResponse:
    """Find optimal portfolio weights via Monte Carlo optimization."""
    assets = [a.model_dump() for a in request.assets]

    result = optimize_weights(
        assets=assets,
        correlation_matrix=request.correlation_matrix,
        num_simulations_trial=200,
        num_simulations_final=request.num_simulations,
        num_years=request.num_years,
        model=request.model,
        initial_investment=request.initial_investment,
        objective=request.objective,
        seed=request.seed,
    )

    narrative = explain_optimization(
        weights=result["weights"],
        original_metrics=result["original_risk_metrics"],
        optimized_metrics=result["optimized_risk_metrics"],
        objective=request.objective,
    )

    return OptimizeResponse(
        weights=result["weights"],
        original_risk_metrics=result["original_risk_metrics"],
        optimized_risk_metrics=result["optimized_risk_metrics"],
        objective=result["objective"],
        converged=result["converged"],
        narrative=narrative,
        optimized_simulation=result["optimized_simulation"],
    )


@router.get("/crisis-periods", response_model=list[CrisisPeriodSummary])
def list_crisis_periods() -> list[CrisisPeriodSummary]:
    """Return all available crisis periods for backtesting."""
    return [
        CrisisPeriodSummary(
            id=c.id,
            name=c.name,
            start_date=c.start_date,
            end_date=c.end_date,
            trading_days=c.trading_days,
            description=c.description,
            available_assets=list(c.assets.keys()),
        )
        for c in CRISIS_PERIODS
    ]


@router.get("/backtest-assets", response_model=list[BacktestAssetInfo])
def list_backtest_assets() -> list[BacktestAssetInfo]:
    """Return all assets available for backtesting."""
    return [
        BacktestAssetInfo(ticker=ticker, name=name)
        for ticker, name in BACKTEST_ASSETS.items()
    ]


@router.post("/backtest", response_model=BacktestResponse)
def backtest(request: BacktestRequest) -> BacktestResponse:
    """Run a portfolio backtest against a historical crisis period."""
    portfolio = [a.model_dump() for a in request.portfolio]
    result = run_backtest(
        crisis_id=request.crisis_id,
        portfolio=portfolio,
        num_simulations=request.num_simulations,
        initial_investment=request.initial_investment,
        model=request.model,
        rebalance=request.rebalance,
        seed=request.seed,
    )
    return BacktestResponse(**result)
