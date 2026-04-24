"""Point-in-time SEC EDGAR filings.

EDGAR is natively PIT: each filing carries an accepted/filed date. We reuse
`agents.edgar_client.get_recent_filings` for the bulk fetch, then filter by
`as_of` before handing events to analysts.
"""

from __future__ import annotations

import logging
from datetime import datetime, time, timezone
from typing import Optional

from agents import edgar_client
from backtest.pit_data.cache import PITCache, get_default_cache
from backtest.pit_data.types import PITEvent, Source, assert_pit, ensure_utc

logger = logging.getLogger(__name__)

DEFAULT_FILING_TYPES = ("10-K", "10-Q", "8-K")


async def fetch_all(
    ticker: str,
    start: datetime,
    end: datetime,
    filing_types: tuple[str, ...] = DEFAULT_FILING_TYPES,
    cache: Optional[PITCache] = None,
    bulk_limit: int = 40,
) -> list[PITEvent]:
    """Bulk fetch filings in [start, end]. Cached per (ticker, window)."""
    cache = cache or get_default_cache()
    cached = cache.get(Source.EDGAR, ticker, start, end)
    if cached is not None:
        return cached

    filings = await edgar_client.get_recent_filings(
        ticker, filing_types=list(filing_types), limit=bulk_limit
    )
    start_utc = ensure_utc(start)
    end_utc = ensure_utc(end)

    events: list[PITEvent] = []
    for f in filings:
        published_at = _parse_filing_date(f.get("filing_date", ""))
        if published_at is None:
            continue
        if not (start_utc <= published_at <= end_utc):
            continue
        events.append(PITEvent(
            source=Source.EDGAR,
            ticker=ticker,
            published_at=published_at,
            title=f"{f.get('filing_type', 'FILING')} — {f.get('company_name', ticker)}",
            url=f.get("url", ""),
            extra={
                "accession_number": f.get("accession_number", ""),
                "filing_type": f.get("filing_type", ""),
            },
        ))

    cache.put(Source.EDGAR, ticker, start, end, events)
    return events


async def fetch(
    ticker: str,
    as_of: datetime,
    lookback_days: int = 365,
    filing_types: tuple[str, ...] = DEFAULT_FILING_TYPES,
    cache: Optional[PITCache] = None,
) -> list[PITEvent]:
    """Return filings visible as of `as_of`, looking back `lookback_days`."""
    as_of = ensure_utc(as_of)
    from datetime import timedelta
    start = as_of - timedelta(days=lookback_days)
    events = await fetch_all(ticker, start, as_of, filing_types, cache)
    return assert_pit(events, as_of)


def _parse_filing_date(s: str) -> Optional[datetime]:
    """EDGAR filing dates are YYYY-MM-DD (local filing date, treated as UTC EOD)."""
    if not s:
        return None
    try:
        d = datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        return None
    return datetime.combine(d, time(23, 59, 59), tzinfo=timezone.utc)
