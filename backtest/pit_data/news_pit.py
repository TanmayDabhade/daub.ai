"""Point-in-time news via GDELT 2.0 DOC API.

GDELT is free, requires no key, and covers global news every 15 minutes since
Feb 2015. Good enough as a baseline sentiment feed for backtests; the plan is
to layer Polygon News on top when we upgrade that tier.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from backtest.pit_data.cache import PITCache, get_default_cache
from backtest.pit_data.types import PITEvent, Source, assert_pit, ensure_utc

logger = logging.getLogger(__name__)

GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
GDELT_MIN_DATE = datetime(2015, 2, 18, tzinfo=timezone.utc)


async def fetch_all(
    ticker: str,
    start: datetime,
    end: datetime,
    company_name: str = "",
    max_records: int = 250,
    cache: Optional[PITCache] = None,
) -> list[PITEvent]:
    """Bulk fetch GDELT articles matching `ticker` or `company_name`.

    GDELT's DOC API caps `maxrecords` at 250 per call. For windows that
    exceed that we accept the truncation rather than paginate aggressively
    — the ranked-by-relevance subset is fine for sentiment signals.
    """
    cache = cache or get_default_cache()
    cached = cache.get(Source.GDELT, ticker, start, end)
    if cached is not None:
        return cached

    start_utc = max(ensure_utc(start), GDELT_MIN_DATE)
    end_utc = ensure_utc(end)
    if end_utc <= start_utc:
        cache.put(Source.GDELT, ticker, start, end, [])
        return []

    query = f'"{company_name}"' if company_name else f'"{ticker}"'
    params = {
        "query": query,
        "mode": "ArtList",
        "format": "json",
        "maxrecords": str(max_records),
        "startdatetime": start_utc.strftime("%Y%m%d%H%M%S"),
        "enddatetime": end_utc.strftime("%Y%m%d%H%M%S"),
        "sort": "datedesc",
    }
    events: list[PITEvent] = []
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(GDELT_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning(f"GDELT fetch failed for {ticker}: {e}")
        return []

    for art in data.get("articles", []):
        seendate = _parse_gdelt_date(art.get("seendate", ""))
        if seendate is None:
            continue
        events.append(PITEvent(
            source=Source.GDELT,
            ticker=ticker,
            published_at=seendate,
            title=art.get("title", ""),
            url=art.get("url", ""),
            extra={
                "domain": art.get("domain", ""),
                "language": art.get("language", ""),
                "sourcecountry": art.get("sourcecountry", ""),
            },
        ))

    cache.put(Source.GDELT, ticker, start, end, events)
    return events


async def fetch(
    ticker: str,
    as_of: datetime,
    lookback_days: int = 7,
    company_name: str = "",
    cache: Optional[PITCache] = None,
) -> list[PITEvent]:
    """Return news visible as of `as_of`, looking back `lookback_days`."""
    as_of = ensure_utc(as_of)
    start = as_of - timedelta(days=lookback_days)
    events = await fetch_all(ticker, start, as_of, company_name, cache=cache)
    return assert_pit(events, as_of)


def _parse_gdelt_date(s: str) -> Optional[datetime]:
    """GDELT seendate is YYYYMMDDTHHMMSSZ."""
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        return None
