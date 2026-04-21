# API Keys & Environment Setup

All environment variables go in `dashboard/.env.local` (never commit this file).

## Required

### Alpaca Markets (Paper Trading + Market Data)
Sign up at https://alpaca.markets — free paper account, no credit card needed.

| Variable | Description | Example |
|---|---|---|
| `ALPACA_API_KEY` | Your Alpaca API key ID | `PKXXXXXXXXXXXXXXXXXXXXXXXX` |
| `ALPACA_SECRET_KEY` | Your Alpaca secret key | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |

**Where to find:** Dashboard → API Keys (top right) → Generate New Key

Optional overrides (defaults work fine for paper trading):

| Variable | Default | Notes |
|---|---|---|
| `ALPACA_FEED` | `iex` | `iex` = free real-time; `sip` = paid consolidated |
| `ALPACA_DATA_URL` | `https://data.alpaca.markets` | Don't change |
| `ALPACA_TRADING_URL` | `https://paper-api.alpaca.markets` | Use `https://api.alpaca.markets` for live |

**What it powers:** Live quotes, OHLCV bars, news, order blotter, paper order entry, backtest data

---

## Optional (Fallbacks / Extra Data)

### Polygon.io (News Fallback)
Already in the codebase as a news fallback. Free tier: 5 API calls/min, delayed data.
Sign up at https://polygon.io

| Variable | Description |
|---|---|
| `POLYGON_API_KEY` | Your Polygon API key |

**What it powers:** News fallback when Alpaca news is unavailable

---

### Financial Modeling Prep — FMP (Screener Fundamentals Enhancement)
Free tier: 250 requests/day. Useful for deeper fundamentals (forward P/E, EPS estimates).
Sign up at https://financialmodelingprep.com

| Variable | Description |
|---|---|
| `FMP_API_KEY` | Your FMP API key |

**What it powers:** Richer screener fundamentals (currently using Yahoo Finance free tier)

---

## No Key Required (Free, Auto-configured)

| Service | Used For | Notes |
|---|---|---|
| Yahoo Finance | Bulk quotes, OHLCV, fundamentals, screener | Unofficial API, no key needed |
| Alpaca IEX feed | Real-time quotes + bars | Included free with any Alpaca paper account |

---

## Setup Steps

1. Copy `.env.example` to `dashboard/.env.local`
2. Fill in `ALPACA_API_KEY` and `ALPACA_SECRET_KEY` from your Alpaca dashboard
3. Optionally add `POLYGON_API_KEY` for news redundancy
4. Run `npm run dev` inside the `dashboard/` directory
5. Visit http://localhost:3000

The platform will run in **demo/fallback mode** for any service without a key — you'll see static placeholder data instead of live data.

---

## Feature Matrix

| Feature | No Keys | Alpaca Only | + Polygon | + FMP |
|---|---|---|---|---|
| PulseStrip (indices) | Demo | Live (Yahoo) | Live | Live |
| Portfolio quotes | Demo | Live | Live | Live |
| Equity curve chart | Demo | Live | Live | Live |
| News headlines | Demo | Live | Live + fallback | Live |
| Screener fundamentals | Demo | Yahoo Finance | Yahoo Finance | Richer |
| Paper order entry | Disabled | Enabled | Enabled | Enabled |
| Backtest simulator | Disabled | Enabled | Enabled | Enabled |
| Order blotter | Demo | Live | Live | Live |
