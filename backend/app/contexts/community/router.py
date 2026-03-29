"""Community experiment sharing endpoints."""

import uuid
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

from app.contexts.community.store import publish, feed, get_experiment
from app.contexts.observability.journey import emit

router = APIRouter(prefix="/api/community", tags=["community"])


class PublishRequest(BaseModel):
    name: str
    portfolio: dict
    metrics: dict = {}
    dna: dict = {}


class PublishResponse(BaseModel):
    id: str
    published_at: float


@router.post("/publish", response_model=PublishResponse)
def publish_experiment(
    req: PublishRequest,
    x_session_id: Optional[str] = Header(default="", alias="X-Session-ID"),
) -> PublishResponse:
    """Publish an experiment for the community."""
    import time
    exp_id = str(uuid.uuid4())[:12]
    publish(exp_id, req.name, x_session_id, req.portfolio, req.metrics, req.dna)
    emit("step_completed", context="community", session=x_session_id, action="publish")
    return PublishResponse(id=exp_id, published_at=time.time())


@router.get("/feed")
def get_feed(
    sort: str = Query(default="published_at"),
    limit: int = Query(default=20, ge=1, le=100),
):
    """Get published experiments feed."""
    return feed(sort_by=sort, limit=limit)


@router.get("/experiment/{exp_id}")
def fork_experiment(exp_id: str):
    """Get a published experiment for forking."""
    exp = get_experiment(exp_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp
