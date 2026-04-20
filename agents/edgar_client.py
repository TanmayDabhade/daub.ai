"""SEC EDGAR API client for fetching company filings."""

import asyncio
import logging
import re
import time
from typing import Optional

import httpx

from agents.config import EDGAR_USER_AGENT

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": EDGAR_USER_AGENT,
    "Accept": "application/json",
}

# Rate limit: 10 requests/second
_last_request_time = 0.0
_rate_lock = asyncio.Lock()
RATE_LIMIT_INTERVAL = 0.11  # ~9 req/sec to stay safe


async def _rate_limited_get(client: httpx.AsyncClient, url: str, **kwargs) -> httpx.Response:
    global _last_request_time
    async with _rate_lock:
        elapsed = time.monotonic() - _last_request_time
        if elapsed < RATE_LIMIT_INTERVAL:
            await asyncio.sleep(RATE_LIMIT_INTERVAL - elapsed)
        _last_request_time = time.monotonic()
    return await client.get(url, headers=HEADERS, **kwargs)


# Common ticker -> CIK mapping for our watchlist (avoids extra API call)
TICKER_CIK_MAP = {
    "AAPL": "0000320193",
    "MSFT": "0000789019",
    "NVDA": "0001045810",
    "GOOGL": "0001652044",
    "META": "0001326801",
    "AMZN": "0001018724",
    "TSLA": "0001318605",
    "JPM": "0000019617",
    "GS": "0000886982",
    "BAC": "0000070858",
    "V": "0001403161",
    "MA": "0001141391",
    "UNH": "0000731766",
    "JNJ": "0000200406",
    "PFE": "0000078003",
    "LLY": "0000059478",
    "CAT": "0000018230",
    "DE": "0000315189",
    "HON": "0000773840",
    "WMT": "0000104169",
    "COST": "0000909832",
    "MCD": "0000789019",  # placeholder
    "XOM": "0000034088",
    "CVX": "0000093410",
}


async def resolve_cik(ticker: str) -> Optional[str]:
    """Resolve a ticker symbol to a 10-digit CIK number."""
    if ticker.upper() in TICKER_CIK_MAP:
        return TICKER_CIK_MAP[ticker.upper()]

    url = f"https://efts.sec.gov/LATEST/search-index?q=%22{ticker}%22&dateRange=custom&forms=10-K"
    async with httpx.AsyncClient() as client:
        try:
            resp = await _rate_limited_get(client, url)
            resp.raise_for_status()
            data = resp.json()
            hits = data.get("hits", {}).get("hits", [])
            if hits:
                cik = hits[0].get("_source", {}).get("entity_id", "")
                if cik:
                    return cik.zfill(10)
        except Exception as e:
            logger.error(f"Failed to resolve CIK for {ticker}: {e}")
    return None


async def get_company_filings(cik: str) -> dict:
    """Fetch the filing index for a company from EDGAR submissions endpoint."""
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    async with httpx.AsyncClient() as client:
        try:
            resp = await _rate_limited_get(client, url)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"Failed to fetch filings for CIK {cik}: {e}")
            return {}


async def search_filings(
    ticker: str,
    filing_types: list[str] = None,
    start_date: str = "",
    end_date: str = "",
    limit: int = 5,
) -> list[dict]:
    """Search for filings using EDGAR full-text search API.

    Returns a list of filing metadata dicts with keys:
    - accession_number, filing_type, filing_date, company_name, url
    """
    if filing_types is None:
        filing_types = ["10-K", "10-Q", "8-K"]

    forms_param = ",".join(filing_types)
    query = f'"{ticker}"'

    url = "https://efts.sec.gov/LATEST/search-index"
    params = {
        "q": query,
        "forms": forms_param,
        "dateRange": "custom",
    }
    if start_date:
        params["startdt"] = start_date
    if end_date:
        params["enddt"] = end_date

    async with httpx.AsyncClient() as client:
        try:
            resp = await _rate_limited_get(client, url, params=params)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.error(f"EDGAR search failed for {ticker}: {e}")
            return []

    results = []
    hits = data.get("hits", {}).get("hits", [])
    for hit in hits[:limit]:
        source = hit.get("_source", {})
        accession = source.get("file_num", "")
        # Build a more useful structure
        results.append({
            "accession_number": source.get("accession_no", ""),
            "filing_type": source.get("form_type", ""),
            "filing_date": source.get("file_date", ""),
            "company_name": source.get("entity_name", ""),
            "url": source.get("file_url", ""),
        })
    return results


async def get_recent_filings(ticker: str, filing_types: list[str] = None, limit: int = 3) -> list[dict]:
    """Get recent filings for a ticker using the submissions endpoint.

    More reliable than search — uses the structured filing index.
    """
    if filing_types is None:
        filing_types = ["10-K", "10-Q", "8-K"]

    cik = await resolve_cik(ticker)
    if not cik:
        logger.warning(f"Could not resolve CIK for {ticker}")
        return []

    company_data = await get_company_filings(cik)
    if not company_data:
        return []

    recent = company_data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    dates = recent.get("filingDate", [])
    accessions = recent.get("accessionNumber", [])
    primary_docs = recent.get("primaryDocument", [])

    results = []
    for i, form in enumerate(forms):
        if form in filing_types:
            accession_clean = accessions[i].replace("-", "")
            results.append({
                "accession_number": accessions[i],
                "filing_type": form,
                "filing_date": dates[i],
                "company_name": company_data.get("name", ticker),
                "url": f"https://www.sec.gov/Archives/edgar/data/{cik.lstrip('0')}/{accession_clean}/{primary_docs[i]}",
            })
            if len(results) >= limit:
                break

    return results


async def get_filing_text(url: str, max_chars: int = 100_000) -> str:
    """Fetch the text content of a filing document.

    Strips HTML tags and truncates to max_chars for Claude's context.
    """
    async with httpx.AsyncClient(follow_redirects=True) as client:
        try:
            resp = await _rate_limited_get(client, url)
            resp.raise_for_status()
            text = resp.text
        except Exception as e:
            logger.error(f"Failed to fetch filing at {url}: {e}")
            return ""

    # Strip HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    # Truncate
    if len(text) > max_chars:
        text = text[:max_chars] + "\n\n[TRUNCATED — filing continues...]"
    return text
