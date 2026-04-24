"""Tests for the pandas backtest engine.

Uses deterministic synthetic bars so we can check the equity curve, trades,
and stats pipeline without hitting Polygon.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from backtest import baselines, report
from backtest.engine import BacktestConfig, run_backtest


def _synthetic_bars(days: int = 252, seed: int = 42) -> pd.DataFrame:
    """Two tickers (AAA, BBB) + SPY. AAA drifts up 0.05% / day, BBB flat."""
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range("2022-01-03", periods=days)
    aaa = 100 * np.cumprod(1 + rng.normal(0.0005, 0.01, days))
    bbb = 100 * np.cumprod(1 + rng.normal(0.0, 0.008, days))
    spy = 400 * np.cumprod(1 + rng.normal(0.0003, 0.01, days))
    return pd.DataFrame({"AAA": aaa, "BBB": bbb, "SPY": spy}, index=dates)


class TestBuyHold:
    def test_spy_buy_hold_matches_benchmark_return(self):
        bars = _synthetic_bars()
        strategy = baselines.spy_buy_hold()
        cfg = BacktestConfig(initial_capital=100_000.0, slippage_bps=0.0, rebalance="D")
        result = run_backtest(bars, strategy, cfg)

        # After day 1 rebalance, we hold 100% SPY, so portfolio return ≈ SPY return.
        spy_total_return = bars["SPY"].iloc[-1] / bars["SPY"].iloc[0] - 1
        portfolio_return = result.equity_curve.iloc[-1] / 100_000.0 - 1
        assert abs(portfolio_return - spy_total_return) < 0.01

    def test_buy_hold_generates_one_initial_trade(self):
        bars = _synthetic_bars()
        strategy = baselines.spy_buy_hold()
        cfg = BacktestConfig(rebalance="Q", slippage_bps=0.0)  # quarterly
        result = run_backtest(bars, strategy, cfg)
        # Target doesn't change, so only the initial SPY buy should produce a fill.
        assert (result.trades["side"] == "buy").sum() == 1
        assert (result.trades["side"] == "sell").sum() == 0


class TestEqualWeight:
    def test_equal_weight_splits_capital(self):
        bars = _synthetic_bars()
        strategy = baselines.equal_weight(["AAA", "BBB"])
        cfg = BacktestConfig(initial_capital=100_000.0, slippage_bps=0.0, rebalance="Q")
        result = run_backtest(bars, strategy, cfg)
        # After first rebalance, roughly 50/50 by dollar value.
        first_rebalance = result.weights.iloc[0]
        assert pytest.approx(first_rebalance["AAA"], abs=0.01) == 0.5
        assert pytest.approx(first_rebalance["BBB"], abs=0.01) == 0.5

    def test_slippage_reduces_final_equity(self):
        bars = _synthetic_bars()
        strategy = baselines.equal_weight(["AAA", "BBB"])
        zero = run_backtest(bars, strategy, BacktestConfig(slippage_bps=0.0, rebalance="M"))
        costly = run_backtest(bars, strategy, BacktestConfig(slippage_bps=50.0, rebalance="M"))
        assert costly.equity_curve.iloc[-1] < zero.equity_curve.iloc[-1]


class TestWeightSanitation:
    def test_weights_over_100pct_are_scaled(self):
        def greedy(date, bars):
            return {"AAA": 0.8, "BBB": 0.8}  # 160% notional
        bars = _synthetic_bars()
        cfg = BacktestConfig(initial_capital=100_000.0, slippage_bps=0.0, rebalance="Q")
        result = run_backtest(bars, greedy, cfg)
        # After scaling, 50/50 and no negative cash.
        assert result.final_cash >= -1e-6
        last_weights = result.weights.iloc[0]
        assert pytest.approx(last_weights["AAA"], abs=0.01) == 0.5
        assert pytest.approx(last_weights["BBB"], abs=0.01) == 0.5

    def test_missing_symbol_is_skipped(self):
        def bad(date, bars):
            return {"AAA": 0.5, "GHOST": 0.5}
        bars = _synthetic_bars()
        result = run_backtest(bars, bad, BacktestConfig(slippage_bps=0.0, rebalance="Q"))
        # GHOST has no price so only AAA is taken; weight sum < 1.0 is fine.
        assert "GHOST" not in result.weights.columns or result.weights["GHOST"].sum() == 0


class TestReportStats:
    def test_compute_stats_on_buy_hold(self):
        bars = _synthetic_bars(days=504)  # ~2 years
        result = run_backtest(bars, baselines.spy_buy_hold(), BacktestConfig(rebalance="D", slippage_bps=0.0))
        stats = report.compute_stats(result.returns, result.trades)
        # Sanity checks: finite numbers, vol is positive, drawdown <= 0.
        assert np.isfinite(stats.sharpe)
        assert stats.volatility > 0
        assert stats.max_drawdown <= 0
        assert stats.num_trades == 1
