"""Run analysis on a single ticker — useful for testing and demos."""

import argparse
import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agents.orchestrator import run_analysis_cycle


def main():
    parser = argparse.ArgumentParser(description="Run Swarm Capital analysis on specific tickers")
    parser.add_argument(
        "--ticker",
        type=str,
        required=True,
        help="Ticker symbol(s), comma-separated (e.g., NVDA or NVDA,AAPL)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Run without executing trades (default: True)",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually execute trades (overrides --dry-run)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="",
        help="Output file path for JSON results",
    )
    args = parser.parse_args()

    tickers = [t.strip().upper() for t in args.ticker.split(",")]
    dry_run = not args.execute

    print(f"Analyzing: {', '.join(tickers)}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE EXECUTION'}")
    print("=" * 60)

    result = asyncio.run(run_analysis_cycle(tickers=tickers, dry_run=dry_run))

    # Print detailed results
    for ticker in tickers:
        analyses = result["analyses"].get(ticker, [])
        print(f"\n{'=' * 60}")
        print(f"TICKER: {ticker}")
        print(f"{'=' * 60}")
        print(f"Analyses completed: {len(analyses)}")

        for analysis in analyses:
            agent_type = analysis.get("agent_type", "unknown")
            print(f"\n  [{agent_type.upper()}]")
            print(f"  Recommendation: {analysis.get('recommendation', 'N/A')}")
            print(f"  Sentiment: {analysis.get('overall_sentiment', 'N/A')}")
            signals = analysis.get("signals", [])
            print(f"  Signals: {len(signals)}")
            for sig in signals[:3]:
                print(f"    - {sig.get('type')}: {sig.get('description', '')[:80]}")
                print(f"      confidence={sig.get('confidence', 0):.2f}, sentiment={sig.get('sentiment')}")

    # Print signals
    if result["signals"]:
        print(f"\n{'=' * 60}")
        print("AGGREGATED SIGNALS")
        print(f"{'=' * 60}")
        for sig in result["signals"]:
            print(
                f"  {sig['ticker']:6s} {sig.get('direction', 'n/a'):5s} "
                f"score={sig.get('composite_score', 0):+.2f} "
                f"conf={sig.get('confidence', 0):.2f}"
            )
            if sig.get("conflicts"):
                for conflict in sig["conflicts"]:
                    print(f"    ⚠ CONFLICT: {conflict.get('description', '')[:60]}")

    # Print macro context
    if result["macro"]:
        regime = result["macro"].get("regime", {})
        print(f"\nMacro: {regime.get('classification', 'unknown')} "
              f"(confidence={regime.get('confidence', 0):.2f})")

    # Save to file if requested
    if args.output:
        with open(args.output, "w") as f:
            json.dump(result, f, indent=2, default=str)
        print(f"\nResults saved to {args.output}")


if __name__ == "__main__":
    main()
