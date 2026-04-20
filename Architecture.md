# Swarm Capital — System Architecture

## Overview

Swarm Capital is an AI-native hedge fund where specialized Claude agents analyze financial data sources in parallel, synthesize trading signals, and execute paper trades through Alpaca Markets. The system has two main subsystems: a **Python agent swarm** (analysis + execution) and a **Next.js dashboard** (real-time visualization), connected through a **Supabase Postgres database** as the shared data layer.

```
                                 ┌───────────────────┐
                                 │    NEXT.JS         │
                                 │    DASHBOARD       │
                                 │   (port 3000)      │
                                 └────────┬──────────┘
                                          │ reads via
                                          │ API routes + Realtime
                                          │
                         ┌────────────────▼────────────────┐
                         │        SUPABASE (POSTGRES)       │
                         │                                  │
                         │  watchlist · agent_analyses ·    │
                         │  trade_signals · trades ·        │
                         │  portfolio_snapshots ·           │
                         │  agent_performance               │
                         │                                  │
                         │  Realtime enabled on key tables  │
                         └────────────────▲────────────────┘
                                          │ writes
                                          │
┌─────────────────────────────────────────┴──────────────────────────────────┐
│                         PYTHON AGENT SWARM                                │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                      ORCHESTRATOR                                   │  │
│  │  orchestrator.py — main loop, batching, sequencing                  │  │
│  └───┬────────────┬────────────┬────────────┬────────────┬────────────┘  │
│      │            │            │            │            │                │
│  ┌───▼────┐  ┌────▼───┐  ┌────▼─────┐  ┌──▼──────┐  ┌──▼───────────┐  │
│  │FILING  │  │EARNINGS│  │SENTIMENT │  │ MACRO   │  │   SIGNAL     │  │
│  │ANALYST │  │ANALYST │  │ANALYST   │  │ ANALYST │  │  AGGREGATOR  │  │
│  └───┬────┘  └────┬───┘  └────┬─────┘  └──┬──────┘  └──┬───────────┘  │
│      │            │            │            │            │                │
│      │            │            │            │         ┌──▼───────────┐  │
│      │            │            │            │         │ RISK ENGINE  │  │
│      │            │            │            │         └──┬───────────┘  │
│      │            │            │            │            │                │
│      │            │            │            │         ┌──▼───────────┐  │
│      │            │            │            │         │  EXECUTOR    │  │
│      │            │            │            │         │  (Alpaca)    │  │
│      │            │            │            │         └──────────────┘  │
│  ┌───▼────┐  ┌────▼───┐  ┌────▼─────┐  ┌──▼──────┐                    │
│  │ EDGAR  │  │Stub    │  │Google    │  │ FRED    │  ┌──────────────┐  │
│  │ Client │  │(future │  │News RSS  │  │ RSS     │  │ Polygon.io   │  │
│  │(SEC)   │  │ FMP)   │  │Yahoo RSS │  │ Google  │  │ Market Data  │  │
│  └────────┘  └────────┘  └──────────┘  │ News    │  └──────────────┘  │
│                                         └─────────┘                    │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

Each analysis cycle follows this exact sequence:

```
1. Orchestrator starts
   │
2. Macro analyst runs (once per cycle)
   │  → fetches FRED RSS + Google News for Fed/economy
   │  → Claude (Sonnet) classifies regime: risk_on | risk_off | transitioning | uncertain
   │  → writes to agent_analyses (ticker="MACRO")
   │
3. Per-ticker analysis (batches of 5, parallelized within each batch):
   ├─ Filing analyst
   │    → edgar_client fetches recent 10-K/10-Q/8-K from SEC EDGAR
   │    → also fetches previous filing of same type for diff analysis
   │    → Claude (Opus) analyzes, returns structured JSON
   │    → writes to agent_analyses
   │
   ├─ Sentiment analyst
   │    → fetches Google News RSS + Yahoo Finance RSS
   │    → Claude (Sonnet) scores sentiment, detects material events
   │    → writes to agent_analyses
   │
   └─ Earnings analyst (only if transcript available — currently stubbed)
        → Claude (Opus) analyzes transcript
        → writes to agent_analyses
   │
