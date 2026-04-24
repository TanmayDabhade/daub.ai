"""Lean pandas-based backtest engine.

Strategies return *target weights* per symbol on each rebalance date; the
engine rebalances the portfolio toward those weights using the day's close
price, applying slippage and commission. Equity curve is marked to the
next day's open/close so baselines are apples-to-apples with live trading.

Why not vectorbt: we don't need 10k-strategy parameter sweeps. We need one
swarm decision per rebalance and a QuantStats tear sheet. Pandas is enough.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional

import numpy as np
import pandas as pd


# A strategy receives the as-of date and a slice of bars up to (and including)
# that date, and returns target weights {symbol: fraction_of_equity}. Weights
# are clamped to [0, 1] per symbol (long-only) and need not sum to 1 — cash is
# the remainder.
StrategyFn = Callable[[pd.Timestamp, pd.DataFrame], dict[str, float]]


@dataclass
class BacktestConfig:
    initial_capital: float = 100_000.0
    slippage_bps: float = 5.0          # applied on every rebalance trade
    commission_per_trade: float = 0.0  # flat $ per fill
    rebalance: str = "W"               # pandas offset alias: "D", "W", "M", "Q"
    min_weight_change: float = 0.01    # skip trades smaller than this weight delta


@dataclass
class BacktestResult:
    equity_curve: pd.Series             # indexed by date, $ portfolio value
    returns: pd.Series                  # daily pct returns
    weights: pd.DataFrame               # target weights per rebalance date
    trades: pd.DataFrame                # [date, symbol, side, shares, price, cost]
    config: BacktestConfig
    final_cash: float
    final_positions: dict[str, float]   # symbol -> shares


def run_backtest(
    bars: pd.DataFrame,
    strategy: StrategyFn,
    config: Optional[BacktestConfig] = None,
) -> BacktestResult:
    """Run a target-weight backtest.

    `bars` is a wide frame of closing prices, indexed by date (DatetimeIndex,
    ascending), one column per symbol. Missing values are treated as
    "symbol not yet tradable" and skipped when rebalancing.
    """
    cfg = config or BacktestConfig()
    if bars.empty:
        raise ValueError("bars is empty")
    if not isinstance(bars.index, pd.DatetimeIndex):
        raise ValueError("bars must have a DatetimeIndex")
    bars = bars.sort_index()

    rebalance_dates = _rebalance_dates(bars.index, cfg.rebalance)
    cash = cfg.initial_capital
    positions: dict[str, float] = {}          # symbol -> shares
    weights_log: list[tuple[pd.Timestamp, dict[str, float]]] = []
    trade_rows: list[dict] = []
    equity_points: list[tuple[pd.Timestamp, float]] = []

    for dt in bars.index:
        prices = bars.loc[dt]

        if dt in rebalance_dates:
            target = strategy(dt, bars.loc[:dt])
            target = _sanitize_weights(target, prices)
            weights_log.append((dt, target))

            equity = _mark_to_market(cash, positions, prices)
            cash, positions, fills = _rebalance(
                equity, cash, positions, target, prices, cfg
            )
            for f in fills:
                trade_rows.append({"date": dt, **f})

        equity = _mark_to_market(cash, positions, prices)
        equity_points.append((dt, equity))

    eq_idx, eq_vals = zip(*equity_points)
    equity_curve = pd.Series(eq_vals, index=pd.DatetimeIndex(eq_idx), name="equity")
    returns = equity_curve.pct_change().fillna(0.0).rename("returns")

    weights_df = pd.DataFrame(
        [w for _, w in weights_log],
        index=pd.DatetimeIndex([d for d, _ in weights_log]),
    ).fillna(0.0)

    trades_df = pd.DataFrame(trade_rows, columns=[
        "date", "symbol", "side", "shares", "price", "cost"
    ])

    return BacktestResult(
        equity_curve=equity_curve,
        returns=returns,
        weights=weights_df,
        trades=trades_df,
        config=cfg,
        final_cash=cash,
        final_positions=dict(positions),
    )


# --- Internals ----------------------------------------------------------

def _rebalance_dates(index: pd.DatetimeIndex, freq: str) -> set[pd.Timestamp]:
    """Pick one trading date per period (first day of each period in `index`)."""
    if freq == "D":
        return set(index)
    # Group by period-start and take the first trading date inside each.
    # Example: freq="W" → first trading day of each ISO week.
    periods = index.to_period(freq)
    df = pd.DataFrame({"dt": index, "period": periods})
    firsts = df.groupby("period")["dt"].min()
    return set(firsts)


def _sanitize_weights(target: dict[str, float], prices: pd.Series) -> dict[str, float]:
    """Drop symbols without price, clamp negatives to 0, cap total at 1.0."""
    cleaned: dict[str, float] = {}
    for sym, w in target.items():
        if sym not in prices.index:
            continue
        price = prices[sym]
        if pd.isna(price) or price <= 0:
            continue
        cleaned[sym] = max(0.0, float(w))
    total = sum(cleaned.values())
    if total > 1.0:
        scale = 1.0 / total
        cleaned = {s: w * scale for s, w in cleaned.items()}
    return cleaned


def _mark_to_market(
    cash: float, positions: dict[str, float], prices: pd.Series
) -> float:
    eq = cash
    for sym, shares in positions.items():
        px = prices.get(sym)
        if pd.notna(px):
            eq += shares * float(px)
    return eq


def _rebalance(
    equity: float,
    cash: float,
    positions: dict[str, float],
    target_weights: dict[str, float],
    prices: pd.Series,
    cfg: BacktestConfig,
) -> tuple[float, dict[str, float], list[dict]]:
    """Move holdings toward `target_weights`. Returns (new_cash, new_positions, fills)."""
    fills: list[dict] = []
    slip = cfg.slippage_bps / 10_000.0

    symbols = set(positions.keys()) | set(target_weights.keys())

    # First pass: sells (free up cash before buys).
    for sym in sorted(symbols):
        px = prices.get(sym)
        if pd.isna(px) or px is None or px <= 0:
            continue
        px = float(px)
        current_shares = positions.get(sym, 0.0)
        target_value = equity * target_weights.get(sym, 0.0)
        current_value = current_shares * px
        weight_delta = (target_value - current_value) / equity if equity > 0 else 0.0

        if abs(weight_delta) < cfg.min_weight_change or weight_delta >= 0:
            continue  # skip tiny/upward moves in sell pass

        delta_shares = (target_value - current_value) / px  # negative
        fill_price = px * (1 - slip)
        proceeds = -delta_shares * fill_price - cfg.commission_per_trade
        new_shares = current_shares + delta_shares
        if abs(new_shares) < 1e-9:
            positions.pop(sym, None)
        else:
            positions[sym] = new_shares
        cash += proceeds
        fills.append({
            "symbol": sym, "side": "sell", "shares": -delta_shares,
            "price": fill_price, "cost": -proceeds,
        })

    # Second pass: buys.
    for sym in sorted(symbols):
        px = prices.get(sym)
        if pd.isna(px) or px is None or px <= 0:
            continue
        px = float(px)
        current_shares = positions.get(sym, 0.0)
        target_value = equity * target_weights.get(sym, 0.0)
        current_value = current_shares * px
        weight_delta = (target_value - current_value) / equity if equity > 0 else 0.0

        if abs(weight_delta) < cfg.min_weight_change or weight_delta <= 0:
            continue

        fill_price = px * (1 + slip)
        desired_delta_shares = (target_value - current_value) / fill_price
        max_affordable = max(0.0, (cash - cfg.commission_per_trade) / fill_price)
        delta_shares = min(desired_delta_shares, max_affordable)
        if delta_shares <= 0:
            continue
        cost = delta_shares * fill_price + cfg.commission_per_trade
        positions[sym] = current_shares + delta_shares
        cash -= cost
        fills.append({
            "symbol": sym, "side": "buy", "shares": delta_shares,
            "price": fill_price, "cost": cost,
        })

    return cash, positions, fills
