"""Thesis tracking endpoints."""

from typing import Optional
from fastapi import APIRouter, Header
from pydantic import BaseModel

from app.contexts.thesis.generator import generate_theses
from app.contexts.thesis.critic import critique_theses
from app.contexts.observability.journey import emit

router = APIRouter(prefix="/api/thesis", tags=["thesis"])


class GenerateRequest(BaseModel):
    assets: list[dict]
    description: str = ""
    risk_tolerance: str = "moderate"


class CritiqueRequest(BaseModel):
    theses: list[dict]
    risk_metrics: dict


class ThesisResponse(BaseModel):
    theses: list[dict]


@router.post("/generate", response_model=ThesisResponse)
def generate(
    req: GenerateRequest,
    x_session_id: Optional[str] = Header(default="", alias="X-Session-ID"),
) -> ThesisResponse:
    """Generate investment theses for each asset in the portfolio."""
    theses = generate_theses(req.assets, req.description, req.risk_tolerance)
    emit("step_completed", context="thesis", session=x_session_id, action="generate")
    return ThesisResponse(theses=theses)


@router.post("/critique", response_model=ThesisResponse)
def critique(
    req: CritiqueRequest,
    x_session_id: Optional[str] = Header(default="", alias="X-Session-ID"),
) -> ThesisResponse:
    """Critique investment theses against portfolio metrics."""
    updated = critique_theses(req.theses, req.risk_metrics)
    emit("step_completed", context="thesis", session=x_session_id, action="critique")
    return ThesisResponse(theses=updated)
