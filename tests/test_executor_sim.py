"""Tests for the simulated broker (agents/executor.py).

These run in pure in-memory mode: Supabase and Polygon are stubbed out so the
suite is hermetic and does not hit the network.
"""

import pytest

from agents import executor, db


@pytest.fixture(autouse=True)
def _sim_isolation(monkeypatch):
    # Force in-memory fallback by pretending Supabase is unconfigured.
    monkeypatch.setattr(db, "_get_client", lambda: None)
    # Deterministic fill price.
    monkeypatch.setattr(executor, "_fetch_latest_price", lambda ticker: 100.0)
    # Zero slippage + commission for easy accounting math.
    monkeypatch.setattr(executor, "SIM_SLIPPAGE_BPS", 0.0)
    monkeypatch.setattr(executor, "SIM_COMMISSION_PER_TRADE", 0.0)
    monkeypatch.setattr(executor, "SIM_INITIAL_CAPITAL", 100_000.0)
    executor.reset_sim_state()
    yield
    executor.reset_sim_state()


class TestAccount:
    def test_initial_account(self):
        acct = executor.get_account()
        assert acct["cash"] == 100_000.0
        assert acct["equity"] == 100_000.0
        assert acct["portfolio_value"] == 100_000.0

    def test_no_positions_initially(self):
        assert executor.get_positions() == []


class TestBuy:
    def test_buy_reduces_cash_and_creates_position(self):
        order = executor.place_order("AAPL", qty=10, side="buy")
        assert order is not None
        assert order["status"] == "filled"
        assert order["fill_price"] == 100.0

        acct = executor.get_account()
        assert acct["cash"] == pytest.approx(99_000.0)

        positions = executor.get_positions()
        assert len(positions) == 1
        assert positions[0]["ticker"] == "AAPL"
        assert positions[0]["qty"] == 10
        assert positions[0]["avg_entry_price"] == 100.0

    def test_buy_averages_entry_on_add(self, monkeypatch):
        executor.place_order("AAPL", qty=10, side="buy")
        monkeypatch.setattr(executor, "_fetch_latest_price", lambda t: 120.0)
        executor.place_order("AAPL", qty=10, side="buy")
        pos = executor.get_positions()[0]
        assert pos["qty"] == 20
        assert pos["avg_entry_price"] == pytest.approx(110.0)

    def test_buy_rejected_on_insufficient_cash(self):
        order = executor.place_order("AAPL", qty=10_000, side="buy")
        assert order is None
        assert executor.get_account()["cash"] == 100_000.0


class TestSell:
    def test_sell_realizes_pnl(self, monkeypatch):
        executor.place_order("AAPL", qty=10, side="buy")  # @ 100
        monkeypatch.setattr(executor, "_fetch_latest_price", lambda t: 110.0)
        order = executor.place_order("AAPL", qty=10, side="sell")
        assert order is not None

        acct = executor.get_account()
        # 100k - 1000 (buy) + 1100 (sell) = 100_100
        assert acct["cash"] == pytest.approx(100_100.0)
        assert acct["realized_pnl"] == pytest.approx(100.0)
        assert executor.get_positions() == []

    def test_partial_sell_keeps_position(self, monkeypatch):
        executor.place_order("AAPL", qty=10, side="buy")
        monkeypatch.setattr(executor, "_fetch_latest_price", lambda t: 110.0)
        executor.place_order("AAPL", qty=4, side="sell")
        pos = executor.get_positions()[0]
        assert pos["qty"] == 6
        assert pos["avg_entry_price"] == 100.0  # unchanged on sell

    def test_sell_rejected_when_no_position(self):
        assert executor.place_order("AAPL", qty=1, side="sell") is None


class TestCloseAll:
    def test_close_all_flattens_book(self, monkeypatch):
        executor.place_order("AAPL", qty=5, side="buy")
        executor.place_order("MSFT", qty=5, side="buy")
        monkeypatch.setattr(executor, "_fetch_latest_price", lambda t: 110.0)
        results = executor.close_all_positions()
        assert len(results) == 2
        assert executor.get_positions() == []
        assert executor.get_account()["cash"] == pytest.approx(100_000.0 + 2 * (5 * 10))


class TestOrderValidation:
    def test_rejects_negative_qty(self):
        assert executor.place_order("AAPL", qty=-1, side="buy") is None

    def test_rejects_zero_qty(self):
        assert executor.place_order("AAPL", qty=0, side="buy") is None

    def test_rejects_bad_side(self):
        assert executor.place_order("AAPL", qty=1, side="moon") is None

    def test_rejects_when_no_price(self, monkeypatch):
        monkeypatch.setattr(executor, "_fetch_latest_price", lambda t: None)
        assert executor.place_order("AAPL", qty=1, side="buy") is None


class TestSlippage:
    def test_buy_pays_slippage_premium(self, monkeypatch):
        monkeypatch.setattr(executor, "SIM_SLIPPAGE_BPS", 50.0)  # 0.5%
        order = executor.place_order("AAPL", qty=1, side="buy")
        assert order["fill_price"] == pytest.approx(100.5)

    def test_sell_receives_slippage_discount(self, monkeypatch):
        executor.place_order("AAPL", qty=1, side="buy")
        monkeypatch.setattr(executor, "SIM_SLIPPAGE_BPS", 50.0)
        order = executor.place_order("AAPL", qty=1, side="sell")
        assert order["fill_price"] == pytest.approx(99.5)
