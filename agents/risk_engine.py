"""Risk & Position Sizing Engine — Enforces risk limits before trade execution."""

import logging
import math
from typing import Optional

from agents.config import (
    MAX_POSITION_PCT,
    MAX_SECTOR_EXPOSURE_PCT,
    STOP_LOSS_PCT,
    MAX_DRAWDOWN_PCT,
    MIN_CONFIDENCE,
    TICKER_TO_SECTOR,
)

logger = logging.getLogger(__name__)


def check_risk(
    trade_candidate: dict,
    portfolio: dict,
    current_positions: list[dict] = None,
) -> dict:
    """Check a trade candidate against all risk rules.

    Args:
        trade_candidate: Signal aggregator output with ticker, direction, confidence, composite_score
        portfolio: Dict with total_value, cash, positions
        current_positions: List of current open positions

    Returns:
        Dict with approved (bool), reasons (list), position_size (dict if approved)
    """
    if current_positions is None:
        current_positions = []

    ticker = trade_candidate.get("ticker", "")
    confidence = trade_candidate.get("confidence", 0)
    direction = trade_candidate.get("direction", "no_trade")
    total_value = portfolio.get("total_value", 100_000)
    cash = portfolio.get("cash", total_value)

    rejections = []
    warnings = []

    # Rule 1: Minimum confidence
    if confidence < MIN_CONFIDENCE:
        rejections.append(f"Confidence {confidence:.2f} below minimum {MIN_CONFIDENCE}")

    # Rule 2: No trade direction
    if direction == "no_trade":
        rejections.append("Signal direction is no_trade")

    # Rule 3: Check if already holding this ticker
    existing = [p for p in current_positions if p.get("ticker") == ticker]
    if existing:
        warnings.append(f"Already holding {ticker} — would adjust existing position")

    # Rule 4: Sector exposure check
    sector = TICKER_TO_SECTOR.get(ticker, "Unknown")
    sector_value = sum(
        abs(p.get("market_value", 0))
        for p in current_positions
        if TICKER_TO_SECTOR.get(p.get("ticker"), "") == sector
    )
    sector_pct = sector_value / total_value if total_value > 0 else 0
    max_new_position_value = total_value * MAX_POSITION_PCT

    if (sector_value + max_new_position_value) / total_value > MAX_SECTOR_EXPOSURE_PCT:
        allowed_sector = (MAX_SECTOR_EXPOSURE_PCT * total_value) - sector_value
        if allowed_sector <= 0:
            rejections.append(
                f"Sector {sector} at {sector_pct:.1%} — max is {MAX_SECTOR_EXPOSURE_PCT:.0%}"
            )
        else:
            max_new_position_value = allowed_sector
            warnings.append(
                f"Sector {sector} exposure limits position to ${allowed_sector:,.0f}"
            )

    # Rule 5: Portfolio drawdown check
    initial_value = portfolio.get("initial_value", total_value)
    drawdown = (total_value - initial_value) / initial_value if initial_value > 0 else 0
    if drawdown <= MAX_DRAWDOWN_PCT:
        rejections.append(
            f"Portfolio drawdown {drawdown:.1%} exceeds max {MAX_DRAWDOWN_PCT:.0%} — go to cash"
        )

    # Rule 6: Sufficient cash
    if direction == "long" and cash < max_new_position_value * 0.5:
        rejections.append(f"Insufficient cash: ${cash:,.0f} (need ~${max_new_position_value * 0.5:,.0f})")

    if rejections:
        logger.info(f"Trade rejected for {ticker}: {rejections}")
        return {
            "approved": False,
            "ticker": ticker,
            "direction": direction,
            "reasons": rejections,
            "warnings": warnings,
        }

    # Calculate position size
    position = calculate_position_size(
        confidence=confidence,
        portfolio_value=total_value,
        max_position_value=max_new_position_value,
        current_price=trade_candidate.get("current_price"),
    )

    logger.info(f"Trade approved for {ticker}: {direction}, {position}")
    return {
        "approved": True,
        "ticker": ticker,
        "direction": direction,
        "position": position,
        "reasons": [],
        "warnings": warnings,
    }


def calculate_position_size(
    confidence: float,
    portfolio_value: float,
    max_position_value: float = None,
    current_price: Optional[float] = None,
) -> dict:
    """Calculate position size using fixed fractional method.

    Higher confidence = larger position, up to MAX_POSITION_PCT of portfolio.

    Returns:
        Dict with position_value, shares (if price known), pct_of_portfolio
    """
    if max_position_value is None:
        max_position_value = portfolio_value * MAX_POSITION_PCT

    # Scale position by confidence: at 0.7 (min) use 50%, at 1.0 use 100%
    scale = 0.5 + (confidence - MIN_CONFIDENCE) / (1.0 - MIN_CONFIDENCE) * 0.5
    scale = min(max(scale, 0.5), 1.0)

    position_value = max_position_value * scale

    result = {
        "position_value": round(position_value, 2),
        "pct_of_portfolio": round(position_value / portfolio_value, 4) if portfolio_value > 0 else 0,
    }

    if current_price and current_price > 0:
        shares = math.floor(position_value / current_price)
        result["shares"] = shares
        result["actual_value"] = round(shares * current_price, 2)

    return result


def check_stop_loss(position: dict, current_price: float) -> bool:
    """Check if a position should be stopped out.

    Args:
        position: Dict with entry_price, direction
        current_price: Current market price

    Returns:
        True if position should be closed (stop loss triggered)
    """
    entry_price = position.get("entry_price", 0)
    if entry_price <= 0:
        return False

    direction = position.get("direction", "long")

    if direction == "long":
        pnl_pct = (current_price - entry_price) / entry_price
    else:
        pnl_pct = (entry_price - current_price) / entry_price

    if pnl_pct <= STOP_LOSS_PCT:
        logger.warning(
            f"Stop loss triggered for {position.get('ticker')}: "
            f"P&L {pnl_pct:.1%} <= {STOP_LOSS_PCT:.0%}"
        )
        return True
    return False


def check_drawdown(portfolio: dict) -> bool:
    """Check if portfolio drawdown exceeds maximum threshold.

    Args:
        portfolio: Dict with total_value, peak_value or initial_value

    Returns:
        True if portfolio should go to cash (drawdown exceeded)
    """
    total_value = portfolio.get("total_value", 0)
    peak_value = portfolio.get("peak_value", portfolio.get("initial_value", total_value))

    if peak_value <= 0:
        return False

    drawdown = (total_value - peak_value) / peak_value
    if drawdown <= MAX_DRAWDOWN_PCT:
        logger.critical(
            f"MAX DRAWDOWN BREACHED: {drawdown:.1%} <= {MAX_DRAWDOWN_PCT:.0%} — GO TO CASH"
        )
        return True
    return False
