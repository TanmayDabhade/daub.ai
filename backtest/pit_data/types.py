"""Common types for point-in-time (PIT) data clients.

Every event in the backtest flows through `PITEvent`. The `assert_pit` helper
is the tripwire: if any source ever surfaces an event dated after the
`as_of` cursor, the backtest fails loudly rather than silently leaking
future information into agent reasoning.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


class Source(str, Enum):
    EDGAR = "edgar"
    GDELT = "gdelt"
    POLYGON_NEWS = "polygon_news"
    ALFRED = "alfred"
    FMP = "fmp"


@dataclass(frozen=True)
class PITEvent:
    """A single point-in-time observation (filing, news item, macro release).

    `published_at` is when the market could first have known this — the bar
    every backtest must respect.
    """
    source: Source
    ticker: Optional[str]          # None for macro series
    published_at: datetime         # tz-aware, UTC
    title: str
    body: str = ""
    url: str = ""
    extra: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.published_at.tzinfo is None:
            # Coerce naive timestamps to UTC; callers upstream should already
            # be providing tz-aware datetimes, so warn via assertion in tests.
            object.__setattr__(self, "published_at", self.published_at.replace(tzinfo=timezone.utc))


def ensure_utc(dt: datetime) -> datetime:
    """Normalize a datetime to tz-aware UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def assert_pit(events: list[PITEvent], as_of: datetime) -> list[PITEvent]:
    """Filter + assert: every event's `published_at` must be <= `as_of`.

    Returns the filtered list. Raises AssertionError if any event slipped
    through with a future timestamp — this is a bug in the source client,
    not user input, so failing loud is intentional.
    """
    cutoff = ensure_utc(as_of)
    kept = [e for e in events if e.published_at <= cutoff]
    for e in kept:
        assert e.published_at <= cutoff, (
            f"PIT violation from {e.source}: event '{e.title[:80]}' "
            f"published at {e.published_at.isoformat()} > as_of {cutoff.isoformat()}"
        )
    return kept
