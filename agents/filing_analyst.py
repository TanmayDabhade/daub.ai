"""Filing Analyst Agent — Analyzes SEC 10-K, 10-Q, and 8-K filings."""

import json
import logging
from typing import Optional

import anthropic

from agents.config import ANTHROPIC_API_KEY, DEEP_MODEL
from agents import db
from agents.edgar_client import get_recent_filings, get_filing_text

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert SEC filing analyst at an AI-native hedge fund. Your job is to analyze SEC filings (10-K, 10-Q, 8-K) and extract actionable trading signals.

For each filing, analyze:
1. Revenue/earnings vs. prior period — look for surprises
2. Risk factor changes — new risks added, language shifts
3. Management discussion tone shifts between filings
4. Related party transactions and insider activity
5. Off-balance-sheet items and contingent liabilities
6. Guidance language — hedging words vs. confidence indicators
7. Any material changes that the market may not have fully priced in

Be specific. Quote exact passages as evidence. Assign confidence scores honestly — 0.5 means uncertain, 0.9+ means very high conviction.

Respond with ONLY valid JSON matching this schema:
{
  "ticker": "string",
  "filing_type": "string",
  "filing_date": "string",
  "signals": [
    {
      "type": "string (one of: revenue_surprise, risk_factor_change, guidance_change, insider_activity, off_balance_sheet, tone_shift, material_event)",
      "description": "string — what you found",
      "sentiment": "string (positive, negative, neutral)",
      "confidence": "float 0-1",
      "evidence": "string — exact quote from filing"
    }
  ],
  "overall_sentiment": "float -1 to 1",
  "recommendation": "string (buy, sell, hold, reduce_exposure, increase_exposure)",
  "reasoning": "string — multi-paragraph analysis"
}"""


async def analyze_filing(ticker: str, filing_type: str = None) -> Optional[dict]:
    """Analyze the most recent filing for a ticker.

    Args:
        ticker: Stock ticker symbol
        filing_type: Specific filing type to analyze, or None for latest of any type

    Returns:
        Structured analysis dict, or None if analysis fails
    """
    if not ANTHROPIC_API_KEY:
        logger.warning("Anthropic API key not configured — skipping filing analysis")
        return None

    filing_types = [filing_type] if filing_type else ["10-K", "10-Q", "8-K"]
    filings = await get_recent_filings(ticker, filing_types=filing_types, limit=1)

    if not filings:
        logger.warning(f"No recent filings found for {ticker}")
        return None

    filing = filings[0]
    logger.info(f"Analyzing {filing['filing_type']} for {ticker} filed {filing['filing_date']}")

    filing_text = await get_filing_text(filing["url"])
    if not filing_text:
        logger.error(f"Could not fetch filing text for {ticker}")
        return None

    # Also try to get previous filing of same type for comparison
    previous_text = ""
    if filing_type or filing["filing_type"] in ["10-K", "10-Q"]:
        prev_filings = await get_recent_filings(
            ticker,
            filing_types=[filing["filing_type"]],
            limit=2,
        )
        if len(prev_filings) > 1:
            prev_text = await get_filing_text(prev_filings[1]["url"], max_chars=50_000)
            if prev_text:
                previous_text = f"\n\n--- PREVIOUS {filing['filing_type']} (filed {prev_filings[1]['filing_date']}) ---\n{prev_text}"

    user_prompt = f"""Analyze this {filing['filing_type']} filing for {ticker} ({filing['company_name']}), filed {filing['filing_date']}.

--- CURRENT FILING ---
{filing_text}
{previous_text}

Produce your analysis as JSON."""

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model=DEEP_MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = response.content[0].text
    except Exception as e:
        logger.error(f"Claude API call failed for {ticker} filing analysis: {e}")
        return None

    # Parse JSON from response (handle markdown code blocks)
    try:
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0]
        analysis = json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse filing analysis JSON for {ticker}: {e}")
        logger.debug(f"Raw response: {raw[:500]}")
        return None

    # Ensure required fields
    analysis.setdefault("ticker", ticker)
    analysis.setdefault("filing_type", filing["filing_type"])
    analysis.setdefault("filing_date", filing["filing_date"])

    # Store in database
    db.insert_analysis(
        ticker=ticker,
        agent_type="filing",
        analysis=analysis,
        signals=analysis.get("signals", []),
        overall_sentiment=analysis.get("overall_sentiment", 0.0),
        confidence=max(
            (s.get("confidence", 0) for s in analysis.get("signals", [])),
            default=0.0,
        ),
        recommendation=analysis.get("recommendation", "hold"),
        reasoning=analysis.get("reasoning", ""),
        source_url=filing["url"],
    )

    logger.info(
        f"Filing analysis for {ticker}: {analysis.get('recommendation')} "
        f"(sentiment={analysis.get('overall_sentiment')}, "
        f"signals={len(analysis.get('signals', []))})"
    )
    return analysis
