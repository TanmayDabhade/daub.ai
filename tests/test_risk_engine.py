"""Tests for the Risk & Position Sizing Engine."""

import pytest
from agents.risk_engine import (
    check_risk,
    calculate_position_size,
    check_stop_loss,
    check_drawdown,
)


class TestCheckRisk:
    def test_approves_valid_trade(self):
        candidate = {
            "ticker": "NVDA",
            "direction": "long",
            "confidence": 0.85,
            "composite_score": 0.7,
            "current_price": 900.0,
        }
        portfolio = {"total_value": 100_000, "cash": 80_000}
        result = check_risk(candidate, portfolio)
        assert result["approved"] is True
        assert result["ticker"] == "NVDA"
        assert "position" in result

    def test_rejects_low_confidence(self):
        candidate = {
            "ticker": "NVDA",
            "direction": "long",
            "confidence": 0.5,
            "composite_score": 0.3,
        }
        portfolio = {"total_value": 100_000, "cash": 80_000}
        result = check_risk(candidate, portfolio)
        assert result["approved"] is False
        assert any("Confidence" in r for r in result["reasons"])

    def test_rejects_no_trade_direction(self):
        candidate = {
            "ticker": "NVDA",
            "direction": "no_trade",
            "confidence": 0.85,
        }
        portfolio = {"total_value": 100_000, "cash": 80_000}
        result = check_risk(candidate, portfolio)
        assert result["approved"] is False

    def test_rejects_sector_overexposure(self):
        candidate = {
            "ticker": "GOOGL",
            "direction": "long",
            "confidence": 0.85,
            "composite_score": 0.7,
        }
        portfolio = {"total_value": 100_000, "cash": 80_000}
        # Already have 25% in Tech
        positions = [
            {"ticker": "AAPL", "market_value": 12_500},
            {"ticker": "MSFT", "market_value": 12_500},
        ]
        result = check_risk(candidate, portfolio, positions)
        assert result["approved"] is False
        assert any("Sector" in r for r in result["reasons"])

    def test_rejects_on_max_drawdown(self):
        candidate = {
            "ticker": "NVDA",
            "direction": "long",
            "confidence": 0.85,
        }
        portfolio = {"total_value": 88_000, "cash": 50_000, "initial_value": 100_000}
        result = check_risk(candidate, portfolio)
        assert result["approved"] is False
        assert any("drawdown" in r.lower() for r in result["reasons"])


class TestPositionSizing:
    def test_basic_sizing(self):
        result = calculate_position_size(
            confidence=0.85,
            portfolio_value=100_000,
        )
        assert result["position_value"] > 0
        assert result["pct_of_portfolio"] <= 0.05

    def test_higher_confidence_larger_position(self):
        low = calculate_position_size(confidence=0.7, portfolio_value=100_000)
        high = calculate_position_size(confidence=0.95, portfolio_value=100_000)
        assert high["position_value"] > low["position_value"]

    def test_shares_calculation(self):
        result = calculate_position_size(
            confidence=0.85,
            portfolio_value=100_000,
            current_price=50.0,
        )
        assert "shares" in result
        assert result["shares"] > 0
        assert result["actual_value"] <= result["position_value"]

    def test_zero_portfolio(self):
        result = calculate_position_size(
            confidence=0.85,
            portfolio_value=0,
        )
        assert result["position_value"] == 0


class TestStopLoss:
    def test_long_stop_loss_triggered(self):
        position = {"ticker": "NVDA", "entry_price": 100.0, "direction": "long"}
        assert check_stop_loss(position, 96.0) is True  # -4%

    def test_long_no_stop_loss(self):
        position = {"ticker": "NVDA", "entry_price": 100.0, "direction": "long"}
        assert check_stop_loss(position, 99.0) is False  # -1%

    def test_short_stop_loss_triggered(self):
        position = {"ticker": "NVDA", "entry_price": 100.0, "direction": "short"}
        assert check_stop_loss(position, 104.0) is True  # stock went up 4%, short loses

    def test_short_no_stop_loss(self):
        position = {"ticker": "NVDA", "entry_price": 100.0, "direction": "short"}
        assert check_stop_loss(position, 98.0) is False  # short is profitable


class TestDrawdown:
    def test_drawdown_breached(self):
        portfolio = {"total_value": 89_000, "peak_value": 100_000}
        assert check_drawdown(portfolio) is True  # -11%

    def test_drawdown_ok(self):
        portfolio = {"total_value": 95_000, "peak_value": 100_000}
        assert check_drawdown(portfolio) is False  # -5%

    def test_no_drawdown(self):
        portfolio = {"total_value": 105_000, "peak_value": 100_000}
        assert check_drawdown(portfolio) is False
