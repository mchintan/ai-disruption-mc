"""Observability query endpoints for telemetry data."""

import time
import json
import sqlite3
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.contexts.observability.journey import _get_conn, emit

router = APIRouter(prefix="/api/obs", tags=["observability"])


class FunnelResponse(BaseModel):
    intake: int = 0
    portfolio: int = 0
    simulation: int = 0
    insights: int = 0
    fulfill: int = 0


class TimingEntry(BaseModel):
    path: str
    count: int
    p50_ms: float
    p95_ms: float
    p99_ms: float
    avg_ms: float


class JourneyEvent(BaseModel):
    ts: float
    event: str
    context: str
    session: str
    attrs: dict


class ErrorEntry(BaseModel):
    path: str
    context: str
    count: int
    last_ts: float


class BottleneckEntry(BaseModel):
    path: str
    p95_ms: float
    max_ms: float
    count: int


class DropOffEntry(BaseModel):
    context: str
    entered: int
    completed: int
    abandoned: int
    drop_off_pct: float


class FrontendEvent(BaseModel):
    event: str
    session: str = ""
    ts: Optional[float] = None
    context: str = "frontend"
    attrs: dict = {}


@router.get("/funnel", response_model=FunnelResponse)
def get_funnel(hours: int = Query(default=24, ge=1, le=720)):
    """Step completion funnel -- how many users reached each context."""
    cutoff = time.time() - hours * 3600
    conn = _get_conn()
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT context, COUNT(DISTINCT session) as users FROM journey_events "
        "WHERE ts > ? AND event = 'step_completed' AND session != '' GROUP BY context",
        (cutoff,),
    ).fetchall()
    conn.close()
    result = FunnelResponse()
    for row in rows:
        ctx = row["context"]
        if hasattr(result, ctx):
            setattr(result, ctx, row["users"])
    return result


@router.get("/timing", response_model=list[TimingEntry])
def get_timing(hours: int = Query(default=24, ge=1, le=720)):
    """P50/P95/P99 latency per endpoint."""
    cutoff = time.time() - hours * 3600
    conn = _get_conn()
    rows = conn.execute(
        "SELECT path, duration_ms FROM request_traces WHERE ts > ? ORDER BY path",
        (cutoff,),
    ).fetchall()
    conn.close()

    from collections import defaultdict
    import numpy as np

    by_path: dict[str, list[float]] = defaultdict(list)
    for path, duration in rows:
        by_path[path].append(duration)

    result = []
    for path, durations in sorted(by_path.items()):
        arr = np.array(durations)
        result.append(TimingEntry(
            path=path,
            count=len(arr),
            p50_ms=round(float(np.percentile(arr, 50)), 2),
            p95_ms=round(float(np.percentile(arr, 95)), 2),
            p99_ms=round(float(np.percentile(arr, 99)), 2),
            avg_ms=round(float(np.mean(arr)), 2),
        ))
    return result


@router.get("/journey/{session_id}", response_model=list[JourneyEvent])
def get_journey(session_id: str):
    """Full event timeline for a specific session."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT ts, event, context, session, attrs FROM journey_events "
        "WHERE session = ? ORDER BY ts",
        (session_id,),
    ).fetchall()
    conn.close()
    return [
        JourneyEvent(ts=ts, event=ev, context=ctx, session=sess, attrs=json.loads(attrs))
        for ts, ev, ctx, sess, attrs in rows
    ]


@router.get("/errors", response_model=list[ErrorEntry])
def get_errors(hours: int = Query(default=24, ge=1, le=720)):
    """Recent errors grouped by context and endpoint."""
    cutoff = time.time() - hours * 3600
    conn = _get_conn()
    rows = conn.execute(
        "SELECT path, context, COUNT(*) as cnt, MAX(ts) as last_ts "
        "FROM request_traces WHERE ts > ? AND status_code >= 400 "
        "GROUP BY path, context ORDER BY cnt DESC LIMIT 50",
        (cutoff,),
    ).fetchall()
    conn.close()
    return [
        ErrorEntry(path=p, context=c, count=cnt, last_ts=lt)
        for p, c, cnt, lt in rows
    ]


@router.get("/bottlenecks", response_model=list[BottleneckEntry])
def get_bottlenecks():
    """Top 10 slowest endpoints by P95 latency."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT path, duration_ms FROM request_traces ORDER BY path"
    ).fetchall()
    conn.close()

    from collections import defaultdict
    import numpy as np

    by_path: dict[str, list[float]] = defaultdict(list)
    for path, duration in rows:
        by_path[path].append(duration)

    entries = []
    for path, durations in by_path.items():
        arr = np.array(durations)
        entries.append(BottleneckEntry(
            path=path,
            p95_ms=round(float(np.percentile(arr, 95)), 2),
            max_ms=round(float(np.max(arr)), 2),
            count=len(arr),
        ))
    entries.sort(key=lambda x: x.p95_ms, reverse=True)
    return entries[:10]


@router.get("/drop-offs", response_model=list[DropOffEntry])
def get_drop_offs(hours: int = Query(default=24, ge=1, le=720)):
    """Steps where users abandon most frequently."""
    cutoff = time.time() - hours * 3600
    conn = _get_conn()
    conn.row_factory = sqlite3.Row

    entered = conn.execute(
        "SELECT context, COUNT(*) as cnt FROM journey_events "
        "WHERE ts > ? AND event = 'step_entered' GROUP BY context",
        (cutoff,),
    ).fetchall()
    completed = conn.execute(
        "SELECT context, COUNT(*) as cnt FROM journey_events "
        "WHERE ts > ? AND event = 'step_completed' GROUP BY context",
        (cutoff,),
    ).fetchall()
    conn.close()

    entered_map = {r["context"]: r["cnt"] for r in entered}
    completed_map = {r["context"]: r["cnt"] for r in completed}

    result = []
    for ctx in entered_map:
        e = entered_map[ctx]
        c = completed_map.get(ctx, 0)
        a = e - c
        result.append(DropOffEntry(
            context=ctx,
            entered=e,
            completed=c,
            abandoned=a,
            drop_off_pct=round(a / e * 100, 1) if e > 0 else 0.0,
        ))
    result.sort(key=lambda x: x.drop_off_pct, reverse=True)
    return result


@router.post("/event")
def receive_frontend_event(event: FrontendEvent):
    """Receive a journey event from the frontend."""
    emit(
        event.event,
        context=event.context,
        session=event.session,
        ts_client=event.ts or 0,
        **event.attrs,
    )
    return {"status": "ok"}
