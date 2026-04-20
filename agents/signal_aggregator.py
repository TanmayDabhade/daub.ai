"""Signal Aggregator — Cross-references all agent analyses and ranks trade candidates."""

import json
import logging
from typing import Optional

import anthropic

from agents.config import ANTHROPIC_API_KEY, DEEP_MODEL, MIN_CONFIDENCE
from agents import db

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the signal aggregation engine at an AI-native hedge fund. You receive analyses from multiple specialist agents (filing analyst, earnings analyst, sentiment analyst, macro analyst) AND current portfolio state. You must synthesize everything into actionable trade recommendations.

Your job:
1. Cross-reference signals from all agents — look for convergence and divergence
2. Weight signals by confidence — higher confidence signals matter more
3. Detect conflicts — e.g., bullish filing analysis + bearish sentiment. Flag these explicitly
4. Produce a composite score from -1 (strong short) to +1 (strong long)
5. Determine trade direction: "long", "short", or "no_trade"
6. Only recommend trades with composite confidence >= 0.7
7. Apply macro context — if macro regime is risk-off, be more cautious on longs
8. PORTFOLIO-AWARE SIZING: Consider the current portfolio when making recommendations:
   - If already holding this ticker, recommend whether to ADD, TRIM, HOLD, or EXIT the position
   - Factor in current sector exposure — avoid concentrating too much in one sector
   - Consider available cash when sizing new positions
   - Flag if the portfolio is overexposed to correlated positions
   - Recommend specific position sizes as % of portfolio (max 5% per position, max 25% per sector)

Be rigorous. A signal supported by multiple agents with high confidence is worth more than a single high-confidence signal. Conflicting signals should reduce overall confidence.

Respond with ONLY valid JSON matching this schema:
{
  "ticker": "string",
  "timestamp": "string (ISO 8601)",
  "direction": "string (long, short, no_trade)",
  "composite_score": "float -1 to 1",
  "confidence": "float 0 to 1",
  "position_action": "string (open, add, trim, hold, exit, no_trade)",
  "recommended_position_pct": "float 0 to 0.05 — recommended position size as fraction of portfolio",
  "position_rationale": "string — why this size, considering current holdings and sector exposure",
  "contributing_signals": [
    {
      "agent_type": "string",
      "signal_type": "string",
      "sentiment": "string",
      "confidence": "float",
      "summary": "string"
    }
  ],
  "conflicts": [
    {
      "description": "string — what conflicts",
      "agents_involved": ["string"],
      "resolution": "string — how you resolved it"
    }
  ],
  "macro_context": "string — how macro regime affects this trade",
  "reasoning": "string — detailed synthesis explaining the composite score and position recommendation"
}"""


async def aggregate_signals(
    ticker: str,
    analyses: list[dict],
    macro_analysis: Optional[dict] = None,
    portfolio: Optional[dict] = None,
) -> Optional[dict]:
    """Aggregate signals from multiple agents for a single ticker.

    Args:
        ticker: Stock ticker symbol
        analyses: List of analysis dicts from different agents
        macro_analysis: Optional macro regime analysis to incorporate
        portfolio: Optional dict with account info, positions, and sector exposure

    Returns:
        Aggregated signal dict with composite score, or None on failure
    """
    if not ANTHROPIC_API_KEY:
        logger.warning("Anthropic API key not configured — skipping signal aggregation")
        return None

    if not analyses:
        logger.warning(f"No analyses to aggregate for {ticker}")
        return None

    # Format all analyses for the prompt
    analyses_text = f"Analyses for {ticker}:\n\n"
    for i, analysis in enumerate(analyses, 1):
        agent_type = analysis.get("agent_type", "unknown")
        analyses_text += f"--- Agent {i}: {agent_type.upper()} ANALYST ---\n"
        analyses_text += json.dumps(analysis, indent=2, default=str)
        analyses_text += "\n\n"

    if macro_analysis:
        analyses_text += "--- MACRO CONTEXT ---\n"
        analyses_text += json.dumps(macro_analysis, indent=2, default=str)
        analyses_text += "\n\n"

    # Format portfolio context
    portfolio_text = ""
    if portfolio:
        portfolio_text = "\n--- CURRENT PORTFOLIO STATE ---\n"
        account = portfolio.get("account", {})
        portfolio_text += f"Total Portfolio Value: ${account.get('equity', 100000):,.2f}\n"
        portfolio_text += f"Cash Available: ${account.get('cash', 100000):,.2f}\n"
        portfolio_text += f"Buying Power: ${account.get('buying_power', 200000):,.2f}\n"

        positions = portfolio.get("positions", [])
        if positions:
            portfolio_text += f"\nOpen Positions ({len(positions)}):\n"
            for pos in positions:
                pnl_pct = pos.get('unrealized_pnl_pct', 0)
                portfolio_text += (
                    f"  {pos.get('ticker'):6s} | {pos.get('side', 'long'):5s} | "
                    f"{pos.get('qty', 0)} shares @ ${pos.get('avg_entry_price', 0):,.2f} | "
                    f"current ${pos.get('current_price', 0):,.2f} | "
                    f"P&L {pnl_pct:+.1%} (${pos.get('unrealized_pnl', 0):+,.2f}) | "
                    f"value ${pos.get('market_value', 0):,.2f}\n"
                )
        else:
            portfolio_text += "\nNo open positions.\n"

        sector_exposure = portfolio.get("sector_exposure", {})
        if sector_exposure:
            total_value = account.get("equity", 100000)
            portfolio_text += "\nSector Exposure:\n"
            for sector, value in sorted(sector_exposure.items(), key=lambda x: x[1], reverse=True):
                pct = value / total_value if total_value > 0 else 0
                portfolio_text += f"  {sector}: ${value:,.2f} ({pct:.1%})\n"

        # Flag if already holding this ticker
        held = [p for p in positions if p.get("ticker") == ticker]
        if held:
            pos = held[0]
            portfolio_text += (
                f"\n⚠ ALREADY HOLDING {ticker}: {pos.get('qty')} shares, "
                f"P&L {pos.get('unrealized_pnl_pct', 0):+.1%}\n"
            )

        portfolio_text += "\n"

    user_prompt = f"""Synthesize the following agent analyses for {ticker} into a single trade recommendation. Consider the current portfolio state when sizing your recommendation.

