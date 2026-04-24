"""Trade Executor — simulated broker backed by Supabase.

Replaces the prior Alpaca paper-trading integration (blocked by KYC/SSN).
Public API is preserved so the orchestrator and risk engine are unchanged.

The simulated broker fills market orders at the latest Polygon trade price
adjusted by a configurable slippage, debits commission, and persists the
ledger to Supabase (`sim_account`, `sim_positions`). When Supabase is not
configured, falls back to a pure in-memory mock so local dev still works.
"""

import logging
import os
import uuid
from typing import Optional

import httpx

from agents.config import (
    EXECUTION_MODE,
    SIM_INITIAL_CAPITAL,
    SIM_SLIPPAGE_BPS,
    SIM_COMMISSION_PER_TRADE,
    POLYGON_API_KEY,
    ALPACA_API_KEY,
    ALPACA_SECRET_KEY,
)
from agents import db

logger = logging.getLogger(__name__)

# In-memory fallback ledger used only when Supabase is unavailable.
# The orchestrator still functions; metrics just don't persist across runs.
_mem_account: Optional[dict] = None
_mem_positions: dict[str, dict] = {}


# --- Internal helpers ---------------------------------------------------------

def _slippage_factor(side: str) -> float:
    bps = SIM_SLIPPAGE_BPS / 10_000.0
    return 1.0 + bps if side == "buy" else 1.0 - bps


def _fetch_latest_price(ticker: str) -> Optional[float]:
    """Sync Polygon price lookup (previous-day close). Used at fill time."""
    if not POLYGON_API_KEY:
        return None
    url = f"https://api.polygon.io/v2/aggs/ticker/{ticker}/prev"
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(url, params={"apiKey": POLYGON_API_KEY})
            resp.raise_for_status()
            results = resp.json().get("results", [])
            if results:
                return float(results[0].get("c"))
    except Exception as e:
        logger.error(f"Price lookup failed for {ticker}: {e}")
    return None


def _ensure_account() -> dict:
    """Return the sim account, initializing it (once) if absent."""
    global _mem_account
    if db._get_client() is None:
        if _mem_account is None:
            _mem_account = {
                "cash": SIM_INITIAL_CAPITAL,
                "realized_pnl": 0.0,
                "initial_capital": SIM_INITIAL_CAPITAL,
                "peak_equity": SIM_INITIAL_CAPITAL,
                "mock": True,
            }
        return _mem_account
    acct = db.get_sim_account()
    if acct is None:
        acct = db.init_sim_account(SIM_INITIAL_CAPITAL)
    return acct or {}


def _get_positions_raw() -> list[dict]:
    if db._get_client() is None:
        return [dict(p) for p in _mem_positions.values()]
    return db.get_sim_positions()


def _get_position_raw(ticker: str) -> Optional[dict]:
    if db._get_client() is None:
        return _mem_positions.get(ticker)
    return db.get_sim_position(ticker)


def _upsert_position(ticker: str, qty: int, avg_entry_price: float) -> None:
    if db._get_client() is None:
        _mem_positions[ticker] = {
            "ticker": ticker,
            "qty": qty,
            "avg_entry_price": avg_entry_price,
        }
        return
    db.upsert_sim_position(ticker, qty, avg_entry_price)


def _delete_position(ticker: str) -> None:
    if db._get_client() is None:
        _mem_positions.pop(ticker, None)
        return
    db.delete_sim_position(ticker)


def _update_account(**fields) -> None:
    if db._get_client() is None:
        assert _mem_account is not None
        _mem_account.update(fields)
        return
    db.update_sim_account(**fields)


# --- Public API ---------------------------------------------------------------

def get_account() -> dict:
    """Portfolio value, cash, buying power — matches prior Alpaca shape."""
    acct = _ensure_account()
    positions = get_positions()
    positions_value = sum(p.get("market_value", 0.0) for p in positions)
    cash = float(acct.get("cash", 0.0))
    equity = cash + positions_value
    initial = float(acct.get("initial_capital", SIM_INITIAL_CAPITAL))
    peak = max(float(acct.get("peak_equity", initial)), equity)
    if peak != acct.get("peak_equity"):
        _update_account(peak_equity=peak)
    return {
        "equity": equity,
        "cash": cash,
        "buying_power": cash,  # no margin in sim
        "portfolio_value": equity,
        "initial_value": initial,
        "peak_value": peak,
        "realized_pnl": float(acct.get("realized_pnl", 0.0)),
        "mock": acct.get("mock", False),
    }


def get_positions() -> list[dict]:
    """Open positions enriched with live price and unrealized PnL."""
    rows = _get_positions_raw()
    out: list[dict] = []
    for row in rows:
        ticker = row["ticker"]
        qty = int(row["qty"])
        entry = float(row["avg_entry_price"])
        price = _fetch_latest_price(ticker) or entry
        market_value = price * qty
        pnl = (price - entry) * qty
        pnl_pct = (price - entry) / entry if entry else 0.0
        out.append({
            "ticker": ticker,
            "qty": qty,
            "side": "long" if qty > 0 else "short",
            "avg_entry_price": entry,
            "current_price": price,
            "market_value": market_value,
            "unrealized_pnl": pnl,
            "unrealized_pnl_pct": pnl_pct,
        })
    return out


