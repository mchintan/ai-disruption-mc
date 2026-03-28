from fastapi import APIRouter
from app.engine.analyzer import analyze_portfolio
from app.models.schemas import AnalyzeRequest, AnalyzeResponse
from app.contexts.observability.journey import emit

router = APIRouter(prefix="/api", tags=["intake"])

@router.post("/analyze-portfolio", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    """Analyze a natural language portfolio description and return AI recommendations."""
    result = analyze_portfolio(
        description=request.description,
        risk_tolerance=request.risk_tolerance,
        horizon_years=request.horizon_years,
    )
    emit("step_completed", context="intake", session=request.description[:8])
    return AnalyzeResponse(**result)
