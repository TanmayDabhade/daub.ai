"""Earnings Call Analyst Agent — Analyzes earnings call transcripts for trading signals."""

import json
import logging
from typing import Optional

import anthropic

from agents.config import ANTHROPIC_API_KEY, DEEP_MODEL
from agents import db

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert earnings call analyst at an AI-native hedge fund. Your job is to analyze earnings call transcripts and extract actionable trading signals.

For each earnings call, analyze:
1. Guidance changes — raised, lowered, maintained, or withdrawn
2. Language confidence scoring — count hedging words (may, could, uncertain, challenging) vs. definitive language (will, expect, confident, committed)
3. Analyst question sentiment — are analysts skeptical or bullish in their questions?
4. Management dodge detection — questions that received non-answers or deflections
5. Forward-looking statement extraction — promises and projections
6. Comparison to prior quarter's call tone — improving or deteriorating?
7. Key metrics discussed — revenue growth, margins, customer counts, churn

Be specific. Quote exact passages. Count hedging words and confidence words separately.

Respond with ONLY valid JSON matching this schema:
{
  "ticker": "string",
  "quarter": "string (e.g. Q1 2026)",
  "call_date": "string (YYYY-MM-DD)",
  "guidance_change": "string (raised, lowered, maintained, withdrawn, not_provided)",
  "management_confidence_score": "float 0-1 (1 = very confident language)",
  "analyst_sentiment": "float -1 to 1 (positive = bullish questions)",
  "dodge_count": "int — number of questions deflected or not answered",
  "key_themes": ["string array of major topics discussed"],
  "notable_quotes": [
    {
      "speaker": "string",
      "quote": "string",
      "significance": "string"
    }
  ],
  "signals": [
    {
      "type": "string (one of: guidance_change, confidence_shift, analyst_skepticism, management_dodge, forward_projection, metric_surprise)",
      "description": "string",
      "sentiment": "string (positive, negative, neutral)",
      "confidence": "float 0-1",
      "evidence": "string — exact quote"
    }
  ],
  "overall_sentiment": "float -1 to 1",
  "recommendation": "string (buy, sell, hold, reduce_exposure, increase_exposure)",
  "reasoning": "string — multi-paragraph analysis"
}"""


async def analyze_earnings(
    ticker: str,
    transcript: str,
    quarter: str = "",
    call_date: str = "",
) -> Optional[dict]:
    """Analyze an earnings call transcript.

    Args:
        ticker: Stock ticker symbol
        transcript: Full text of the earnings call transcript
        quarter: Quarter identifier (e.g., "Q1 2026")
        call_date: Date of the call (YYYY-MM-DD)

    Returns:
        Structured analysis dict, or None if analysis fails
    """
    if not ANTHROPIC_API_KEY:
        logger.warning("Anthropic API key not configured — skipping earnings analysis")
        return None

    if not transcript or len(transcript.strip()) < 100:
        logger.warning(f"Transcript too short or empty for {ticker}")
        return None

    # Truncate very long transcripts
    if len(transcript) > 120_000:
        transcript = transcript[:120_000] + "\n\n[TRANSCRIPT TRUNCATED]"

    user_prompt = f"""Analyze this earnings call transcript for {ticker}.
Quarter: {quarter or 'Unknown'}
Call Date: {call_date or 'Unknown'}

--- TRANSCRIPT ---
{transcript}

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
        logger.error(f"Claude API call failed for {ticker} earnings analysis: {e}")
        return None

    try:
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0]
        analysis = json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse earnings analysis JSON for {ticker}: {e}")
        return None

    analysis.setdefault("ticker", ticker)
    analysis.setdefault("quarter", quarter)
    analysis.setdefault("call_date", call_date)

    # Store in database
    db.insert_analysis(
        ticker=ticker,
        agent_type="earnings",
        analysis=analysis,
        signals=analysis.get("signals", []),
        overall_sentiment=analysis.get("overall_sentiment", 0.0),
        confidence=max(
            (s.get("confidence", 0) for s in analysis.get("signals", [])),
            default=0.0,
        ),
        recommendation=analysis.get("recommendation", "hold"),
        reasoning=analysis.get("reasoning", ""),
    )

    logger.info(
        f"Earnings analysis for {ticker} {quarter}: {analysis.get('recommendation')} "
        f"(guidance={analysis.get('guidance_change')}, "
        f"confidence={analysis.get('management_confidence_score')}, "
        f"dodges={analysis.get('dodge_count')})"
    )
    return analysis


async def fetch_transcript_stub(ticker: str, quarter: str = "") -> Optional[str]:
    """Stub transcript fetcher — replace with Financial Modeling Prep API later.

    For now, returns None. Wire this up to a real transcript source
    when you get an API key.
    """
    logger.info(f"Transcript fetcher stub called for {ticker} {quarter} — no API configured")
    return None
