export interface AgentAnalysis {
  id: string;
  ticker: string;
  agent_type: "filing" | "earnings" | "sentiment" | "macro";
  analysis: Record<string, unknown>;
  signals: Signal[];
  overall_sentiment: number;
  confidence: number;
  recommendation: string;
  reasoning: string;
  source_url: string;
  analyzed_at: string;
}

export interface Signal {
  type: string;
  description: string;
  sentiment: "positive" | "negative" | "neutral";
  confidence: number;
  evidence: string;
}

export interface TradeSignal {
  id: string;
  ticker: string;
  direction: "long" | "short";
  composite_score: number;
  confidence: number;
  position_action?: "open" | "add" | "trim" | "hold" | "exit" | "no_trade";
  recommended_position_pct?: number;
  position_rationale?: string;
  contributing_analyses: string[];
  conflicts: Conflict[];
  reasoning: string;
  status: "pending" | "approved" | "executed" | "rejected";
  created_at: string;
}

export interface Conflict {
  description: string;
  agents_involved: string[];
  resolution: string;
}

export interface Trade {
  id: string;
  signal_id: string;
  ticker: string;
  direction: "long" | "short";
  quantity: number;
  entry_price: number | null;
  exit_price: number | null;
  pnl: number | null;
  alpaca_order_id: string;
  status: "open" | "closed" | "stopped_out";
  opened_at: string;
  closed_at: string | null;
}

export interface PortfolioSnapshot {
  id: string;
  total_value: number;
  cash: number;
  positions: Position[];
  sharpe_ratio: number | null;
  max_drawdown: number | null;
  win_rate: number | null;
  snapshot_at: string;
}

export interface Position {
  ticker: string;
  qty: number;
  side: string;
  avg_entry_price: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
}

/**
 * Unified signal item shown on the signals page.
 * Can originate from either `trade_signals` (aggregated) or
 * `agent_analyses` (individual agent recommendation).
 */
export interface UnifiedSignal {
  id: string;
  ticker: string;
  direction: "long" | "short";
  composite_score: number;
  confidence: number;
  reasoning: string;
  created_at: string;
  status: string;
  conflicts: Conflict[];
  contributing_analyses: string[];
  position_action?: string;
  recommended_position_pct?: number;
  position_rationale?: string;
  /** "aggregated" = from trade_signals, "agent" = from agent_analyses */
  source: "aggregated" | "agent";
  /** Only set when source is "agent" */
  agent_type?: string;
  /** Original recommendation string from agent_analyses */
  recommendation?: string;
  /** Signals array from agent_analyses */
  agent_signals?: Signal[];
}

export interface SimAccount {
  cash: number;
  equity: number;
  position_value: number;
  initial_capital: number;
  realized_pnl: number;
  total_return_pct: number;
  drawdown_pct: number;
}

export interface SimPosition {
  ticker: string;
  qty: number;
  avg_entry_price: number;
  current_price: number;
  change_pct: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
}

export interface SimOrder {
  id: string;
  ticker: string;
  direction: "long" | "short";
  quantity: number;
  entry_price: number | null;
  exit_price: number | null;
  status: "open" | "pending" | "closed" | "cancelled";
  opened_at: string;
  closed_at: string | null;
  pnl: number | null;
  signal_id: string | null;
  alpaca_order_id: string | null;
}