4. Signal aggregator runs per ticker
   │  → receives all agent outputs + macro context + current portfolio state
   │  → Claude (Opus) cross-references, scores conflicts, produces composite signal
   │  → writes to trade_signals if confidence >= 0.7
   │
5. Portfolio state check
   │  → fetches account + positions from Alpaca (or mock)
   │  → calculates sector exposure from current holdings
   │
6. Risk engine evaluates each signal
   │  → checks: min confidence, sector limits, drawdown, cash, existing positions
   │  → calculates position size (fixed fractional, scaled by confidence)
   │
7. Executor places orders via Alpaca (skipped in dry-run mode)
   │  → market orders through paper trading API
   │  → writes to trades table
   │
8. Portfolio snapshot saved
   → writes to portfolio_snapshots
```

In **dry-run mode** (default), steps 2-4 and 8 still write to Supabase. Only step 7 (order execution) is skipped. This means the dashboard populates with agent analyses and signals even without live trading.

---

## Agent Architecture

Each analyst agent follows the same pattern:

1. **Fetch data** from an external source (SEC EDGAR, RSS feeds, FRED, etc.)
2. **Build a prompt** with a strict system prompt defining the JSON output schema
3. **Call Claude API** (synchronous `anthropic.Anthropic` client)
4. **Parse JSON** from Claude's response (handles markdown code blocks)
5. **Write to Supabase** via `db.insert_analysis()`
6. **Return structured dict** to the orchestrator

### Model Selection

| Agent | Model | Rationale |
|-------|-------|-----------|
| Filing analyst | `claude-opus-4-6` | Deep reasoning needed for SEC filing analysis, diff comparison |
| Earnings analyst | `claude-opus-4-6` | Nuanced transcript analysis, dodge detection, tone scoring |
| Sentiment analyst | `claude-sonnet-4-6` | Faster — news headlines need less deep reasoning |
| Macro analyst | `claude-sonnet-4-6` | Regime classification from news summaries |
| Signal aggregator | `claude-opus-4-6` | Synthesis across multiple agents, portfolio-aware sizing |

### Agent Output Schemas

All agents output structured JSON with these common fields:
- `ticker` — stock symbol
- `signals[]` — array of individual findings with `type`, `description`, `sentiment`, `confidence`, `evidence`
- `overall_sentiment` — float from -1 (bearish) to +1 (bullish)
- `recommendation` — one of: `buy`, `sell`, `hold`, `reduce_exposure`, `increase_exposure`
- `reasoning` — multi-paragraph natural language analysis

The signal aggregator adds:
- `composite_score` — weighted synthesis from -1 (strong short) to +1 (strong long)
- `direction` — `long`, `short`, or `no_trade`
- `confidence` — overall confidence in the recommendation
- `position_action` — `open`, `add`, `trim`, `hold`, `exit`, `no_trade`
- `recommended_position_pct` — 0 to 0.05 (max 5% of portfolio)
- `conflicts[]` — detected disagreements between agents with resolutions
- `macro_context` — how macro regime affects this trade

---

## External Data Sources

| Source | Agent | Method | Auth | Rate Limit |
|--------|-------|--------|------|------------|
| SEC EDGAR | Filing analyst | `httpx` async, submissions API + full-text search | User-Agent header only | 10 req/sec (throttled to ~9) |
| Google News RSS | Sentiment + Macro | XML RSS feed parsing | None | No formal limit |
| Yahoo Finance RSS | Sentiment | XML RSS feed parsing | None | No formal limit |
| FRED (St. Louis Fed) | Macro | RSS feed for economic releases | None | No formal limit |
| Polygon.io | Risk/Execution | REST API for prices + history | API key | 5 calls/min (free tier) |
| Alpaca Markets | Executor | REST API for paper trading | API key + secret | Standard |

### EDGAR Client Details

- CIK resolution uses a hardcoded `TICKER_CIK_MAP` for the 24 watchlist tickers, falling back to EDGAR search for unknown tickers
- Rate limiting is enforced globally via an `asyncio.Lock` with 110ms between requests
- Filing text is HTML-stripped and truncated to 100K characters for Claude's context window
- Previous filings of the same type are fetched for diff analysis (max 50K chars for the previous filing)

---

## Risk Management

The risk engine (`risk_engine.py`) enforces these rules before any trade:

| Rule | Parameter | Value |
|------|-----------|-------|
| Max position size | `MAX_POSITION_PCT` | 5% of portfolio |
| Max sector exposure | `MAX_SECTOR_EXPOSURE_PCT` | 25% of portfolio |
| Max correlation | `MAX_CORRELATION` | 0.6 (not yet enforced) |
| Stop loss per position | `STOP_LOSS_PCT` | -3% |
| Max portfolio drawdown | `MAX_DRAWDOWN_PCT` | -10% (triggers close-all) |
| Min confidence to trade | `MIN_CONFIDENCE` | 0.7 |

### Position Sizing

Uses fixed fractional sizing scaled by signal confidence:
- At minimum confidence (0.7): 50% of max position value
- At maximum confidence (1.0): 100% of max position value
- Linear interpolation between those bounds
- Max position value is further capped by sector exposure limits

### Circuit Breakers

1. **Stop loss**: Per-position check on every cycle. If a position is down 3%+, it is closed automatically.
2. **Max drawdown**: Portfolio-level check. If total drawdown from peak exceeds 10%, **all positions are closed** and the system goes to cash.

---

## Database Schema

Six tables in Supabase Postgres, with Realtime enabled on four of them:

```
watchlist                   agent_analyses              trade_signals
├─ id (UUID, PK)           ├─ id (UUID, PK)            ├─ id (UUID, PK)
├─ ticker (TEXT, UNIQUE)   ├─ ticker (TEXT)             ├─ ticker (TEXT)
├─ company_name            ├─ agent_type (TEXT)         ├─ direction (TEXT)
├─ sector                  ├─ analysis (JSONB)          ├─ composite_score (FLOAT)
├─ added_at                ├─ signals (JSONB)           ├─ confidence (FLOAT)
└─ active (BOOL)           ├─ overall_sentiment (FLOAT) ├─ contributing_analyses (UUID[])
                           ├─ confidence (FLOAT)        ├─ conflicts (JSONB)
                           ├─ recommendation (TEXT)     ├─ reasoning (TEXT)
                           ├─ reasoning (TEXT)          ├─ status (TEXT)
                           ├─ source_url (TEXT)         └─ created_at
                           └─ analyzed_at

