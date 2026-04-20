"""Macro Analyst Agent — Analyzes macroeconomic data and regime changes."""

import json
import logging
import xml.etree.ElementTree as ET
from typing import Optional

import anthropic
import httpx

from agents.config import ANTHROPIC_API_KEY, FAST_MODEL
from agents import db

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert macroeconomic analyst at an AI-native hedge fund. Your job is to analyze macroeconomic data, Fed communications, and economic indicators to classify the current market regime and provide sector-level guidance.

Analyze:
1. Monetary policy — Fed rate decisions, minutes tone, dot plot shifts
2. Inflation — CPI/PPI trends, core vs. headline divergence
3. Employment — NFP, unemployment rate, wage growth, JOLTS
4. Growth — GDP, PMI (manufacturing and services), retail sales
5. Credit conditions — yield curve shape, credit spreads, bank lending standards
6. Global macro — trade policy, geopolitical risks, commodity prices
7. Market internals — breadth, volatility regime, risk appetite indicators

Classify the current regime and provide actionable sector tilts.

Respond with ONLY valid JSON matching this schema:
{
  "analysis_date": "string (YYYY-MM-DD)",
  "regime": {
    "classification": "string (risk_on, risk_off, transitioning, uncertain)",
    "confidence": "float 0-1",
    "description": "string — current regime summary"
  },
  "key_indicators": [
    {
      "indicator": "string (e.g. CPI, Fed Funds Rate, PMI)",
      "latest_value": "string",
      "trend": "string (rising, falling, stable)",
      "significance": "string — why this matters now"
    }
  ],
  "sector_tilts": [
    {
      "sector": "string",
      "tilt": "string (overweight, underweight, neutral)",
      "reasoning": "string"
    }
  ],
  "risks": [
    {
      "risk": "string",
      "probability": "float 0-1",
      "impact": "string (high, medium, low)",
      "description": "string"
    }
  ],
  "signals": [
    {
      "type": "string (regime_change, rate_expectation, recession_indicator, sector_rotation, geopolitical)",
      "description": "string",
      "sentiment": "string (positive, negative, neutral)",
      "confidence": "float 0-1",
      "evidence": "string"
    }
  ],
  "overall_sentiment": "float -1 to 1 (market-wide)",
  "reasoning": "string — full macro analysis"
}"""


async def _fetch_fred_data() -> list[dict]:
    """Fetch key economic indicators from FRED RSS feed (no API key needed)."""
    feeds = [
        ("https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS", "Fed Funds Rate"),
        ("https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL", "CPI"),
        ("https://fred.stlouisfed.org/graph/fredgraph.csv?id=UNRATE", "Unemployment Rate"),
    ]

    # Use FRED RSS for news/releases instead (no auth needed)
    url = "https://fred.stlouisfed.org/feed/fred-news-rss.xml"
    articles = []

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, timeout=10)
            resp.raise_for_status()
            root = ET.fromstring(resp.text)
            for item in root.findall(".//item")[:10]:
                articles.append({
                    "title": item.findtext("title", ""),
                    "description": item.findtext("description", ""),
                    "date": item.findtext("pubDate", ""),
                })
        except Exception as e:
            logger.warning(f"Failed to fetch FRED RSS: {e}")

    return articles


async def _fetch_macro_news() -> list[dict]:
    """Fetch macro-related news from Google News RSS."""
    queries = [
        "Federal Reserve interest rate decision",
        "US economy GDP inflation jobs",
    ]

    all_articles = []
    async with httpx.AsyncClient() as client:
        for query in queries:
            url = f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
            try:
                resp = await client.get(url, timeout=10)
                resp.raise_for_status()
                root = ET.fromstring(resp.text)
                for item in root.findall(".//item")[:5]:
                    all_articles.append({
                        "title": item.findtext("title", ""),
                        "date": item.findtext("pubDate", ""),
                        "source": item.findtext("source", ""),
                    })
            except Exception as e:
                logger.warning(f"Failed to fetch macro news for '{query}': {e}")

    return all_articles


async def analyze_macro() -> Optional[dict]:
    """Analyze current macroeconomic environment.

    Returns:
        Structured analysis dict with regime classification and sector tilts,
        or None if analysis fails.
    """
    if not ANTHROPIC_API_KEY:
        logger.warning("Anthropic API key not configured — skipping macro analysis")
        return None

    fred_data = await _fetch_fred_data()
    macro_news = await _fetch_macro_news()

    if not fred_data and not macro_news:
        logger.warning("No macro data available")
        return None

    # Format data for the prompt
    data_text = "FRED Economic Data & Releases:\n"
    for item in fred_data:
        data_text += f"- [{item.get('date', 'recent')}] {item['title']}"
        if item.get("description"):
            data_text += f": {item['description'][:200]}"
        data_text += "\n"

    data_text += "\nRecent Macro News:\n"
    for item in macro_news:
        data_text += f"- [{item.get('date', 'recent')}] {item['title']}"
        if item.get("source"):
            data_text += f" — {item['source']}"
        data_text += "\n"

    user_prompt = f"""Analyze the current macroeconomic environment based on the following data and news.

{data_text}

Classify the market regime and provide sector tilts. Produce your analysis as JSON."""

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model=FAST_MODEL,
            max_tokens=8192,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = response.content[0].text
    except Exception as e:
        logger.error(f"Claude API call failed for macro analysis: {e}")
        return None

    try:
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0]
        analysis = json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse macro analysis JSON: {e}")
        return None

    # Store in database (use "MACRO" as ticker for macro analysis)
    db.insert_analysis(
        ticker="MACRO",
        agent_type="macro",
        analysis=analysis,
        signals=analysis.get("signals", []),
        overall_sentiment=analysis.get("overall_sentiment", 0.0),
        confidence=analysis.get("regime", {}).get("confidence", 0.5),
        recommendation=analysis.get("regime", {}).get("classification", "uncertain"),
        reasoning=analysis.get("reasoning", ""),
    )

    regime = analysis.get("regime", {})
    logger.info(
        f"Macro analysis: regime={regime.get('classification')} "
        f"(confidence={regime.get('confidence')}, "
        f"tilts={len(analysis.get('sector_tilts', []))})"
    )
    return analysis
