"""User journey event emitter for observability."""

import json
import sqlite3
import time
import threading
from pathlib import Path

_DB_PATH = Path(__file__).resolve().parent.parent.parent.parent / "telemetry.db"
_lock = threading.Lock()
_initialized = False


def _ensure_db():
    global _initialized
    if _initialized:
        return
    with _lock:
        if _initialized:
            return
        conn = sqlite3.connect(str(_DB_PATH))
        conn.execute("""
            CREATE TABLE IF NOT EXISTS journey_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts REAL NOT NULL,
                event TEXT NOT NULL,
                context TEXT NOT NULL,
                session TEXT NOT NULL DEFAULT '',
                attrs TEXT NOT NULL DEFAULT '{}'
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS request_traces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts REAL NOT NULL,
                method TEXT NOT NULL,
                path TEXT NOT NULL,
                status_code INTEGER NOT NULL,
                duration_ms REAL NOT NULL,
                context TEXT NOT NULL DEFAULT ''
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_events_ts ON journey_events(ts)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_events_context ON journey_events(context)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_events_session ON journey_events(session)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_traces_ts ON request_traces(ts)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_traces_path ON request_traces(path)")
        conn.commit()
        conn.close()
        _initialized = True


def _get_conn() -> sqlite3.Connection:
    _ensure_db()
    return sqlite3.connect(str(_DB_PATH))


def emit(event: str, *, context: str, session: str = "", **attrs) -> None:
    """Emit a journey event to SQLite."""
    try:
        conn = _get_conn()
        conn.execute(
            "INSERT INTO journey_events (ts, event, context, session, attrs) VALUES (?, ?, ?, ?, ?)",
            (time.time(), event, context, session, json.dumps(attrs)),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[obs] Failed to emit event: {e}")


def record_request(method: str, path: str, status_code: int, duration_ms: float) -> None:
    """Record an API request trace to SQLite."""
    # Determine context from path prefix
    context = ""
    if "/analyze-portfolio" in path:
        context = "intake"
    elif "/simulate" in path or "/optimize" in path:
        context = "simulation"
    elif "/backtest" in path or "/crisis" in path:
        context = "simulation"
    elif "/insights" in path:
        context = "insights"
    elif "/portfolio" in path:
        context = "portfolio"
    elif "/fulfill" in path:
        context = "fulfill"
    elif "/obs" in path:
        context = "observability"

    try:
        conn = _get_conn()
        conn.execute(
            "INSERT INTO request_traces (ts, method, path, status_code, duration_ms, context) VALUES (?, ?, ?, ?, ?, ?)",
            (time.time(), method, path, status_code, duration_ms, context),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[obs] Failed to record request: {e}")
