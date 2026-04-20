# Swarm Capital — Operations Guide

How to set up Supabase, populate it, and run the agents so data flows to the dashboard.

---

## 1. Supabase Setup

### Create the tables

Open the Supabase SQL Editor for your project and run the schema file:

```sql
-- Copy-paste the contents of scripts/setup_db.sql into the SQL Editor and run it
```

This creates 6 tables:
| Table | What goes in it | Written by |
|---|---|---|
| `watchlist` | Tickers the swarm monitors | `seed_watchlist.py` |
| `agent_analyses` | Raw analysis from each agent (filing, earnings, sentiment, macro) | Each analyst agent |
| `trade_signals` | Aggregated trade recommendations with composite scores | Signal aggregator |
| `trades` | Executed trades with entry/exit prices and P&L | Executor |
| `portfolio_snapshots` | Point-in-time portfolio value, cash, positions | Orchestrator |
| `agent_performance` | Backtested accuracy of each agent | (future) |

It also enables Supabase Realtime on the key tables so the dashboard updates live.

### Enable Row Level Security (optional for demo)

For the demo, RLS is off so the dashboard can read freely. For production, add policies.

---

## 2. Environment Variables

In `swarm-capital/.env`:

```bash
# Required for agents
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key-or-anon-key

# Required for dashboard (dashboard/.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Optional (needed for live trading / market data)
ALPACA_API_KEY=...
ALPACA_SECRET_KEY=...
POLYGON_API_KEY=...
```

---

## 3. Seed the Watchlist

```bash
cd swarm-capital
pip install -r requirements.txt
python scripts/seed_watchlist.py
```

This upserts 27 tickers (tech, finance, healthcare, industrial, consumer, energy, defense) into the `watchlist` table.

---

## 4. Run the Agents

### Analyze specific tickers (dry run — no trades, still writes to Supabase)

```bash
python scripts/run_analysis.py --ticker NVDA
python scripts/run_analysis.py --ticker NVDA,AAPL,TSLA
```

### Run full watchlist analysis

```bash
python -m agents.orchestrator --dry-run
```

### Run with live paper trading (Alpaca keys required)

```bash
python -m agents.orchestrator
python scripts/run_analysis.py --ticker NVDA --execute
```

---

## 5. What Happens When You Run an Agent

Every run pushes data to Supabase automatically. Here's the flow:

```
1. Orchestrator starts
   │
2. Macro analyst runs ──────────────────────► agent_analyses (macro row)
   │
3. For each ticker, in parallel:
   ├─ Filing analyst ───────────────────────► agent_analyses (filing row)
   ├─ Sentiment analyst ────────────────────► agent_analyses (sentiment row)
   └─ Earnings analyst (if transcript) ─────► agent_analyses (earnings row)
   │
4. Signal aggregator (per ticker) ──────────► trade_signals (if confidence ≥ 0.7)
   │
5. Risk engine checks signals
   │
6. Executor places orders (if not dry-run) ─► trades
   │
7. Portfolio snapshot ──────────────────────► portfolio_snapshots
```

**Even in dry-run mode**, steps 2-4 and 7 write to Supabase. The only thing skipped is step 6 (actual trade execution).

---

## 6. Verify Data in Supabase

After running agents, check these tables in the Supabase dashboard:

```sql
-- Recent analyses (should have rows after any agent run)
SELECT ticker, agent_type, recommendation, confidence, analyzed_at
FROM agent_analyses ORDER BY analyzed_at DESC LIMIT 20;

-- Trade signals (only appears when confidence ≥ 0.7)
SELECT ticker, direction, composite_score, confidence, status, created_at
FROM trade_signals ORDER BY created_at DESC LIMIT 10;

-- Portfolio snapshots
SELECT total_value, cash, snapshot_at
FROM portfolio_snapshots ORDER BY snapshot_at DESC LIMIT 5;

-- Watchlist
SELECT ticker, company_name, sector FROM watchlist WHERE active = true;
```

---

## 7. Start the Dashboard

```bash
cd swarm-capital/dashboard
npm install
npm run dev
```

The dashboard reads from Supabase via API routes and displays:
- **/** — Portfolio overview with chart, stats, positions
- **/agents** — Live feed of agent analyses
- **/signals** — Trade signal cards with scores
- **/trades** — Trade history table

Realtime is enabled, so new agent runs update the dashboard automatically.

---

## 8. Quick Demo Workflow

For the Startup Weekend demo, run this sequence:

```bash
# Terminal 1: Start dashboard
cd swarm-capital/dashboard && npm run dev

# Terminal 2: Seed and run agents
cd swarm-capital
python scripts/seed_watchlist.py
python scripts/run_analysis.py --ticker NVDA,AAPL,TSLA

# Watch the dashboard populate in real-time
```

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| "Supabase not configured" warning | Check `SUPABASE_URL` and `SUPABASE_KEY` in `.env` |
| Dashboard shows no data | Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `dashboard/.env.local` |
| Tables don't exist | Run `scripts/setup_db.sql` in Supabase SQL Editor |
| Agent analyses empty | Run `python scripts/run_analysis.py --ticker NVDA` first |
| Trades table empty | Agents run in dry-run mode by default — use `--execute` for live trades |
