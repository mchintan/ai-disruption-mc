from typing import Optional

from fastapi import APIRouter, Header

from app.contexts.observability.journey import emit
from app.engine.analyzer import analyze_portfolio
from app.models.schemas import AnalyzeRequest, AnalyzeResponse

router = APIRouter(prefix="/api", tags=["intake"])


@router.post("/analyze-portfolio", response_model=AnalyzeResponse)
def analyze(
    request: AnalyzeRequest,
    x_session_id: Optional[str] = Header(default="", alias="X-Session-ID"),
) -> AnalyzeResponse:
    """Analyze a natural language portfolio description and return AI recommendations."""
    result = analyze_portfolio(
        description=request.description,
        risk_tolerance=request.risk_tolerance,
        horizon_years=request.horizon_years,
    )
    emit("step_completed", context="intake", session=x_session_id,
         risk_tolerance=request.risk_tolerance)
    return AnalyzeResponse(**result)
