"""Tests for the Filing Analyst Agent."""

import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock

from agents.filing_analyst import analyze_filing, SYSTEM_PROMPT


MOCK_ANALYSIS_RESPONSE = json.dumps({
    "ticker": "NVDA",
    "filing_type": "10-K",
    "filing_date": "2026-03-15",
    "signals": [
        {
            "type": "revenue_surprise",
            "description": "Revenue exceeded expectations by 12%",
            "sentiment": "positive",
            "confidence": 0.9,
            "evidence": "Total revenue was $35.1 billion..."
        },
        {
            "type": "risk_factor_change",
            "description": "New export control risk factor added",
            "sentiment": "negative",
            "confidence": 0.85,
            "evidence": "The Company faces risks related to..."
        }
    ],
    "overall_sentiment": 0.35,
    "recommendation": "hold",
    "reasoning": "Mixed signals from the filing."
})


@pytest.mark.asyncio
async def test_analyze_filing_success():
    mock_filings = [
        {
            "accession_number": "0001045810-26-000001",
            "filing_type": "10-K",
            "filing_date": "2026-03-15",
            "company_name": "NVIDIA Corporation",
            "url": "https://www.sec.gov/Archives/edgar/data/1045810/test.htm",
        }
    ]

    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=MOCK_ANALYSIS_RESPONSE)]

    with patch("agents.filing_analyst.get_recent_filings", new_callable=AsyncMock, return_value=mock_filings), \
         patch("agents.filing_analyst.get_filing_text", new_callable=AsyncMock, return_value="Sample filing text..."), \
         patch("agents.filing_analyst.ANTHROPIC_API_KEY", "test-key"), \
         patch("agents.filing_analyst.anthropic") as mock_anthropic, \
         patch("agents.filing_analyst.db") as mock_db:

        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_response
        mock_anthropic.Anthropic.return_value = mock_client

        result = await analyze_filing("NVDA")

        assert result is not None
        assert result["ticker"] == "NVDA"
        assert result["filing_type"] == "10-K"
        assert len(result["signals"]) == 2
        assert result["overall_sentiment"] == 0.35
        assert result["recommendation"] == "hold"

        # Verify db was called
        mock_db.insert_analysis.assert_called_once()


@pytest.mark.asyncio
async def test_analyze_filing_no_filings():
    with patch("agents.filing_analyst.get_recent_filings", new_callable=AsyncMock, return_value=[]), \
         patch("agents.filing_analyst.ANTHROPIC_API_KEY", "test-key"):
        result = await analyze_filing("FAKE")
        assert result is None


@pytest.mark.asyncio
async def test_analyze_filing_no_api_key():
    with patch("agents.filing_analyst.ANTHROPIC_API_KEY", ""):
        result = await analyze_filing("NVDA")
        assert result is None


def test_system_prompt_has_required_fields():
    """Verify the system prompt asks for all required output fields."""
    assert "ticker" in SYSTEM_PROMPT
    assert "signals" in SYSTEM_PROMPT
    assert "overall_sentiment" in SYSTEM_PROMPT
    assert "recommendation" in SYSTEM_PROMPT
    assert "confidence" in SYSTEM_PROMPT
