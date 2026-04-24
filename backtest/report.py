"""Tear sheet generator — the YC-facing artifact.

Uses QuantStats to produce an HTML report (Sharpe, Sortino, Calmar, rolling
drawdown, underwater curve, monthly returns heatmap) plus a compact stats
dict for the dashboard.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# QuantStats pandas extensions are registered on import; we want them lazy
# so the rest of the backtest module stays importable without the extras.


@dataclass
class TearSheetStats:
    total_return: float
    cagr: float
    sharpe: float
    sortino: float
    calmar: float
    max_drawdown: float
    volatility: float
    win_rate: float
    best_day: float
    worst_day: float
    num_trades: int


def compute_stats(
    returns: pd.Series,
    trades: Optional[pd.DataFrame] = None,
) -> TearSheetStats:
    """Compute headline metrics. Uses QuantStats where practical."""
    import quantstats as qs  # lazy

    returns = returns.dropna()
    if returns.empty:
        raise ValueError("returns is empty — cannot compute stats")

    total_return = float((1 + returns).prod() - 1)
    n_trades = int(len(trades)) if trades is not None else 0

    try:
        sharpe = float(qs.stats.sharpe(returns))
        sortino = float(qs.stats.sortino(returns))
        cagr = float(qs.stats.cagr(returns))
        max_dd = float(qs.stats.max_drawdown(returns))
        calmar = float(qs.stats.calmar(returns))
        vol = float(qs.stats.volatility(returns))
        win_rate = float(qs.stats.win_rate(returns))
        best = float(qs.stats.best(returns))
        worst = float(qs.stats.worst(returns))
    except Exception as e:
        logger.warning(f"QuantStats failed — falling back to raw math: {e}")
        daily_std = returns.std()
        sharpe = float((returns.mean() / daily_std) * np.sqrt(252)) if daily_std > 0 else 0.0
        downside = returns[returns < 0].std()
        sortino = float((returns.mean() / downside) * np.sqrt(252)) if downside > 0 else 0.0
        n_years = max(len(returns) / 252.0, 1e-9)
        cagr = float((1 + total_return) ** (1 / n_years) - 1)
        equity = (1 + returns).cumprod()
        peak = equity.cummax()
        max_dd = float(((equity - peak) / peak).min())
        calmar = float(cagr / abs(max_dd)) if max_dd < 0 else 0.0
        vol = float(daily_std * np.sqrt(252))
        win_rate = float((returns > 0).sum() / len(returns))
        best = float(returns.max())
        worst = float(returns.min())

    return TearSheetStats(
        total_return=total_return,
        cagr=cagr,
        sharpe=sharpe,
        sortino=sortino,
        calmar=calmar,
        max_drawdown=max_dd,
        volatility=vol,
        win_rate=win_rate,
        best_day=best,
        worst_day=worst,
        num_trades=n_trades,
    )


def generate_html(
    returns: pd.Series,
    out_path: Path,
    benchmark: Optional[pd.Series] = None,
    title: str = "Swarm Capital — Backtest Tear Sheet",
) -> Path:
    """Write a QuantStats HTML tear sheet to `out_path`."""
    import quantstats as qs  # lazy

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        qs.reports.html(
            returns,
            benchmark=benchmark,
            output=str(out_path),
            title=title,
            download_filename=None,
        )
    except Exception as e:
        logger.error(f"QuantStats HTML generation failed: {e}")
        # Minimal fallback so the CLI still produces *something*.
        out_path.write_text(
            f"<html><body><h1>{title}</h1>"
            f"<p>QuantStats report failed: {e}</p></body></html>"
        )
    return out_path


def save_run(
    result,                               # BacktestResult (avoid circular import)
    out_dir: Path,
    strategy_name: str,
    benchmark_returns: Optional[pd.Series] = None,
) -> dict:
    """Persist equity.csv, trades.csv, stats.json, tearsheet.html."""
    import json

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    result.equity_curve.to_csv(out_dir / "equity.csv", header=True)
    result.trades.to_csv(out_dir / "trades.csv", index=False)

    stats = compute_stats(result.returns, result.trades)
    stats_dict = stats.__dict__
    (out_dir / "stats.json").write_text(json.dumps(stats_dict, indent=2, default=float))

    generate_html(
        result.returns,
        out_dir / "tearsheet.html",
        benchmark=benchmark_returns,
        title=f"Swarm Capital — {strategy_name}",
    )
    return stats_dict
