"""SQLite cache for PIT bulk fetches.

Walk-forward backtests re-query the same (source, ticker, window) hundreds of
times as the `as_of` cursor rolls forward. We cache once per bulk window and
filter in Python — cheap compared to hammering EDGAR/GDELT/FRED on every step.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import threading
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from backtest.pit_data.types import PITEvent, Source, ensure_utc

logger = logging.getLogger(__name__)

DEFAULT_CACHE_PATH = Path(__file__).resolve().parent.parent / "cache.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS pit_cache (
    source TEXT NOT NULL,
    ticker TEXT NOT NULL,
    start_ts TEXT NOT NULL,
    end_ts TEXT NOT NULL,
    payload TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    PRIMARY KEY (source, ticker, start_ts, end_ts)
);
"""

_lock = threading.Lock()


def _connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.executescript(_SCHEMA)
    return conn


class PITCache:
    """Bulk-window cache keyed by (source, ticker, start, end)."""

    def __init__(self, path: Optional[Path] = None) -> None:
        self.path = Path(path) if path else DEFAULT_CACHE_PATH

    def get(
        self,
        source: Source,
        ticker: str,
        start: datetime,
        end: datetime,
    ) -> Optional[list[PITEvent]]:
        start_s = ensure_utc(start).isoformat()
        end_s = ensure_utc(end).isoformat()
        with _lock, _connect(self.path) as conn:
            row = conn.execute(
                "SELECT payload FROM pit_cache WHERE source=? AND ticker=? AND start_ts=? AND end_ts=?",
                (source.value, ticker or "", start_s, end_s),
            ).fetchone()
        if not row:
            return None
        return [_deserialize(d) for d in json.loads(row[0])]

    def put(
        self,
        source: Source,
        ticker: str,
        start: datetime,
        end: datetime,
        events: list[PITEvent],
    ) -> None:
        start_s = ensure_utc(start).isoformat()
        end_s = ensure_utc(end).isoformat()
        payload = json.dumps([_serialize(e) for e in events])
        now = datetime.now(timezone.utc).isoformat()
        with _lock, _connect(self.path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO pit_cache "
                "(source, ticker, start_ts, end_ts, payload, fetched_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (source.value, ticker or "", start_s, end_s, payload, now),
            )
            conn.commit()

    def clear(self) -> None:
        with _lock, _connect(self.path) as conn:
            conn.execute("DELETE FROM pit_cache")
            conn.commit()


def _serialize(e: PITEvent) -> dict:
    d = asdict(e)
    d["source"] = e.source.value
    d["published_at"] = e.published_at.isoformat()
    return d


def _deserialize(d: dict) -> PITEvent:
    return PITEvent(
        source=Source(d["source"]),
        ticker=d.get("ticker"),
        published_at=datetime.fromisoformat(d["published_at"]),
        title=d.get("title", ""),
        body=d.get("body", ""),
        url=d.get("url", ""),
        extra=d.get("extra", {}) or {},
    )


def get_default_cache() -> PITCache:
    override = os.getenv("PIT_CACHE_PATH")
    return PITCache(Path(override)) if override else PITCache()
