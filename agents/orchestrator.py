"""Orchestrator — Main loop that coordinates the agent swarm."""

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime, timezone

from agents.config import WATCHLIST, MIN_CONFIDENCE, TICKER_TO_SECTOR, MAX_SECTOR_EXPOSURE_PCT
from agents import db
from agents.filing_analyst import analyze_filing
from agents.earnings_analyst import analyze_earnings, fetch_transcript_stub
from agents.sentiment_analyst import analyze_sentiment
from agents.macro_analyst import analyze_macro
from agents.signal_aggregator import aggregate_signals
from agents.risk_engine import check_risk, check_stop_loss, check_drawdown
from agents.executor import (
    get_account,
    get_positions,
    place_order,
    close_position,
    close_all_positions,
)
from agents.market_data import get_price

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


async def analyze_ticker(ticker: str, company_name: str = "") -> list[dict]:
    """Run all applicable analyst agents on a single ticker.

    Returns list of analysis results.
    """
    analyses = []

    # Run filing, sentiment, and earnings in parallel
    tasks = [
        analyze_filing(ticker),
        analyze_sentiment(ticker, company_name),
    ]

    # Try to fetch and analyze earnings transcript
    transcript = await fetch_transcript_stub(ticker)
    if transcript:
        tasks.append(analyze_earnings(ticker, transcript))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, Exception):
            logger.error(f"Agent failed for {ticker}: {result}")
        elif result is not None:
            result["agent_type"] = result.get("agent_type", _infer_agent_type(result))
            analyses.append(result)

    return analyses


def _infer_agent_type(analysis: dict) -> str:
    """Infer agent type from analysis structure."""
    if "filing_type" in analysis:
        return "filing"
    if "guidance_change" in analysis:
        return "earnings"
    if "sentiment_trend" in analysis:
        return "sentiment"
    if "regime" in analysis:
        return "macro"
    return "unknown"


