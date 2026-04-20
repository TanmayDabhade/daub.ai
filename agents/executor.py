"""Trade Executor — Alpaca Markets paper trading integration."""

import logging
from typing import Optional

from agents.config import ALPACA_API_KEY, ALPACA_SECRET_KEY, ALPACA_BASE_URL
from agents import db

logger = logging.getLogger(__name__)

_trading_client = None
_api = None


def _get_trading_client():
    """Lazy-initialize the Alpaca trading client."""
    global _trading_client
    if _trading_client is not None:
        return _trading_client

    if not ALPACA_API_KEY or not ALPACA_SECRET_KEY:
        logger.warning("Alpaca API keys not configured — executor will use mock mode")
        return None

    from alpaca.trading.client import TradingClient
    _trading_client = TradingClient(ALPACA_API_KEY, ALPACA_SECRET_KEY, paper=True)
    return _trading_client


def get_account() -> dict:
    """Get account information (portfolio value, cash, buying power).

    Returns:
        Dict with equity, cash, buying_power, or mock data if not configured.
    """
    client = _get_trading_client()
    if not client:
        return {
            "equity": 100_000.0,
            "cash": 100_000.0,
            "buying_power": 200_000.0,
            "portfolio_value": 100_000.0,
            "mock": True,
        }

    try:
        account = client.get_account()
        return {
            "equity": float(account.equity),
            "cash": float(account.cash),
            "buying_power": float(account.buying_power),
            "portfolio_value": float(account.portfolio_value),
            "mock": False,
        }
    except Exception as e:
        logger.error(f"Failed to get Alpaca account: {e}")
        return {"error": str(e)}


def get_positions() -> list[dict]:
    """Get all current open positions.

    Returns:
        List of position dicts with ticker, qty, avg_entry, current_price, market_value, pnl
    """
    client = _get_trading_client()
    if not client:
        return []

    try:
        positions = client.get_all_positions()
        return [
            {
                "ticker": p.symbol,
                "qty": int(p.qty),
                "side": "long" if int(p.qty) > 0 else "short",
                "avg_entry_price": float(p.avg_entry_price),
                "current_price": float(p.current_price),
                "market_value": float(p.market_value),
                "unrealized_pnl": float(p.unrealized_pl),
                "unrealized_pnl_pct": float(p.unrealized_plpc),
            }
            for p in positions
        ]
    except Exception as e:
        logger.error(f"Failed to get positions: {e}")
        return []


def place_order(
    ticker: str,
    qty: int,
    side: str,
    order_type: str = "market",
    signal_id: str = "",
) -> Optional[dict]:
    """Place a trade order via Alpaca.

    Args:
        ticker: Stock symbol
        qty: Number of shares
        side: "buy" or "sell"
        order_type: "market" or "limit"
        signal_id: Reference to the trade signal that generated this order

    Returns:
        Order result dict, or None on failure
    """
    client = _get_trading_client()

    if not client:
        logger.info(f"[MOCK] Would place {side} {qty} {ticker} ({order_type})")
        mock_result = {
            "ticker": ticker,
            "qty": qty,
            "side": side,
            "order_type": order_type,
            "status": "mock_filled",
            "mock": True,
        }
        return mock_result

    from alpaca.trading.requests import MarketOrderRequest, LimitOrderRequest
    from alpaca.trading.enums import OrderSide, TimeInForce

    order_side = OrderSide.BUY if side == "buy" else OrderSide.SELL

    try:
        if order_type == "market":
            request = MarketOrderRequest(
                symbol=ticker,
                qty=qty,
                side=order_side,
                time_in_force=TimeInForce.DAY,
            )
        else:
            logger.warning(f"Limit orders not yet implemented — falling back to market for {ticker}")
            request = MarketOrderRequest(
                symbol=ticker,
                qty=qty,
                side=order_side,
                time_in_force=TimeInForce.DAY,
            )

        order = client.submit_order(request)

        result = {
            "ticker": ticker,
            "qty": qty,
            "side": side,
            "order_type": order_type,
            "order_id": str(order.id),
            "status": str(order.status),
            "submitted_at": str(order.submitted_at),
            "mock": False,
        }

        # Log trade to database
        direction = "long" if side == "buy" else "short"
        db.insert_trade(
            signal_id=signal_id,
            ticker=ticker,
            direction=direction,
            quantity=qty,
            alpaca_order_id=str(order.id),
        )

        logger.info(f"Order placed: {side} {qty} {ticker} — order_id={order.id}, status={order.status}")
        return result

    except Exception as e:
        logger.error(f"Failed to place order for {ticker}: {e}")
        return None


def close_position(ticker: str) -> Optional[dict]:
    """Close an entire position for a ticker.

    Returns:
        Order result dict, or None on failure
    """
    client = _get_trading_client()
    if not client:
        logger.info(f"[MOCK] Would close position in {ticker}")
        return {"ticker": ticker, "status": "mock_closed", "mock": True}

    try:
        order = client.close_position(ticker)
        logger.info(f"Position closed: {ticker} — order_id={order.id}")
        return {
            "ticker": ticker,
            "order_id": str(order.id),
            "status": str(order.status),
            "mock": False,
        }
    except Exception as e:
        logger.error(f"Failed to close position for {ticker}: {e}")
        return None


def close_all_positions() -> list[dict]:
    """Close all open positions (go to cash). Used when max drawdown is breached."""
    client = _get_trading_client()
    if not client:
        logger.info("[MOCK] Would close all positions")
        return [{"status": "mock_all_closed", "mock": True}]

    try:
        orders = client.close_all_positions(cancel_orders=True)
        logger.critical("ALL POSITIONS CLOSED — max drawdown breach")
        return [{"order_id": str(o.id), "status": str(o.status)} for o in orders]
    except Exception as e:
        logger.error(f"Failed to close all positions: {e}")
        return []


def get_order_status(order_id: str) -> Optional[dict]:
    """Get the status of a specific order."""
    client = _get_trading_client()
    if not client:
        return {"order_id": order_id, "status": "mock", "mock": True}

    try:
        order = client.get_order_by_id(order_id)
        return {
            "order_id": str(order.id),
            "ticker": order.symbol,
            "status": str(order.status),
            "filled_qty": str(order.filled_qty),
            "filled_avg_price": str(order.filled_avg_price) if order.filled_avg_price else None,
        }
    except Exception as e:
        logger.error(f"Failed to get order status for {order_id}: {e}")
        return None
