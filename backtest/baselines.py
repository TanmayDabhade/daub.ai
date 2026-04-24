"""Baseline strategies — benchmarks the swarm must beat to matter for YC.

Each returns a `StrategyFn` compatible with `backtest.engine.run_backtest`.
"""

from __future__ import annotations

from typing import Iterable

import pandas as pd

from agents.config import WATCHLIST
from backtest.engine import StrategyFn


def spy_buy_hold() -> StrategyFn:
    """100% SPY, set once at t0 and held. The S&P 500 benchmark."""
    def strategy(date: pd.Timestamp, bars: pd.DataFrame) -> dict[str, float]:
        return {"SPY": 1.0}
    return strategy


def sixty_forty() -> StrategyFn:
    """Classic 60/40 stocks/bonds using SPY and AGG."""
    def strategy(date: pd.Timestamp, bars: pd.DataFrame) -> dict[str, float]:
        return {"SPY": 0.60, "AGG": 0.40}
    return strategy


def equal_weight(symbols: Iterable[str]) -> StrategyFn:
    """Equal-weight buy-and-hold across the given universe.

    Rebalancing frequency is controlled by the engine config, not the
    strategy — return the same target every call.
    """
    syms = list(symbols)
    if not syms:
        raise ValueError("equal_weight requires at least one symbol")
    weight = 1.0 / len(syms)

    def strategy(date: pd.Timestamp, bars: pd.DataFrame) -> dict[str, float]:
        # Only allocate to symbols that have a valid price as of `date`.
        prices = bars.loc[date]
        live = [s for s in syms if s in prices.index and pd.notna(prices[s])]
        if not live:
            return {}
        w = 1.0 / len(live)
        return {s: w for s in live}

    return strategy


def equal_weight_watchlist() -> StrategyFn:
    """Equal-weight across Swarm Capital's headline 27-ticker watchlist."""
    return equal_weight([item["ticker"] for item in WATCHLIST])


# Registry used by the CLI
REGISTRY = {
    "spy_buy_hold": spy_buy_hold,
    "sixty_forty": sixty_forty,
    "equal_weight_watchlist": equal_weight_watchlist,
}


def universe_for(strategy_name: str) -> list[str]:
    """Which symbols does the data loader need to fetch for this strategy?"""
    if strategy_name == "spy_buy_hold":
        return ["SPY"]
    if strategy_name == "sixty_forty":
        return ["SPY", "AGG"]
    if strategy_name == "equal_weight_watchlist":
        return [item["ticker"] for item in WATCHLIST]
    raise KeyError(f"Unknown strategy: {strategy_name}")