{analyses_text}
{portfolio_text}
Produce your aggregated signal as JSON."""

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model=DEEP_MODEL,
            max_tokens=3000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = response.content[0].text
    except Exception as e:
        logger.error(f"Claude API call failed for {ticker} signal aggregation: {e}")
        return None

    try:
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0]
        result = json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse signal aggregation JSON for {ticker}: {e}")
        return None

    result.setdefault("ticker", ticker)

    # Store in database if confidence meets threshold
    confidence = result.get("confidence", 0)
    direction = result.get("direction", "no_trade")

    if confidence >= MIN_CONFIDENCE and direction != "no_trade":
        # Collect contributing analysis IDs if available
        analysis_ids = [a.get("id", "") for a in analyses if a.get("id")]

        db.insert_signal(
            ticker=ticker,
            direction=direction,
            composite_score=result.get("composite_score", 0),
            confidence=confidence,
            contributing_analyses=analysis_ids,
            conflicts=result.get("conflicts", []),
            reasoning=result.get("reasoning", ""),
        )
        logger.info(
            f"Trade signal for {ticker}: {direction} "
            f"(score={result.get('composite_score')}, confidence={confidence})"
        )
    else:
        logger.info(
            f"No trade signal for {ticker}: confidence={confidence} "
            f"(min={MIN_CONFIDENCE}), direction={direction}"
        )

    return result


async def aggregate_all(
    ticker_analyses: dict[str, list[dict]],
    macro_analysis: Optional[dict] = None,
) -> list[dict]:
    """Aggregate signals for multiple tickers.

    Args:
        ticker_analyses: Dict mapping ticker -> list of analyses
        macro_analysis: Optional macro regime analysis

    Returns:
        List of aggregated signals sorted by absolute composite score
    """
    results = []
    for ticker, analyses in ticker_analyses.items():
        result = await aggregate_signals(ticker, analyses, macro_analysis)
        if result:
            results.append(result)

    # Sort by absolute composite score (strongest signals first)
    results.sort(key=lambda x: abs(x.get("composite_score", 0)), reverse=True)
    return results
