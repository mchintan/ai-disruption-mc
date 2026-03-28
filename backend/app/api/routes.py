from fastapi import APIRouter

from app.engine.analyzer import analyze_portfolio
from app.engine.monte_carlo import run_simulation
from app.models.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
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
