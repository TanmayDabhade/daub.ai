"""Tests for the Signal Aggregator."""

import json
import pytest
from unittest.mock import patch, MagicMock

from agents.signal_aggregator import aggregate_signals, aggregate_all


MOCK_AGGREGATION_RESPONSE = json.dumps({
    "ticker": "NVDA",
    "timestamp": "2026-04-10T09:00:00Z",
    "direction": "long",
    "composite_score": 0.65,
    "confidence": 0.82,
    "contributing_signals": [
        {
            "agent_type": "filing",
            "signal_type": "revenue_surprise",
            "sentiment": "positive",
            "confidence": 0.9,
            "summary": "Revenue exceeded expectations"
        },
        {
            "agent_type": "sentiment",
            "signal_type": "analyst_action",
            "sentiment": "positive",
            "confidence": 0.75,
            "summary": "Multiple price target raises"
        }
    ],
    "conflicts": [
        {
            "description": "Filing shows export risk, but sentiment is bullish",
            "agents_involved": ["filing", "sentiment"],
            "resolution": "Net positive — revenue growth outweighs regulatory risk"
        }
    ],
    "macro_context": "Risk-off regime tempers conviction",
    "reasoning": "Strong convergence across agents with one notable conflict."
})


@pytest.mark.asyncio
async def test_aggregate_signals_success():
    analyses = [
        {
            "agent_type": "filing",
            "ticker": "NVDA",
            "signals": [{"type": "revenue_surprise", "confidence": 0.9}],
            "overall_sentiment": 0.5,
            "recommendation": "buy",
        },
        {
            "agent_type": "sentiment",
            "ticker": "NVDA",
            "signals": [{"type": "analyst_action", "confidence": 0.75}],
            "overall_sentiment": 0.3,
            "recommendation": "hold",
        },
    ]

    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=MOCK_AGGREGATION_RESPONSE)]

    with patch("agents.signal_aggregator.ANTHROPIC_API_KEY", "test-key"), \
         patch("agents.signal_aggregator.anthropic") as mock_anthropic, \
         patch("agents.signal_aggregator.db") as mock_db:

        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_response
        mock_anthropic.Anthropic.return_value = mock_client

        result = await aggregate_signals("NVDA", analyses)

        assert result is not None
        assert result["ticker"] == "NVDA"
        assert result["direction"] == "long"
        assert result["composite_score"] == 0.65
        assert result["confidence"] == 0.82
        assert len(result["conflicts"]) == 1

        # Should store signal since confidence >= 0.7
        mock_db.insert_signal.assert_called_once()


@pytest.mark.asyncio
async def test_aggregate_signals_no_analyses():
    with patch("agents.signal_aggregator.ANTHROPIC_API_KEY", "test-key"):
        result = await aggregate_signals("NVDA", [])
        assert result is None


@pytest.mark.asyncio
async def test_aggregate_signals_no_api_key():
    with patch("agents.signal_aggregator.ANTHROPIC_API_KEY", ""):
        result = await aggregate_signals("NVDA", [{"test": True}])
        assert result is None


@pytest.mark.asyncio
async def test_aggregate_all_sorts_by_score():
    """Test that aggregate_all returns signals sorted by absolute composite score."""
    response_high = json.dumps({
        "ticker": "NVDA", "direction": "long", "composite_score": 0.85,
        "confidence": 0.9, "contributing_signals": [], "conflicts": [],
        "reasoning": "Strong", "timestamp": "2026-04-10T09:00:00Z",
    })
    response_low = json.dumps({
        "ticker": "AAPL", "direction": "long", "composite_score": 0.3,
        "confidence": 0.72, "contributing_signals": [], "conflicts": [],
        "reasoning": "Moderate", "timestamp": "2026-04-10T09:00:00Z",
    })

    call_count = 0

    def create_side_effect(**kwargs):
        nonlocal call_count
        call_count += 1
        mock_resp = MagicMock()
        mock_resp.content = [MagicMock(text=response_high if call_count == 1 else response_low)]
        return mock_resp

    with patch("agents.signal_aggregator.ANTHROPIC_API_KEY", "test-key"), \
         patch("agents.signal_aggregator.anthropic") as mock_anthropic, \
         patch("agents.signal_aggregator.db"):

        mock_client = MagicMock()
        mock_client.messages.create.side_effect = create_side_effect
        mock_anthropic.Anthropic.return_value = mock_client

        results = await aggregate_all({
            "NVDA": [{"agent_type": "filing", "signals": []}],
            "AAPL": [{"agent_type": "filing", "signals": []}],
        })

        assert len(results) == 2
        # Should be sorted by absolute composite score (highest first)
        assert abs(results[0]["composite_score"]) >= abs(results[1]["composite_score"])
