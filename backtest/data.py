"""Bar loader for backtests — uses Polygon via existing agents.market_data.

Returns a wide DataFrame: rows = trading days, columns = symbols,
values = adjusted close prices. Missing tickers are dropped with a warning
rather than failing the run, because the swarm watchlist often contains
symbols that weren't public for the entire backtest window.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Iterable

import pandas as pd

from agents import market_data

logger = logging.getLogger(__name__)


async def _load_one(symbol: str, start: str, end: str) -> pd.Series:
    bars = await market_data.get_price_history(symbol, start=start, end=end)
    if not bars:
        return pd.Series(dtype=float, name=symbol)
    df = pd.DataFrame(bars)
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    return df["close"].rename(symbol)


async def load_bars_async(
    symbols: Iterable[str],
    start: str,
    end: str,
) -> pd.DataFrame:
    """Fetch bars for `symbols` over [start, end]. Dates as YYYY-MM-DD strings."""
    tasks = [_load_one(s, start, end) for s in symbols]
    series = await asyncio.gather(*tasks)
    non_empty = [s for s in series if not s.empty]
    missing = [s.name for s in series if s.empty]
    if missing:
        logger.warning(f"No bars returned for {len(missing)} symbols: {missing[:5]}...")
    if not non_empty:
        raise RuntimeError(f"No bars available for any of {list(symbols)} in [{start}, {end}]")
    df = pd.concat(non_empty, axis=1).sort_index()
    # Forward-fill small gaps (holidays etc.) but keep leading NaNs so symbols
    # that listed mid-window stay untradable until their first real bar.
    df = df.ffill(limit=5)
    return df


def load_bars(symbols: Iterable[str], start: str, end: str) -> pd.DataFrame:
    """Synchronous convenience wrapper."""
    return asyncio.run(load_bars_async(list(symbols), start, end))


def validate_window(bars: pd.DataFrame, min_days: int = 20) -> None:
    if len(bars) < min_days:
        raise ValueError(f"Backtest window too short: {len(bars)} bars < min {min_days}")
