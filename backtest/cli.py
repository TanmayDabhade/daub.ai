"""Backtest CLI.

Usage:
    python -m backtest.cli --strategy spy_buy_hold --start 2022-01-01 --end 2024-12-31
    python -m backtest.cli --strategy equal_weight_watchlist --start 2023-01-01 --end 2025-01-01 --rebalance M

Writes artifacts to reports/<timestamp>/ :
    equity.csv, trades.csv, stats.json, tearsheet.html
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

from backtest import baselines, data, report
from backtest.engine import BacktestConfig, run_backtest

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run a Swarm Capital backtest.")
    parser.add_argument("--strategy", required=True, choices=list(baselines.REGISTRY.keys()))
    parser.add_argument("--start", required=True, help="YYYY-MM-DD")
    parser.add_argument("--end", required=True, help="YYYY-MM-DD")
    parser.add_argument("--capital", type=float, default=100_000.0)
    parser.add_argument("--slippage-bps", type=float, default=5.0)
    parser.add_argument("--commission", type=float, default=0.0)
    parser.add_argument("--rebalance", default="W", choices=["D", "W", "M", "Q"])
    parser.add_argument("--benchmark", default="SPY", help="Symbol to compare against in tear sheet")
    parser.add_argument("--out", default=None, help="Output directory (default: reports/<timestamp>/)")
    args = parser.parse_args(argv)

    strategy_factory = baselines.REGISTRY[args.strategy]
    strategy = strategy_factory()
    universe = baselines.universe_for(args.strategy)
    if args.benchmark and args.benchmark not in universe:
        universe = list(set(universe) | {args.benchmark})

    logger.info(f"Loading bars for {len(universe)} symbols: {sorted(universe)[:6]}...")
    bars = data.load_bars(universe, args.start, args.end)
    data.validate_window(bars)
    logger.info(f"Loaded {len(bars)} bars, {bars.shape[1]} symbols, {bars.index.min().date()} → {bars.index.max().date()}")

    cfg = BacktestConfig(
        initial_capital=args.capital,
        slippage_bps=args.slippage_bps,
        commission_per_trade=args.commission,
        rebalance=args.rebalance,
    )
    result = run_backtest(bars, strategy, cfg)

    benchmark_returns = None
    if args.benchmark and args.benchmark in bars.columns:
        b = bars[args.benchmark].pct_change().dropna()
        b.index = result.returns.index[-len(b):]  # align
        benchmark_returns = b

    out_dir = Path(args.out) if args.out else Path("reports") / datetime.now().strftime("%Y%m%d_%H%M%S")
    stats = report.save_run(result, out_dir, args.strategy, benchmark_returns)
    logger.info(f"Artifacts written to {out_dir.resolve()}")
    logger.info(f"Stats: {json.dumps(stats, indent=2, default=float)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
