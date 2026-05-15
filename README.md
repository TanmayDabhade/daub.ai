# daub.ai

**An AI-native hedge fund.** A swarm of Claude agents reads filings, news, and macro data in parallel, synthesizes trade signals, and executes paper trades through Alpaca — all surfaced in a live trading-terminal dashboard.

---

## What we built

A two-sided system:

- A **Python agent swarm** that continuously analyzes a 27-ticker watchlist across 7 sectors. Specialized agents (filings, sentiment, earnings, macro) run in parallel, a signal aggregator cross-references their outputs, a risk engine sizes positions, and an executor places paper trades.
- A **Next.js 16 dashboard** that visualizes the swarm in real time — portfolio P&L, open positions, agent activity feed, trade candidates, and historical trades — backed by Supabase Realtime so the UI updates as agents write.

The two halves are decoupled. They communicate only through Postgres. Either side can run alone.

---

## Why we built it this way

**Why agents instead of one big model.** Financial analysis is multi-modal: a 10-K reads differently than a news headline, which reads differently than a Fed release. Specializing each agent lets us pick the right model per job (Opus for filings and synthesis, Sonnet for news and macro), use source-specific prompts, and parallelize across tickers without one task starving another.

**Why Supabase as the seam.** Putting Postgres between the swarm and the dashboard means the analysis loop has no opinions about the UI, and the dashboard has no opinions about Python. Realtime subscriptions give us a live feed without writing a websocket layer. The same tables also serve as the audit log for every decision the system has made.

**Why a separate signal aggregator.** Individual agents disagree all the time — sentiment can be bullish on a stock whose filings just got worse. Rather than averaging, we run a dedicated Opus pass that sees every agent's output plus current portfolio state, scores conflicts explicitly, and produces a composite signal with portfolio-aware sizing.

**Why paper trading first.** Alpaca paper accounts let the full pipeline — orders, fills, P&L — run end-to-end without capital risk. Risk limits (5% max position, 25% max sector exposure, -3% stop-loss, -10% portfolio drawdown circuit breaker) are enforced in code, not as guidance.

**Why graceful degradation everywhere.** Any external dependency (Anthropic, Supabase, Alpaca, Polygon) can be missing and the rest of the system still runs. This means a developer can iterate on agent prompts with just an Anthropic key, no infra.

---

## How it works

```
                            ┌────────────────────┐
                            │  NEXT.JS DASHBOARD │
                            │   (port 3000)      │
                            │                    │
                            │  Portfolio · Agents│
                            │  Signals · Trades  │
                            └─────────┬──────────┘
                                      │  API routes + Realtime
                                      │
                            ┌─────────▼──────────┐
                            │  SUPABASE POSTGRES │
                            │                    │
                            │  watchlist         │
                            │  agent_analyses    │
                            │  trade_signals     │
                            │  trades            │
                            │  portfolio_snaps   │
                            │  agent_performance │
                            └─────────▲──────────┘
                                      │  writes
   ┌──────────────────────────────────┴──────────────────────────────────┐
   │                       PYTHON AGENT SWARM                            │
   │                                                                     │
   │                       ┌──────────────────┐                          │
   │                       │   ORCHESTRATOR   │  batches of 5, parallel  │
   │                       └─┬────┬────┬────┬─┘                          │
   │       ┌─────────────────┘    │    │    └─────────────────┐          │
   │       ▼                      ▼    ▼                      ▼          │
   │  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌───────────┐│
   │  │ FILING  │  │EARNINGS │  │SENTIMENT │  │  MACRO  │  │  SIGNAL   ││
   │  │ Opus    │  │ Opus    │  │ Sonnet   │  │ Sonnet  │  │AGGREGATOR ││
   │  └────┬────┘  └────┬────┘  └────┬─────┘  └────┬────┘  │  Opus     ││
   │       │            │            │             │       └─────┬─────┘│
   │       ▼            ▼            ▼             ▼             ▼      │
   │   SEC EDGAR    transcripts   Google +     FRED + Google  ┌─────────┐│
   │   (10-K/Q/8K)   (stub)       Yahoo RSS    News RSS       │  RISK   ││
   │                                                           │ ENGINE  ││
   │                                                           └────┬────┘│
   │                                                                ▼     │
   │                                                          ┌──────────┐│
   │                                                          │ EXECUTOR ││
   │                                                          │ (Alpaca) ││
   │                                                          └──────────┘│
   └─────────────────────────────────────────────────────────────────────┘
```

**One analysis cycle:**

1. **Macro pass.** A single Sonnet call classifies the market regime (`risk_on | risk_off | transitioning | uncertain`) from FRED and Google News RSS.
2. **Per-ticker fan-out.** Tickers are processed in batches of 5; within each batch, filing/sentiment/earnings analysts run concurrently via `asyncio.gather`.
3. **Filing agent** pulls the latest 10-K/10-Q/8-K from EDGAR plus the previous filing of the same type, and asks Opus to diff them.
4. **Sentiment agent** scores Google News + Yahoo RSS headlines with Sonnet, tagging material events.
5. **Aggregator.** Opus receives every agent's output, the macro regime, and current portfolio state. It scores conflicts, produces a composite -1 to +1 score, picks `long/short/no_trade`, and sizes the position (capped at 5% of book).
6. **Risk engine** vetoes anything below 0.7 confidence, anything that would breach sector limits, and anything that would push drawdown past -10%. Stop-losses on existing positions are checked every cycle.
7. **Executor** places market orders through Alpaca's paper API. In dry-run mode (default) this step is skipped, but everything above still writes to Supabase.

**Rate limits we respect:** EDGAR is throttled to ~9 req/sec via a global `asyncio.Lock`. Polygon free-tier is 5 calls/min. Batching exists because of EDGAR, not because of Claude.

---

## Stack

| Layer | Choice |
|-------|--------|
| Agent runtime | Python 3 + `asyncio`, `anthropic` SDK |
| Models | `claude-opus-4-6` (filings, earnings, aggregator), `claude-sonnet-4-6` (sentiment, macro) |
| Data layer | Supabase (Postgres + Realtime) — 6 tables, 4 with Realtime |
| Execution | Alpaca Markets paper trading |
| Market data | Polygon.io |
| Dashboard | Next.js 16 (App Router), React 19, Tailwind 4, Recharts |
| Fonts | Geist Sans / Geist Mono |

---

## Project layout

```
daub/
├── agents/         # The Python swarm: orchestrator + 5 analysts + risk + executor
├── dashboard/      # Next.js 16 trading terminal (4 pages, 5 API routes, 18 components)
├── landing/        # Marketing site
├── scripts/        # setup_db.sql, seed_watchlist.py, run_analysis.py
├── tests/          # Agent + risk engine unit tests
├── Architecture.md # Deep technical reference (schema, prompts, flows)
└── OPERATIONS.md   # Setup, env vars, run commands
```

For schema details, model rationale, and full data flow, see `Architecture.md`. For setup and run commands, see `OPERATIONS.md`.

---

## Quick start

```bash
# Run the swarm in dry-run mode (writes analyses to Supabase, no trades)
python -m agents.orchestrator --dry-run

# Single-ticker spike
python scripts/run_analysis.py --ticker NVDA

# Dashboard
cd dashboard && npm run dev   # → http://localhost:3000
```

The system runs in fully degraded mode with only an Anthropic API key — analyses stream to stdout, the rest is skipped cleanly.
