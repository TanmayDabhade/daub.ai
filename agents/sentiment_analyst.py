"""Sentiment/News Analyst Agent — Analyzes news and social sentiment for trading signals."""

import json
import logging
import xml.etree.ElementTree as ET
from typing import Optional

import anthropic
import httpx

from agents.config import ANTHROPIC_API_KEY, FAST_MODEL
from agents import db

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert news/sentiment analyst at an AI-native hedge fund. Your job is to analyze recent news headlines and articles about a company and extract actionable trading signals.

For each ticker, analyze:
1. Material events — lawsuits, executive departures, M&A rumors, product launches, regulatory actions
2. Sentiment trend — is coverage improving, deteriorating, or stable?
3. Information asymmetry — is there news the market hasn't priced in yet?
4. Volume/frequency of coverage — sudden spikes in news volume often precede moves
5. Analyst commentary and upgrades/downgrades
6. Social media buzz if relevant

Be specific and cite headlines as evidence. Distinguish between noise and signal.

Respond with ONLY valid JSON matching this schema:
{
  "ticker": "string",
  "analysis_date": "string (YYYY-MM-DD)",
  "signals": [
    {
      "type": "string (one of: material_event, sentiment_shift, analyst_action, regulatory, insider_news, market_reaction, information_asymmetry)",
      "description": "string — what you found",
      "sentiment": "string (positive, negative, neutral)",
      "confidence": "float 0-1",
      "evidence": "string — headline or source"
    }
  ],
  "overall_sentiment": "float -1 to 1",
  "sentiment_trend": "string (improving, deteriorating, stable)",
  "recommendation": "string (buy, sell, hold, reduce_exposure, increase_exposure)",
  "reasoning": "string — analysis summary"
}"""


async def _fetch_google_news_rss(ticker: str, company_name: str = "") -> list[dict]:
    """Fetch recent news from Google News RSS feed."""
    query = f"{ticker} stock"
    if company_name:
        query = f"{company_name} {ticker}"

    url = f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, timeout=10)
            resp.raise_for_status()
        except Exception as e:
            logger.error(f"Failed to fetch Google News RSS for {ticker}: {e}")
            return []

    articles = []
    try:
        root = ET.fromstring(resp.text)
        for item in root.findall(".//item")[:15]:
            title = item.findtext("title", "")
            pub_date = item.findtext("pubDate", "")
            source = item.findtext("source", "")
            articles.append({
                "title": title,
                "date": pub_date,
                "source": source,
            })
    except ET.ParseError as e:
        logger.error(f"Failed to parse RSS for {ticker}: {e}")

    return articles


async def _fetch_yahoo_finance_rss(ticker: str) -> list[dict]:
    """Fetch recent news from Yahoo Finance RSS feed."""
    url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, timeout=10)
            resp.raise_for_status()
        except Exception as e:
            logger.error(f"Failed to fetch Yahoo Finance RSS for {ticker}: {e}")
            return []

    articles = []
    try:
        root = ET.fromstring(resp.text)
        for item in root.findall(".//item")[:10]:
            title = item.findtext("title", "")
            description = item.findtext("description", "")
            pub_date = item.findtext("pubDate", "")
            articles.append({
                "title": title,
                "description": description,
                "date": pub_date,
            })
    except ET.ParseError as e:
        logger.error(f"Failed to parse Yahoo RSS for {ticker}: {e}")

    return articles


async def analyze_sentiment(ticker: str, company_name: str = "") -> Optional[dict]:
    """Analyze news sentiment for a ticker.

    Args:
        ticker: Stock ticker symbol
        company_name: Full company name (optional, improves search)

    Returns:
        Structured analysis dict, or None if analysis fails
    """
    if not ANTHROPIC_API_KEY:
        logger.warning("Anthropic API key not configured — skipping sentiment analysis")
        return None

    # Fetch news from multiple sources in parallel
    google_news = await _fetch_google_news_rss(ticker, company_name)
    yahoo_news = await _fetch_yahoo_finance_rss(ticker)

    all_articles = google_news + yahoo_news
    if not all_articles:
        logger.warning(f"No news articles found for {ticker}")
        return None

    # Format articles for the prompt
    news_text = f"Recent news for {ticker}"
    if company_name:
        news_text += f" ({company_name})"
    news_text += ":\n\n"

    for i, article in enumerate(all_articles, 1):
        news_text += f"{i}. [{article.get('date', 'recent')}] {article['title']}"
        if article.get("description"):
            news_text += f"\n   {article['description']}"
        if article.get("source"):
            news_text += f" — {article['source']}"
        news_text += "\n"

    user_prompt = f"""Analyze the following recent news coverage for {ticker} and produce trading signals.

{news_text}

Produce your analysis as JSON."""

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model=FAST_MODEL,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = response.content[0].text
    except Exception as e:
        logger.error(f"Claude API call failed for {ticker} sentiment analysis: {e}")
        return None

    try:
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0]
        analysis = json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse sentiment analysis JSON for {ticker}: {e}")
        return None

    analysis.setdefault("ticker", ticker)

    # Store in database
    db.insert_analysis(
        ticker=ticker,
        agent_type="sentiment",
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
        f"Sentiment analysis for {ticker}: {analysis.get('recommendation')} "
        f"(trend={analysis.get('sentiment_trend')}, signals={len(analysis.get('signals', []))})"
    )
    return analysis
