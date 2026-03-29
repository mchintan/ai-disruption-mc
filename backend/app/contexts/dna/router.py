"""Portfolio DNA analysis endpoint."""

from typing import Optional
from fastapi import APIRouter, Header
from pydantic import BaseModel

from app.contexts.dna.analyzer import compute_dna
from app.contexts.dna.narrator import generate_personality
from app.contexts.observability.journey import emit


class DNARequest(BaseModel):
    assets: list[dict]
    correlation_matrix: list[list[float]] = []


class DNAScores(BaseModel):
    growth: float
    volatility: float
    tail_risk: float
    diversification: float
    concentration: float
    defensive: float
    momentum: float
    crisis_resilience: float


class DNAResponse(BaseModel):
    scores: DNAScores
    personality: str


router = APIRouter(prefix="/api/dna", tags=["dna"])


@router.post("/analyze", response_model=DNAResponse)
def analyze_dna(
    req: DNARequest,
    x_session_id: Optional[str] = Header(default="", alias="X-Session-ID"),
) -> DNAResponse:
    """Compute portfolio DNA fingerprint."""
    scores = compute_dna(req.assets, req.correlation_matrix)
    personality = generate_personality(scores)
    emit("step_completed", context="dna", session=x_session_id)
    return DNAResponse(scores=DNAScores(**scores), personality=personality)
