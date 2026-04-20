"""Market data client — Polygon.io wrapper with graceful fallbacks."""

import logging
from datetime import datetime, timedelta
from typing import Optional

import httpx

from agents.config import POLYGON_API_KEY

logger = logging.getLogger(__name__)


async def get_price(ticker: str) -> Optional[float]:
    """Get the latest price for a ticker."""
    if not POLYGON_API_KEY:
        logger.warning(f"Polygon API key not configured — returning None for {ticker} price")
        return None

    url = f"https://api.polygon.io/v2/aggs/ticker/{ticker}/prev"
    params = {"apiKey": POLYGON_API_KEY}

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            if results:
                return results[0].get("c")  # closing price
        except Exception as e:
            logger.error(f"Failed to get price for {ticker}: {e}")
    return None


async def get_price_history(
    ticker: str,
    start: str = "",
    end: str = "",
    timespan: str = "day",
) -> list[dict]:
    """Get historical price bars.

    Args:
        ticker: Stock ticker
        start: Start date (YYYY-MM-DD), defaults to 30 days ago
        end: End date (YYYY-MM-DD), defaults to today
        timespan: "day", "hour", "minute"

    Returns:
        List of bar dicts with keys: date, open, high, low, close, volume
    """
    if not POLYGON_API_KEY:
        logger.warning("Polygon API key not configured — returning empty price history")
        return []

    if not end:
        end = datetime.now().strftime("%Y-%m-%d")
    if not start:
        start = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

    url = f"https://api.polygon.io/v2/aggs/ticker/{ticker}/range/1/{timespan}/{start}/{end}"
    params = {"apiKey": POLYGON_API_KEY, "adjusted": "true", "sort": "asc", "limit": 5000}

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.error(f"Failed to get price history for {ticker}: {e}")
            return []

    bars = []
    for result in data.get("results", []):
        bars.append({
            "date": datetime.fromtimestamp(result["t"] / 1000).strftime("%Y-%m-%d"),
            "open": result.get("o"),
            "high": result.get("h"),
            "low": result.get("l"),
            "close": result.get("c"),
            "volume": result.get("v"),
        })
    return bars


async def get_market_status() -> dict:
    """Check if the market is currently open."""
    if not POLYGON_API_KEY:
        return {"market": "unknown", "configured": False}

    url = "https://api.polygon.io/v1/marketstatus/now"
    params = {"apiKey": POLYGON_API_KEY}

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"Failed to get market status: {e}")
            return {"market": "unknown", "error": str(e)}


async def get_ticker_details(ticker: str) -> Optional[dict]:
    """Get company details for a ticker (name, sector, market cap, etc.)."""
    if not POLYGON_API_KEY:
        return None

    url = f"https://api.polygon.io/v3/reference/tickers/{ticker}"
    params = {"apiKey": POLYGON_API_KEY}

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", {})
            return {
                "ticker": results.get("ticker"),
                "name": results.get("name"),
                "sector": results.get("sic_description", ""),
                "market_cap": results.get("market_cap"),
                "primary_exchange": results.get("primary_exchange"),
            }
        except Exception as e:
            logger.error(f"Failed to get ticker details for {ticker}: {e}")
    return None
