-- Swarm Capital Database Schema
-- Run this in Supabase SQL Editor

-- Watchlist of tickers the swarm monitors
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT UNIQUE NOT NULL,
  company_name TEXT,
  sector TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- Raw agent analysis results
CREATE TABLE IF NOT EXISTS agent_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  analysis JSONB NOT NULL,
  signals JSONB NOT NULL,
  overall_sentiment FLOAT,
  confidence FLOAT,
  recommendation TEXT,
  reasoning TEXT,
  source_url TEXT,
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aggregated trade candidates
CREATE TABLE IF NOT EXISTS trade_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  direction TEXT NOT NULL,
  composite_score FLOAT NOT NULL,
  confidence FLOAT NOT NULL,
  contributing_analyses UUID[],
  conflicts JSONB,
  reasoning TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Executed trades
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES trade_signals(id),
  ticker TEXT NOT NULL,
  direction TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  entry_price FLOAT,
  exit_price FLOAT,
  pnl FLOAT,
  alpaca_order_id TEXT,
  status TEXT DEFAULT 'open',
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Portfolio snapshots for charting
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_value FLOAT NOT NULL,
  cash FLOAT NOT NULL,
  positions JSONB NOT NULL,
  sharpe_ratio FLOAT,
  max_drawdown FLOAT,
  win_rate FLOAT,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent performance tracking
CREATE TABLE IF NOT EXISTS agent_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL,
  ticker TEXT NOT NULL,
  signal_direction TEXT NOT NULL,
  signal_confidence FLOAT NOT NULL,
  actual_return_1d FLOAT,
  actual_return_5d FLOAT,
  actual_return_20d FLOAT,
  was_correct BOOLEAN,
  evaluated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analyses_ticker_date ON agent_analyses(ticker, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_agent_type ON agent_analyses(agent_type);
CREATE INDEX IF NOT EXISTS idx_signals_status ON trade_signals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON portfolio_snapshots(snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_agent ON agent_performance(agent_type, evaluated_at DESC);

-- Simulated broker state (replaces Alpaca paper trading).
-- Single-row account ledger; positions keyed by ticker.
CREATE TABLE IF NOT EXISTS sim_account (
  id INTEGER PRIMARY KEY DEFAULT 1,
  cash FLOAT NOT NULL,
  realized_pnl FLOAT NOT NULL DEFAULT 0,
  initial_capital FLOAT NOT NULL,
  peak_equity FLOAT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sim_account_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS sim_positions (
  ticker TEXT PRIMARY KEY,
  qty INTEGER NOT NULL,
  avg_entry_price FLOAT NOT NULL,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE agent_analyses;
ALTER PUBLICATION supabase_realtime ADD TABLE trade_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE trades;
ALTER PUBLICATION supabase_realtime ADD TABLE portfolio_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE sim_account;
ALTER PUBLICATION supabase_realtime ADD TABLE sim_positions;
