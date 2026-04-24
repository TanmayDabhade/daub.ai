"""Point-in-time macro series via ALFRED (Archival FRED).

FRED's standard API returns the *latest-revised* value for every observation,
which leaks future information: the CPI print you see today reflects revisions
published months later. ALFRED's `realtime_start`/`realtime_end` parameters
pin the series to the vintage as-known on a given date — the number as it
was first released. This is what the macro analyst must see during backtest.

Requires FRED_API_KEY (free, https://fred.stlouisfed.org/docs/api/api_key.html).
"""

from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

import httpx

from agents.config import FRED_API_KEY
from backtest.pit_data.cache import PITCache, get_default_cache
from backtest.pit_data.types import PITEvent, Source, assert_pit, ensure_utc

logger = logging.getLogger(__name__)

FRED_URL = "https://api.stlouisfed.org/fred/series/observations"

# Headline series the macro analyst watches. Each is PIT-sensitive (revised).
DEFAULT_SERIES = (
    "CPIAUCSL",   # Consumer Price Index (all urban)
    "UNRATE",     # Unemployment rate
    "GDPC1",      # Real GDP
    "FEDFUNDS",   # Fed funds rate
    "DGS10",      # 10-year Treasury
    "PAYEMS",     # Nonfarm payrolls
)


async def fetch_all(
    series_id: str,
    start: datetime,
    end: datetime,
    cache: Optional[PITCache] = None,
) -> list[PITEvent]:
    """Bulk fetch observations for `series_id` released in [start, end].

    Uses ALFRED realtime window = [start, end] so every observation is the
    value AS FIRST RELEASED within that window (no future revisions leak in).
    """
    cache = cache or get_default_cache()
    cached = cache.get(Source.ALFRED, series_id, start, end)
    if cached is not None:
        return cached

    if not FRED_API_KEY:
        logger.warning(f"FRED_API_KEY not set — returning empty macro series {series_id}")
        cache.put(Source.ALFRED, series_id, start, end, [])
        return []

    start_utc = ensure_utc(start)
    end_utc = ensure_utc(end)

    params = {
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "realtime_start": start_utc.date().isoformat(),
        "realtime_end": end_utc.date().isoformat(),
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(FRED_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning(f"ALFRED fetch failed for {series_id}: {e}")
        return []

    events: list[PITEvent] = []
    for obs in data.get("observations", []):
        # `realtime_start` on the observation is when the market could first
        # see this value — treat that as the publication timestamp.
        rt_start = _parse_date(obs.get("realtime_start"))
        if rt_start is None:
            continue
        published_at = datetime.combine(rt_start, time(8, 30), tzinfo=timezone.utc)
        value_str = obs.get("value")
        if value_str in (None, ".", ""):
            continue
        try:
            value = float(value_str)
        except ValueError:
            continue
        events.append(PITEvent(
            source=Source.ALFRED,
            ticker=None,
            published_at=published_at,
            title=f"{series_id} = {value} (obs {obs.get('date')})",
            extra={
                "series_id": series_id,
                "observation_date": obs.get("date"),
                "value": value,
                "realtime_start": obs.get("realtime_start"),
                "realtime_end": obs.get("realtime_end"),
            },
        ))

    cache.put(Source.ALFRED, series_id, start, end, events)
    return events


async def fetch(
    series_id: str,
    as_of: datetime,
    lookback_days: int = 90,
    cache: Optional[PITCache] = None,
) -> list[PITEvent]:
    """Return macro releases for `series_id` visible as of `as_of`."""
    as_of = ensure_utc(as_of)
    start = as_of - timedelta(days=lookback_days)
    events = await fetch_all(series_id, start, as_of, cache)
    return assert_pit(events, as_of)


async def fetch_bundle(
    as_of: datetime,
    series_ids: tuple[str, ...] = DEFAULT_SERIES,
    lookback_days: int = 90,
    cache: Optional[PITCache] = None,
) -> dict[str, list[PITEvent]]:
    """Fetch the full macro dashboard visible as of `as_of`."""
    out: dict[str, list[PITEvent]] = {}
    for sid in series_ids:
        out[sid] = await fetch(sid, as_of, lookback_days, cache)
    return out


def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        return None
