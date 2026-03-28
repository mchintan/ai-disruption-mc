"""Encrypted OAuth token storage."""

import os
import sqlite3
import time
import threading
from pathlib import Path

from cryptography.fernet import Fernet


_DB_PATH = Path(__file__).resolve().parent.parent.parent.parent / "tokens.db"
_lock = threading.Lock()
_initialized = False

TOKEN_TTL = 86400  # 24 hours


def _get_key() -> bytes:
    key = os.getenv("TOKEN_ENCRYPTION_KEY", "")
    if not key:
        # Auto-generate for development (NOT production-safe)
        key = Fernet.generate_key().decode()
        os.environ["TOKEN_ENCRYPTION_KEY"] = key
    return key.encode()


def _ensure_db():
    global _initialized
    if _initialized:
        return
    with _lock:
        if _initialized:
            return
        conn = sqlite3.connect(str(_DB_PATH))
        conn.execute("""
            CREATE TABLE IF NOT EXISTS broker_tokens (
                session_id TEXT NOT NULL,
                broker TEXT NOT NULL,
                access_token BLOB NOT NULL,
                refresh_token BLOB,
                expires_at REAL,
                created_at REAL NOT NULL,
                PRIMARY KEY (session_id, broker)
            )
        """)
        conn.commit()
        conn.close()
        _initialized = True


def _get_conn() -> sqlite3.Connection:
    _ensure_db()
    return sqlite3.connect(str(_DB_PATH))


def store_token(session_id: str, broker: str, access_token: str, refresh_token: str = "") -> None:
    """Encrypt and store an OAuth token."""
    f = Fernet(_get_key())
    enc_access = f.encrypt(access_token.encode())
    enc_refresh = f.encrypt(refresh_token.encode()) if refresh_token else None

    conn = _get_conn()
    conn.execute(
        "INSERT OR REPLACE INTO broker_tokens (session_id, broker, access_token, refresh_token, created_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (session_id, broker, enc_access, enc_refresh, time.time()),
    )
    conn.commit()
    conn.close()


def get_token(session_id: str, broker: str) -> str | None:
    """Retrieve and decrypt an OAuth token. Returns None if expired or missing."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT access_token, created_at FROM broker_tokens WHERE session_id = ? AND broker = ?",
        (session_id, broker),
    ).fetchone()
    conn.close()

    if not row:
        return None

    enc_token, created_at = row
    if time.time() - created_at > TOKEN_TTL:
        delete_token(session_id, broker)
        return None

    f = Fernet(_get_key())
    return f.decrypt(enc_token).decode()


def delete_token(session_id: str, broker: str) -> None:
    """Remove a stored token."""
    conn = _get_conn()
    conn.execute(
        "DELETE FROM broker_tokens WHERE session_id = ? AND broker = ?",
        (session_id, broker),
    )
    conn.commit()
    conn.close()


def has_token(session_id: str, broker: str) -> bool:
    """Check if a valid token exists."""
    return get_token(session_id, broker) is not None