def place_order(
    ticker: str,
    qty: int,
    side: str,
    order_type: str = "market",
    signal_id: str = "",
) -> Optional[dict]:
    """Fill a simulated market order against the latest Polygon price.

    Returns an order result dict on success, or None on failure.
    """
    if side not in ("buy", "sell"):
        logger.error(f"Invalid side {side!r}")
        return None
    if qty <= 0:
        logger.error(f"Order qty must be positive, got {qty}")
        return None
    if order_type != "market":
        logger.warning(f"Order type {order_type!r} not supported in sim — treating as market")

    price = _fetch_latest_price(ticker)
    if price is None:
        logger.error(f"No price available for {ticker} — order rejected")
        return None
    fill_price = price * _slippage_factor(side)

    acct = _ensure_account()
    cash = float(acct.get("cash", 0.0))
    realized = float(acct.get("realized_pnl", 0.0))
    position = _get_position_raw(ticker)

    if side == "buy":
        cost = fill_price * qty + SIM_COMMISSION_PER_TRADE
        if cash < cost:
            logger.warning(f"Insufficient cash to buy {qty} {ticker} @ {fill_price:.2f}: need {cost:.2f}, have {cash:.2f}")
            return None
        if position:
            total_qty = int(position["qty"]) + qty
            cur_avg = float(position["avg_entry_price"])
            new_avg = (cur_avg * int(position["qty"]) + fill_price * qty) / total_qty
            _upsert_position(ticker, total_qty, new_avg)
        else:
            _upsert_position(ticker, qty, fill_price)
        _update_account(cash=cash - cost)
    else:  # sell
        held = int(position["qty"]) if position else 0
        if held < qty:
            # Long-only sim for now — short selling not supported.
            logger.warning(f"Sell rejected: holding {held} {ticker}, asked to sell {qty}")
            return None
        entry = float(position["avg_entry_price"])
        proceeds = fill_price * qty - SIM_COMMISSION_PER_TRADE
        pnl = (fill_price - entry) * qty - SIM_COMMISSION_PER_TRADE
        new_qty = held - qty
        if new_qty == 0:
            _delete_position(ticker)
        else:
            _upsert_position(ticker, new_qty, entry)
        _update_account(cash=cash + proceeds, realized_pnl=realized + pnl)

    order_id = str(uuid.uuid4())
    result = {
        "ticker": ticker,
        "qty": qty,
        "side": side,
        "order_type": "market",
        "order_id": order_id,
        "fill_price": fill_price,
        "status": "filled",
        "mock": False,
    }

    direction = "long" if side == "buy" else "short"
    db.insert_trade(
        signal_id=signal_id,
        ticker=ticker,
        direction=direction,
        quantity=qty,
        entry_price=fill_price,
        alpaca_order_id=order_id,
    )
    logger.info(f"SIM fill: {side} {qty} {ticker} @ {fill_price:.2f} (order_id={order_id})")
    return result


def close_position(ticker: str) -> Optional[dict]:
    """Close the entire position for a ticker at the latest price."""
    position = _get_position_raw(ticker)
    if not position:
        logger.info(f"No open position in {ticker} to close")
        return None
    qty = int(position["qty"])
    return place_order(ticker=ticker, qty=abs(qty), side="sell" if qty > 0 else "buy")


def close_all_positions() -> list[dict]:
    """Flatten the book. Used when max drawdown is breached."""
    results: list[dict] = []
    for pos in _get_positions_raw():
        r = close_position(pos["ticker"])
        if r:
            results.append(r)
    logger.critical(f"ALL POSITIONS CLOSED ({len(results)} tickers)")
    return results


def get_order_status(order_id: str) -> Optional[dict]:
    """Sim fills are immediate, so orders are always 'filled'."""
    return {"order_id": order_id, "status": "filled", "mock": False}


# --- Reset (test/demo only) ---------------------------------------------------

def reset_sim_state() -> None:
    """Wipe the in-memory ledger. Safe for tests; does NOT touch Supabase."""
    global _mem_account, _mem_positions
    _mem_account = None
    _mem_positions = {}


# --- Legacy Alpaca path (kept behind flag, off by default) --------------------

def _alpaca_mode_enabled() -> bool:
    return EXECUTION_MODE == "alpaca" and bool(ALPACA_API_KEY and ALPACA_SECRET_KEY)


if _alpaca_mode_enabled():  # pragma: no cover - requires Alpaca KYC
    logger.warning("EXECUTION_MODE=alpaca set but sim executor is the supported path; Alpaca code is not wired.")