async def run_analysis_cycle(
    tickers: list[str] = None,
    dry_run: bool = False,
) -> dict:
    """Run a full analysis cycle: analyze tickers, aggregate signals, check risk, execute trades.

    Args:
        tickers: List of tickers to analyze. Defaults to full watchlist.
        dry_run: If True, skip trade execution.

    Returns:
        Summary dict with analyses, signals, and trades.
    """
    if tickers is None:
        tickers = [item["ticker"] for item in WATCHLIST]

    ticker_names = {item["ticker"]: item["company_name"] for item in WATCHLIST}

    logger.info(f"Starting analysis cycle for {len(tickers)} tickers (dry_run={dry_run})")

    # Step 1: Run macro analysis (applies to all tickers)
    logger.info("Running macro analysis...")
    macro_analysis = await analyze_macro()

    # Step 2: Analyze each ticker (parallelized in batches of 5 to respect rate limits)
    all_analyses: dict[str, list[dict]] = {}
    batch_size = 5

    for i in range(0, len(tickers), batch_size):
        batch = tickers[i : i + batch_size]
        logger.info(f"Analyzing batch {i // batch_size + 1}: {batch}")

        batch_tasks = [
            analyze_ticker(ticker, ticker_names.get(ticker, ""))
            for ticker in batch
        ]
        batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)

        for ticker, result in zip(batch, batch_results):
            if isinstance(result, Exception):
                logger.error(f"Batch analysis failed for {ticker}: {result}")
                all_analyses[ticker] = []
            else:
                all_analyses[ticker] = result

    # Step 3: Fetch portfolio state for context-aware aggregation
    logger.info("Fetching portfolio state for signal aggregation...")
    account = get_account()
    positions = get_positions()

    # Calculate sector exposure from current positions
    sector_exposure = {}
    for pos in positions:
        sector = TICKER_TO_SECTOR.get(pos.get("ticker", ""), "Unknown")
        sector_exposure[sector] = sector_exposure.get(sector, 0) + abs(pos.get("market_value", 0))

    portfolio_context = {
        "account": account,
        "positions": positions,
        "sector_exposure": sector_exposure,
    }

    # Step 4: Aggregate signals for each ticker (portfolio-aware)
    logger.info("Aggregating signals...")
    all_signals = []
    for ticker, analyses in all_analyses.items():
        if not analyses:
            continue
        signal = await aggregate_signals(ticker, analyses, macro_analysis, portfolio_context)
        if signal:
            all_signals.append(signal)

    # Sort by absolute composite score
    all_signals.sort(key=lambda s: abs(s.get("composite_score", 0)), reverse=True)

    logger.info(f"Generated {len(all_signals)} signals")
    for sig in all_signals:
        logger.info(
            f"  {sig['ticker']}: {sig.get('direction')} "
            f"score={sig.get('composite_score', 0):.2f} "
            f"conf={sig.get('confidence', 0):.2f}"
        )

    if dry_run:
        logger.info("DRY RUN — skipping trade execution")
        # Still take a portfolio snapshot so the dashboard has data
        account = get_account()
        positions = get_positions()
        db.insert_snapshot(
            total_value=account.get("equity", account.get("portfolio_value", 0)),
            cash=account.get("cash", 0),
            positions=positions,
        )
        return {
            "analyses": all_analyses,
            "signals": all_signals,
            "macro": macro_analysis,
            "trades": [],
        }

    # Step 5: Risk check and execute trades
    # Refresh account/positions in case they changed during analysis
    account = get_account()
    positions = get_positions()

    portfolio = {
        "total_value": account.get("equity", account.get("portfolio_value", 100_000)),
        "cash": account.get("cash", 100_000),
        "initial_value": 100_000,  # TODO: track from first snapshot
    }

    # Check portfolio-level drawdown first
    if check_drawdown(portfolio):
        logger.critical("MAX DRAWDOWN BREACHED — closing all positions!")
        close_all_positions()
        return {
            "analyses": all_analyses,
            "signals": all_signals,
            "macro": macro_analysis,
            "trades": [{"action": "close_all", "reason": "max_drawdown_breach"}],
        }

    # Check stop losses on existing positions
    for pos in positions:
        current_price = pos.get("current_price", 0)
        if check_stop_loss(pos, current_price):
            logger.warning(f"Stop loss triggered for {pos['ticker']} — closing position")
            close_position(pos["ticker"])

    # Execute new trades
    trades_executed = []
    for signal in all_signals:
        if signal.get("confidence", 0) < MIN_CONFIDENCE:
            continue
        if signal.get("direction") == "no_trade":
            continue

        # Get current price for position sizing
        price = await get_price(signal["ticker"])
        signal["current_price"] = price

        risk_check = check_risk(signal, portfolio, positions)

        if not risk_check["approved"]:
            logger.info(f"Trade rejected for {signal['ticker']}: {risk_check['reasons']}")
            continue

        position = risk_check["position"]
        shares = position.get("shares", 0)
        if shares <= 0:
            logger.warning(f"Position size is 0 shares for {signal['ticker']} — skipping")
            continue

        side = "buy" if signal["direction"] == "long" else "sell"

        order = place_order(
            ticker=signal["ticker"],
            qty=shares,
            side=side,
            signal_id=signal.get("id", ""),
        )

        if order:
            trades_executed.append(order)
            # Update portfolio cash estimate
            portfolio["cash"] -= position.get("actual_value", position["position_value"])

    logger.info(f"Executed {len(trades_executed)} trades")

    # Step 6: Take portfolio snapshot
    account = get_account()
    positions = get_positions()
    db.insert_snapshot(
        total_value=account.get("equity", account.get("portfolio_value", 0)),
        cash=account.get("cash", 0),
        positions=positions,
    )

    return {
        "analyses": all_analyses,
        "signals": all_signals,
        "macro": macro_analysis,
        "trades": trades_executed,
    }


async def run_stop_loss_check():
    """Check all open positions for stop loss triggers."""
    positions = get_positions()
    for pos in positions:
        current_price = pos.get("current_price", 0)
        if check_stop_loss(pos, current_price):
            logger.warning(f"Stop loss: closing {pos['ticker']}")
            close_position(pos["ticker"])


def main():
    parser = argparse.ArgumentParser(description="Swarm Capital Orchestrator")
    parser.add_argument(
        "--tickers",
        type=str,
        default="",
        help="Comma-separated list of tickers (default: full watchlist)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run analysis without executing trades",
    )
    args = parser.parse_args()

    tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()] or None

    result = asyncio.run(run_analysis_cycle(tickers=tickers, dry_run=args.dry_run))

    # Print summary
    print("\n" + "=" * 60)
    print("ANALYSIS CYCLE COMPLETE")
    print("=" * 60)
    print(f"Tickers analyzed: {len(result['analyses'])}")
    print(f"Signals generated: {len(result['signals'])}")
    print(f"Trades executed: {len(result['trades'])}")

    if result["signals"]:
        print("\nTop signals:")
        for sig in result["signals"][:5]:
            print(
                f"  {sig['ticker']:6s} {sig.get('direction', 'n/a'):5s} "
                f"score={sig.get('composite_score', 0):+.2f} "
                f"conf={sig.get('confidence', 0):.2f}"
            )

    if result["macro"]:
        regime = result["macro"].get("regime", {})
        print(f"\nMacro regime: {regime.get('classification', 'unknown')} "
              f"(confidence={regime.get('confidence', 0):.2f})")


if __name__ == "__main__":
    main()