trades                      portfolio_snapshots          agent_performance
├─ id (UUID, PK)           ├─ id (UUID, PK)            ├─ id (UUID, PK)
├─ signal_id (UUID, FK)    ├─ total_value (FLOAT)      ├─ agent_type (TEXT)
├─ ticker (TEXT)            ├─ cash (FLOAT)             ├─ ticker (TEXT)
├─ direction (TEXT)         ├─ positions (JSONB)        ├─ signal_direction (TEXT)
├─ quantity (INT)           ├─ sharpe_ratio (FLOAT)     ├─ signal_confidence (FLOAT)
├─ entry_price (FLOAT)     ├─ max_drawdown (FLOAT)     ├─ actual_return_1d (FLOAT)
├─ exit_price (FLOAT)      ├─ win_rate (FLOAT)         ├─ actual_return_5d (FLOAT)
├─ pnl (FLOAT)             └─ snapshot_at              ├─ actual_return_20d (FLOAT)
├─ alpaca_order_id (TEXT)                               ├─ was_correct (BOOL)
├─ status (TEXT)                                        └─ evaluated_at
├─ opened_at
└─ closed_at
```

**Realtime-enabled tables:** `agent_analyses`, `trade_signals`, `trades`, `portfolio_snapshots`

**Indexes:** On `(ticker, analyzed_at)`, `agent_type`, `status`, `ticker`, `snapshot_at`, and `(agent_type, evaluated_at)`.

---

## Dashboard Architecture

### Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.3 |
| UI | React + Tailwind CSS 4 | React 19.2 |
| Charts | Recharts | 3.8.1 |
| Database client | @supabase/supabase-js | 2.x |
| Fonts | Geist Sans + Geist Mono | — |

### Pages

| Route | Page | Data Source |
|-------|------|-------------|
| `/` | Portfolio Overview | `portfolio_snapshots`, `trades` (open) |
| `/agents` | Agent Activity Feed | `agent_analyses` (recent 50) |
| `/signals` | Trade Candidates | `trade_signals` + `agent_analyses` (unified view) |
| `/trades` | Trade History | `trades` (all, ordered by opened_at) |

### API Routes

The dashboard uses Next.js API routes as a backend-for-frontend layer:

| Route | Method | Queries |
|-------|--------|---------|
| `/api/portfolio` | GET | Latest `portfolio_snapshots` + open `trades` |
| `/api/analyses` | GET | Recent `agent_analyses` (limit 50) |
| `/api/signals` | GET | `trade_signals` + `agent_analyses` for unified signal view |
| `/api/trades` | GET | All `trades` ordered by date |
| `/api/market` | GET | Market data (Polygon.io) |

API routes use a **server-side Supabase client** (`SUPABASE_URL` + `SUPABASE_KEY` from env). The client-side lib (`src/lib/supabase.ts`) uses `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Realtime subscriptions.

