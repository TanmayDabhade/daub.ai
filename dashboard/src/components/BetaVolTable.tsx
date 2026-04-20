"use client";

import { useEffect, useState } from "react";
import type { Position } from "@/lib/types";

interface RiskMetrics {
  ticker: string;
  beta: number;
  volatility: number; // annualized
  sharpe: number;
}

function computeMetrics(
  tickerReturns: number[],
  benchmarkReturns: number[]
): { beta: number; volatility: number; sharpe: number } {
  const n = Math.min(tickerReturns.length, benchmarkReturns.length);
  if (n < 10)
    return { beta: 1, volatility: 0, sharpe: 0 };

  const tr = tickerReturns.slice(0, n);
  const br = benchmarkReturns.slice(0, n);

  // Beta
  const meanT = tr.reduce((s, v) => s + v, 0) / n;
  const meanB = br.reduce((s, v) => s + v, 0) / n;
  let cov = 0,
    varB = 0;
  for (let i = 0; i < n; i++) {
    cov += (tr[i] - meanT) * (br[i] - meanB);
    varB += (br[i] - meanB) ** 2;
  }
  const beta = varB === 0 ? 1 : cov / varB;

  // Annualized volatility
  const variance = tr.reduce((s, v) => s + (v - meanT) ** 2, 0) / (n - 1);
  const volatility = Math.sqrt(variance * 252);

  // Sharpe (annualized, risk-free ≈ 5%)
  const annualReturn = meanT * 252;
  const sharpe =
    volatility === 0 ? 0 : (annualReturn - 0.05) / volatility;

  return { beta, volatility, sharpe };
}

function dailyReturns(closes: number[]): number[] {
  const ret: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    ret.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return ret;
}

const DEMO_METRICS: RiskMetrics[] = [
  { ticker: "NVDA", beta: 1.72, volatility: 0.48, sharpe: 1.85 },
  { ticker: "AAPL", beta: 1.15, volatility: 0.23, sharpe: 1.12 },
  { ticker: "JPM", beta: 1.08, volatility: 0.22, sharpe: 0.94 },
  { ticker: "XOM", beta: 0.85, volatility: 0.26, sharpe: 0.68 },
];

export default function BetaVolTable({
  positions,
}: {
  positions: Position[];
}) {
  const tickers = positions.map((p) => p.ticker);
  const [metrics, setMetrics] = useState<RiskMetrics[]>(DEMO_METRICS);

  useEffect(() => {
    if (!tickers.length) return;

    // Fetch historical for positions + SPY benchmark
    const allTickers = [...new Set([...tickers, "SPY"])];
    fetch(
      `/api/market?action=historical&tickers=${allTickers.join(",")}&days=180`
    )
      .then((r) => r.json())
      .then((json) => {
        if (json.error || !json.historical) return;

        const hist = json.historical as Record<
          string,
          { date: string; close: number }[]
        >;
        const spyReturns = hist["SPY"]?.length
          ? dailyReturns(hist["SPY"].map((b) => b.close))
          : [];

        if (!spyReturns.length) return;

        const results: RiskMetrics[] = [];
        for (const t of tickers) {
          if (!hist[t]?.length) continue;
          const tr = dailyReturns(hist[t].map((b) => b.close));
          const m = computeMetrics(tr, spyReturns);
          results.push({ ticker: t, ...m });
        }

        if (results.length) setMetrics(results);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers.join(",")]);

  return (
    <div className="p-4 h-full flex flex-col">
      <h3
        className="text-[10px] uppercase tracking-wider font-medium mb-3"
        style={{ color: "var(--fg-muted)" }}
      >
        Risk Metrics
      </h3>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr
              className="text-[10px] uppercase tracking-wider"
              style={{
                color: "var(--fg-muted)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <th className="text-left py-1.5 font-medium">Ticker</th>
              <th className="text-right py-1.5 font-medium">Beta</th>
              <th className="text-right py-1.5 font-medium">Vol (Ann)</th>
              <th className="text-right py-1.5 font-medium">Sharpe</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr
                key={m.ticker}
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <td
                  className="py-1.5 font-mono font-semibold"
                  style={{ color: "var(--fg)" }}
                >
                  {m.ticker}
                </td>
                <td className="py-1.5 text-right font-mono">
                  <span
                    style={{
                      color:
                        m.beta > 1.5
                          ? "var(--red)"
                          : m.beta > 1
                            ? "var(--yellow)"
                            : "var(--green)",
                    }}
                  >
                    {m.beta.toFixed(2)}
                  </span>
                </td>
                <td
                  className="py-1.5 text-right font-mono"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  {(m.volatility * 100).toFixed(1)}%
                </td>
                <td className="py-1.5 text-right font-mono">
                  <span
                    style={{
                      color:
                        m.sharpe > 1
                          ? "var(--green)"
                          : m.sharpe > 0
                            ? "var(--yellow)"
                            : "var(--red)",
                    }}
                  >
                    {m.sharpe.toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
