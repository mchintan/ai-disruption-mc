"""Custom scenario builder endpoints."""

from typing import Optional
from fastapi import APIRouter, Header
from pydantic import BaseModel, Field

from app.contexts.scenarios.calibrator import calibrate_scenario
from app.contexts.observability.journey import emit

# Import backtest infrastructure for running scenarios
from app.engine.backtest import (
    AssetCrisisParams, CrisisPeriod, run_backtest, CRISIS_MAP,
    _build_correlation_matrix, generate_correlated_normals,
    simulate_gbm, simulate_merton_jump_diffusion,
)
import numpy as np

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


class CalibrateRequest(BaseModel):
    description: str = Field(min_length=10)
    asset_tickers: list[str]
    trading_days: int = Field(default=60, ge=5, le=500)


class CalibrateResponse(BaseModel):
    scenario: dict


class ScenarioRunRequest(BaseModel):
    scenario: dict
    portfolio: list[dict]
    num_simulations: int = Field(default=500, ge=50, le=5000)
    initial_investment: float = Field(default=100000, gt=0)
    model: str = Field(default="merton")
    rebalance: bool = False
    seed: int | None = 42


@router.post("/calibrate", response_model=CalibrateResponse)
def calibrate(
    req: CalibrateRequest,
    x_session_id: Optional[str] = Header(default="", alias="X-Session-ID"),
) -> CalibrateResponse:
    """Calibrate simulation parameters for a custom scenario using AI."""
    scenario = calibrate_scenario(req.description, req.asset_tickers, req.trading_days)
    emit("step_completed", context="scenarios", session=x_session_id, action="calibrate")
    return CalibrateResponse(scenario=scenario)


from app.models.schemas import BacktestResponse

@router.post("/run", response_model=BacktestResponse)
def run_scenario(
    req: ScenarioRunRequest,
    x_session_id: Optional[str] = Header(default="", alias="X-Session-ID"),
):
    """Run a custom scenario through the backtest engine."""
    scenario = req.scenario

    # Build a CrisisPeriod from the calibrated scenario
    assets_map = {}
    for ticker, params in scenario.get("assets", {}).items():
        assets_map[ticker] = AssetCrisisParams(
            ticker=ticker,
            name=ticker,
            drift=params.get("drift", -0.20),
            volatility=params.get("volatility", 0.30),
            jump_intensity=params.get("jump_intensity", 1.0),
            jump_mean=params.get("jump_mean", -0.05),
            jump_vol=params.get("jump_vol", 0.08),
        )

    # Parse correlations
    corr_overrides = {}
    for pair_key, rho in scenario.get("correlations", {}).items():
        parts = pair_key.split(",")
        if len(parts) == 2:
            corr_overrides[(parts[0].strip(), parts[1].strip())] = rho

    crisis = CrisisPeriod(
        id="custom_scenario",
        name=scenario.get("name", "Custom Scenario"),
        start_date="custom",
        end_date="custom",
        trading_days=scenario.get("trading_days", 60),
        description=scenario.get("description", ""),
        assets=assets_map,
        correlation_overrides=corr_overrides,
    )

    # Temporarily add to crisis map so run_backtest can find it
    from app.engine.backtest import CRISIS_MAP as cm
    cm["custom_scenario"] = crisis
    try:
        portfolio = req.portfolio
        result = run_backtest(
            crisis_id="custom_scenario",
            portfolio=portfolio,
            num_simulations=req.num_simulations,
            initial_investment=req.initial_investment,
            model=req.model,
            rebalance=req.rebalance,
            seed=req.seed,
        )
    finally:
        cm.pop("custom_scenario", None)

    emit("step_completed", context="scenarios", session=x_session_id, action="run")
    return BacktestResponse(**result)