### Components

| Component | Purpose |
|-----------|---------|
| `PortfolioChart` | Line chart of portfolio value over time |
| `PositionTable` | Open positions with P&L |
| `StatsBar` | Sharpe ratio, max drawdown, win rate |
| `AgentFeed` | Scrolling feed of agent analyses |
| `SignalCard` | Trade candidate card with scores and reasoning |
| `TradeRow` | Individual trade entry in history table |
| `SectorDonut` | Donut chart of sector allocation |
| `MacroTile` | Macro regime classification display |
| `FearGreedGauge` | Market fear/greed indicator |
| `CorrelationMatrix` | Position correlation heatmap |
| `BetaVolTable` | Beta and volatility metrics |
| `EarningsCalendar` | Upcoming earnings dates |
| `Sparkline` | Inline mini price chart |
| `NewsTile` | Recent news headlines |
| `ThesisPanel` | Expanded thesis/reasoning view |
| `Tile` | Reusable card container |
| `NavLink` | Navigation bar link with active state |
| `ThemeToggle` | Dark/light theme switcher |

### Theming

- Dark theme by default (trading terminal aesthetic)
- Light/dark toggle via `ThemeToggle` component, persisted in `localStorage`
- CSS custom properties (`--bg`, `--fg`, `--border`, `--fg-muted`) for theme colors
- Theme initialized before hydration via inline script to prevent flash

---

## Concurrency & Batching

The orchestrator processes tickers in **batches of 5** to respect external API rate limits (especially SEC EDGAR at 10 req/sec). Within each batch, per-ticker agents run in parallel via `asyncio.gather()`:

```
Batch 1: [AAPL, MSFT, NVDA, GOOGL, META]
  └─ Each ticker: filing + sentiment + earnings (if available) in parallel
Batch 2: [AMZN, TSLA, JPM, GS, BAC]
  └─ ...
Batch 3: [V, MA, UNH, JNJ, PFE]
  └─ ...
```

The macro analyst runs **once** before all ticker analysis (it applies globally).

Signal aggregation runs sequentially per ticker after all analyses complete, because it needs the full set of agent outputs.

---

## Graceful Degradation

Every external dependency has a fallback mode:

| Dependency | Missing Behavior |
|------------|-----------------|
| Anthropic API key | Agents return `None`, analysis skipped |
| Supabase credentials | `db.py` logs warning, all DB ops return `None` — agents still run |
| Alpaca API keys | Executor enters **mock mode** — returns simulated account ($100K) and empty positions |
| Polygon API key | `get_price()` returns `None` — position sizing skips share calculation |
| Earnings transcripts | Stub fetcher returns `None` — earnings agent skipped entirely |

