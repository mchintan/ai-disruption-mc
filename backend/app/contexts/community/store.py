"""SQLite store for published experiments."""

import json
import sqlite3
import time
import threading
from pathlib import Path

_DB_PATH = Path(__file__).resolve().parent.parent.parent.parent / "community.db"
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
            CREATE TABLE IF NOT EXISTS published_experiments (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                author_session TEXT NOT NULL DEFAULT '',
                portfolio_json TEXT NOT NULL,
                metrics_json TEXT NOT NULL DEFAULT '{}',
                dna_json TEXT NOT NULL DEFAULT '{}',
                published_at REAL NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_pub_at ON published_experiments(published_at)")
        conn.commit()
        conn.close()
        _initialized = True


def _conn() -> sqlite3.Connection:
    _ensure_db()
    return sqlite3.connect(str(_DB_PATH))


def publish(id: str, name: str, author: str, portfolio: dict, metrics: dict, dna: dict) -> None:
    conn = _conn()
    conn.execute(
        "INSERT OR REPLACE INTO published_experiments (id, name, author_session, portfolio_json, metrics_json, dna_json, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (id, name, author, json.dumps(portfolio), json.dumps(metrics), json.dumps(dna), time.time()),
    )
    conn.commit()
    conn.close()


def feed(sort_by: str = "published_at", limit: int = 20) -> list[dict]:
    conn = _conn()
    valid_sorts = {"published_at": "published_at DESC", "sharpe": "json_extract(metrics_json, '$.sharpe_ratio') DESC"}
    order = valid_sorts.get(sort_by, "published_at DESC")
    rows = conn.execute(
        f"SELECT id, name, author_session, portfolio_json, metrics_json, dna_json, published_at "
        f"FROM published_experiments ORDER BY {order} LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [
        {
            "id": r[0], "name": r[1], "author": r[2],
            "portfolio": json.loads(r[3]), "metrics": json.loads(r[4]),
            "dna": json.loads(r[5]), "published_at": r[6],
        }
        for r in rows
    ]


def get_experiment(id: str) -> dict | None:
    conn = _conn()
    row = conn.execute(
        "SELECT id, name, author_session, portfolio_json, metrics_json, dna_json, published_at "
        "FROM published_experiments WHERE id = ?", (id,),
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row[0], "name": row[1], "author": row[2],
        "portfolio": json.loads(row[3]), "metrics": json.loads(row[4]),
        "dna": json.loads(row[5]), "published_at": row[6],
    }
