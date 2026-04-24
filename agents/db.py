"""Supabase database client for Swarm Capital."""

import logging
from datetime import datetime, timezone
from typing import Optional

from agents.config import SUPABASE_URL, SUPABASE_KEY

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.warning("Supabase not configured — database operations will be skipped")
        return None
    from supabase import create_client
    _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def insert_analysis(
    ticker: str,
    agent_type: str,
    analysis: dict,
    signals: list,
    overall_sentiment: float,
    confidence: float,
    recommendation: str,
    reasoning: str,
    source_url: str = "",
) -> Optional[dict]:
    client = _get_client()
    if not client:
        return None
    row = {
        "ticker": ticker,
        "agent_type": agent_type,
        "analysis": analysis,
        "signals": signals,
        "overall_sentiment": overall_sentiment,
        "confidence": confidence,
        "recommendation": recommendation,
        "reasoning": reasoning,
        "source_url": source_url,
    }
    result = client.table("agent_analyses").insert(row).execute()
    return result.data[0] if result.data else None


def insert_signal(
    ticker: str,
    direction: str,
    composite_score: float,
    confidence: float,
    contributing_analyses: list[str],
    conflicts: list,
    reasoning: str,
    status: str = "pending",
) -> Optional[dict]:
    client = _get_client()
    if not client:
        return None
    row = {
        "ticker": ticker,
        "direction": direction,
        "composite_score": composite_score,
        "confidence": confidence,
        "contributing_analyses": contributing_analyses,
        "conflicts": conflicts,
        "reasoning": reasoning,
        "status": status,
    }
    result = client.table("trade_signals").insert(row).execute()
    return result.data[0] if result.data else None


def insert_trade(
    signal_id: str,
    ticker: str,
    direction: str,
    quantity: int,
    entry_price: Optional[float] = None,
    alpaca_order_id: str = "",
) -> Optional[dict]:
    client = _get_client()
    if not client:
        return None
    row = {
        "signal_id": signal_id,
        "ticker": ticker,
        "direction": direction,
        "quantity": quantity,
        "entry_price": entry_price,
        "alpaca_order_id": alpaca_order_id,
        "status": "open",
    }
    result = client.table("trades").insert(row).execute()
    return result.data[0] if result.data else None


def update_trade(trade_id: str, **kwargs) -> Optional[dict]:
    client = _get_client()
    if not client:
        return None
    result = client.table("trades").update(kwargs).eq("id", trade_id).execute()
    return result.data[0] if result.data else None


def insert_snapshot(
    total_value: float,
    cash: float,
    positions: list,
    sharpe_ratio: Optional[float] = None,
    max_drawdown: Optional[float] = None,
    win_rate: Optional[float] = None,
) -> Optional[dict]:
    client = _get_client()
    if not client:
        return None
    row = {
        "total_value": total_value,
        "cash": cash,
        "positions": positions,
        "sharpe_ratio": sharpe_ratio,
        "max_drawdown": max_drawdown,
        "win_rate": win_rate,
    }
    result = client.table("portfolio_snapshots").insert(row).execute()
    return result.data[0] if result.data else None


def get_latest_analyses(ticker: str, limit: int = 10) -> list[dict]:
    client = _get_client()
    if not client:
        return []
    result = (
        client.table("agent_analyses")
        .select("*")
        .eq("ticker", ticker)
        .order("analyzed_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def get_recent_analyses(limit: int = 50) -> list[dict]:
    client = _get_client()
    if not client:
        return []
    result = (
        client.table("agent_analyses")
        .select("*")
        .order("analyzed_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def get_open_trades() -> list[dict]:
    client = _get_client()
    if not client:
        return []
    result = (
        client.table("trades")
        .select("*")
        .eq("status", "open")
        .execute()
    )
    return result.data or []


def get_pending_signals() -> list[dict]:
    client = _get_client()
    if not client:
        return []
    result = (
        client.table("trade_signals")
        .select("*")
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def get_portfolio_snapshot() -> Optional[dict]:
    client = _get_client()
    if not client:
        return None
    result = (
        client.table("portfolio_snapshots")
        .select("*")
        .order("snapshot_at", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def get_trade_history(limit: int = 100) -> list[dict]:
    client = _get_client()
    if not client:
        return []
    result = (
        client.table("trades")
        .select("*")
        .order("opened_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def update_signal_status(signal_id: str, status: str) -> Optional[dict]:
    client = _get_client()
    if not client:
        return None
    result = (
        client.table("trade_signals")
        .update({"status": status})
        .eq("id", signal_id)
        .execute()
    )
    return result.data[0] if result.data else None


# --- Simulated broker state ---

def get_sim_account() -> Optional[dict]:
    client = _get_client()
    if not client:
        return None
    result = client.table("sim_account").select("*").eq("id", 1).limit(1).execute()
    return result.data[0] if result.data else None


def init_sim_account(initial_capital: float) -> Optional[dict]:
    """Seed the singleton sim_account row if it doesn't exist. Idempotent."""
    client = _get_client()
    if not client:
        return None
    existing = get_sim_account()
    if existing:
        return existing
    row = {
        "id": 1,
        "cash": initial_capital,
        "realized_pnl": 0,
        "initial_capital": initial_capital,
        "peak_equity": initial_capital,
    }
    result = client.table("sim_account").insert(row).execute()
    return result.data[0] if result.data else None


def update_sim_account(**kwargs) -> Optional[dict]:
    client = _get_client()
    if not client:
        return None
    kwargs["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = client.table("sim_account").update(kwargs).eq("id", 1).execute()
    return result.data[0] if result.data else None


def get_sim_positions() -> list[dict]:
    client = _get_client()
    if not client:
        return []
    result = client.table("sim_positions").select("*").execute()
    return result.data or []


def get_sim_position(ticker: str) -> Optional[dict]:
    client = _get_client()
    if not client:
        return None
    result = client.table("sim_positions").select("*").eq("ticker", ticker).limit(1).execute()
    return result.data[0] if result.data else None


def upsert_sim_position(ticker: str, qty: int, avg_entry_price: float) -> Optional[dict]:
    client = _get_client()
    if not client:
        return None
    row = {
        "ticker": ticker,
        "qty": qty,
        "avg_entry_price": avg_entry_price,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = client.table("sim_positions").upsert(row).execute()
    return result.data[0] if result.data else None


def delete_sim_position(ticker: str) -> None:
    client = _get_client()
    if not client:
        return
    client.table("sim_positions").delete().eq("ticker", ticker).execute()


def get_watchlist() -> list[dict]:
    client = _get_client()
    if not client:
        return []
    result = (
        client.table("watchlist")
        .select("*")
        .eq("active", True)
        .execute()
    )
    return result.data or []