This means the system can run in a fully degraded mode with just the Anthropic API key, producing analyses that are logged to stdout but not persisted.

---

## File Structure

```
swarm-capital/
├── .env                        # API keys (gitignored)
├── .gitignore
├── requirements.txt            # Python dependencies
├── OPERATIONS.md               # Setup and run guide
├── Architecture.md             # This document
│
├── agents/                     # Python agent swarm
│   ├── __init__.py
│   ├── config.py               # Env vars, model selection, risk params, watchlist
│   ├── orchestrator.py         # Main loop: batch analysis → aggregate → risk → execute
│   ├── filing_analyst.py       # SEC filing analysis (10-K, 10-Q, 8-K)
│   ├── earnings_analyst.py     # Earnings call transcript analysis (stub fetcher)
│   ├── sentiment_analyst.py    # News/RSS sentiment scoring
│   ├── macro_analyst.py        # Macro regime classification + sector tilts
│   ├── signal_aggregator.py    # Cross-agent synthesis with portfolio-aware sizing
│   ├── risk_engine.py          # Position sizing + risk limit enforcement
│   ├── executor.py             # Alpaca paper trading integration (with mock mode)
│   ├── edgar_client.py         # SEC EDGAR API wrapper (rate-limited)
│   ├── market_data.py          # Polygon.io wrapper for prices + history
│   └── db.py                   # Supabase client (lazy-init, graceful if unconfigured)
│
├── dashboard/                  # Next.js 16 dashboard
│   ├── package.json            # React 19, Recharts, Supabase client, Tailwind 4
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx      # Shell: nav bar, theme init, Geist fonts
│   │   │   ├── page.tsx        # Portfolio overview (/, default route)
│   │   │   ├── agents/page.tsx # Agent activity feed
│   │   │   ├── signals/page.tsx# Trade candidates (unified signals)
│   │   │   ├── trades/page.tsx # Trade history
│   │   │   └── api/            # 5 API routes (portfolio, analyses, signals, trades, market)
│   │   ├── components/         # 18 components (charts, tables, tiles, nav)
│   │   └── lib/
│   │       ├── supabase.ts     # Client-side Supabase init
│   │       ├── types.ts        # TypeScript interfaces for all data models
│   │       └── sectors.ts      # Sector color/label mapping
│   └── .env.local              # Dashboard-specific env vars (NEXT_PUBLIC_*)
│
├── scripts/
│   ├── setup_db.sql            # Supabase schema (6 tables + indexes + Realtime)
│   ├── seed_watchlist.py       # Upserts 27 tickers into watchlist table
│   └── run_analysis.py         # CLI for single-ticker or multi-ticker analysis
│
└── tests/
    ├── test_filing_analyst.py
    ├── test_risk_engine.py
    └── test_signal_aggregator.py
```

---

## Watchlist

27 tickers across 7 sectors:

| Sector | Tickers | Count |
|--------|---------|-------|
| Technology | AAPL, MSFT, NVDA, GOOGL, META, AMZN, TSLA | 7 |
| Finance | JPM, GS, BAC, V, MA | 5 |
| Healthcare | UNH, JNJ, PFE, LLY | 4 |
| Industrial | CAT, DE, HON | 3 |
| Consumer | WMT, COST, MCD | 3 |
| Energy | XOM, CVX | 2 |
| Defense | LMT, RTX, NOC | 3 |

---

## Entry Points

| Command | What it does |
|---------|-------------|
| `python -m agents.orchestrator --dry-run` | Full watchlist analysis, no trades |
| `python -m agents.orchestrator` | Full watchlist analysis + live paper trading |
| `python -m agents.orchestrator --tickers NVDA,AAPL` | Analyze specific tickers |
| `python scripts/run_analysis.py --ticker NVDA` | Quick single-ticker analysis |
| `python scripts/run_analysis.py --ticker NVDA --execute` | Analyze + execute trades |
| `python scripts/seed_watchlist.py` | Seed/upsert watchlist into Supabase |
| `cd dashboard && npm run dev` | Start dashboard at localhost:3000 |
