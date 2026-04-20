"""Configuration and constants for Swarm Capital agents."""

import os
from dotenv import load_dotenv

load_dotenv()

# --- API Keys ---
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ALPACA_API_KEY = os.getenv("ALPACA_API_KEY", "")
ALPACA_SECRET_KEY = os.getenv("ALPACA_SECRET_KEY", "")
ALPACA_BASE_URL = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")
POLYGON_API_KEY = os.getenv("POLYGON_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
EDGAR_USER_AGENT = os.getenv("EDGAR_USER_AGENT", "SwarmCapital admin@swarmcapital.ai")

# --- Claude Models ---
FAST_MODEL = "claude-sonnet-4-6"
DEEP_MODEL = "claude-opus-4-6"

# --- Risk Parameters ---
MAX_POSITION_PCT = 0.05        # 5% of portfolio per position
MAX_SECTOR_EXPOSURE_PCT = 0.25 # 25% max in any single sector
MAX_CORRELATION = 0.6          # Max correlation between positions
STOP_LOSS_PCT = -0.03          # -3% stop loss per position
MAX_DRAWDOWN_PCT = -0.10       # -10% max portfolio drawdown (go to cash)
MIN_CONFIDENCE = 0.7           # Minimum confidence to trade

# --- Initial Watchlist ---
WATCHLIST = [
    # Tech
    {"ticker": "AAPL", "company_name": "Apple Inc.", "sector": "Technology"},
    {"ticker": "MSFT", "company_name": "Microsoft Corporation", "sector": "Technology"},
    {"ticker": "NVDA", "company_name": "NVIDIA Corporation", "sector": "Technology"},
    {"ticker": "GOOGL", "company_name": "Alphabet Inc.", "sector": "Technology"},
    {"ticker": "META", "company_name": "Meta Platforms Inc.", "sector": "Technology"},
    {"ticker": "AMZN", "company_name": "Amazon.com Inc.", "sector": "Technology"},
    {"ticker": "TSLA", "company_name": "Tesla Inc.", "sector": "Technology"},
    # Finance
    {"ticker": "JPM", "company_name": "JPMorgan Chase & Co.", "sector": "Finance"},
    {"ticker": "GS", "company_name": "Goldman Sachs Group Inc.", "sector": "Finance"},
    {"ticker": "BAC", "company_name": "Bank of America Corp.", "sector": "Finance"},
    {"ticker": "V", "company_name": "Visa Inc.", "sector": "Finance"},
    {"ticker": "MA", "company_name": "Mastercard Inc.", "sector": "Finance"},
    # Healthcare
    {"ticker": "UNH", "company_name": "UnitedHealth Group Inc.", "sector": "Healthcare"},
    {"ticker": "JNJ", "company_name": "Johnson & Johnson", "sector": "Healthcare"},
    {"ticker": "PFE", "company_name": "Pfizer Inc.", "sector": "Healthcare"},
    {"ticker": "LLY", "company_name": "Eli Lilly and Company", "sector": "Healthcare"},
    # Industrial
    {"ticker": "CAT", "company_name": "Caterpillar Inc.", "sector": "Industrial"},
    {"ticker": "DE", "company_name": "Deere & Company", "sector": "Industrial"},
    {"ticker": "HON", "company_name": "Honeywell International", "sector": "Industrial"},
    # Consumer
    {"ticker": "WMT", "company_name": "Walmart Inc.", "sector": "Consumer"},
    {"ticker": "COST", "company_name": "Costco Wholesale Corp.", "sector": "Consumer"},
    {"ticker": "MCD", "company_name": "McDonald's Corporation", "sector": "Consumer"},
    # Energy
    {"ticker": "XOM", "company_name": "Exxon Mobil Corporation", "sector": "Energy"},
    {"ticker": "CVX", "company_name": "Chevron Corporation", "sector": "Energy"},
    # Defense
    {"ticker": "LMT", "company_name": "Lockheed Martin Corporation", "sector": "Defense"},
    {"ticker": "RTX", "company_name": "RTX Corporation", "sector": "Defense"},
    {"ticker": "NOC", "company_name": "Northrop Grumman Corporation", "sector": "Defense"},
]

TICKER_TO_SECTOR = {item["ticker"]: item["sector"] for item in WATCHLIST}
