"use client";

import { useEffect, useState } from "react";
import type { Position } from "@/lib/types";
import Sparkline from "./Sparkline";

// Generate deterministic demo sparkline from ticker name
function demoSparkline(ticker: string): number[] {
  let seed = 0;
  for (const c of ticker) seed += c.charCodeAt(0);
  const data: number[] = [];
  let v = 100;
  for (let i = 0; i < 20; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    v += ((seed % 100) - 48) / 20;
    data.push(v);
  }
  return data;
}

export default function PositionTable({
  positions,
}: {
  positions: Position[];
}) {
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});

  useEffect(() => {
    // Initialize with demo sparklines
    const demo: Record<string, number[]> = {};
    for (const p of positions) {
      demo[p.ticker] = demoSparkline(p.ticker);
    }
    setSparklines(demo);

    // Try to fetch real data
    if (!positions.length) return;
    const tickers = positions.map((p) => p.ticker);

    fetch(
      `/api/market?action=historical&tickers=${tickers.join(",")}&days=30`
    )
      .then((r) => r.json())
      .then((json) => {
        if (json.error || !json.historical) return;
        const hist = json.historical as Record<
          string,
          { date: string; close: number }[]
        >;
        const real: Record<string, number[]> = {};
        for (const t of tickers) {
          if (hist[t]?.length >= 5) {
            real[t] = hist[t].map((b) => b.close);
          } else {
            real[t] = demo[t];
          }
        }
        setSparklines(real);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.map((p) => p.ticker).join(",")]);

  if (!positions.length) {
    return (
      <div
        className="p-6 text-center text-sm"
        style={{
          border: "1px solid var(--border)",
          color: "var(--fg-muted)",
        }}
      >
        No open positions
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--border)" }}>
      <div
        className="px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <h3
          className="text-xs uppercase tracking-wider font-medium"
          style={{ color: "var(--fg-muted)" }}
        >
          Open Positions
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-[10px] uppercase tracking-wider"
              style={{
                borderBottom: "1px solid var(--border)",
                color: "var(--fg-muted)",
              }}
            >
              <th className="text-left px-4 py-3 font-medium">Ticker</th>
              <th className="text-center px-2 py-3 font-medium">30D</th>
              <th className="text-right px-4 py-3 font-medium">Qty</th>
              <th className="text-right px-4 py-3 font-medium">Avg Entry</th>
              <th className="text-right px-4 py-3 font-medium">Current</th>
              <th className="text-right px-4 py-3 font-medium">
                Market Value
              </th>
              <th className="text-right px-4 py-3 font-medium">P&L</th>
              <th className="text-right px-4 py-3 font-medium">P&L %</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => (
              <tr
                key={pos.ticker}
                className="transition-colors"
                style={{ borderBottom: "1px solid var(--border)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <td
                  className="px-4 py-3 font-mono font-semibold"
                  style={{ color: "var(--fg)" }}
                >
                  {pos.ticker}
                  <span
                    className="ml-2 text-xs uppercase"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    {pos.side}
                  </span>
                </td>
                <td className="px-2 py-3 text-center">
                  {sparklines[pos.ticker] && (
                    <Sparkline data={sparklines[pos.ticker]} />
                  )}
                </td>
                <td
                  className="px-4 py-3 text-right font-mono"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  {pos.qty}
                </td>
                <td
                  className="px-4 py-3 text-right font-mono"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  ${pos.avg_entry_price.toFixed(2)}
                </td>
                <td
                  className="px-4 py-3 text-right font-mono"
                  style={{ color: "var(--fg)" }}
                >
                  ${pos.current_price.toFixed(2)}
                </td>
                <td
                  className="px-4 py-3 text-right font-mono"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  ${pos.market_value.toLocaleString()}
                </td>
                <td
                  className="px-4 py-3 text-right font-mono"
                  style={{
                    color:
                      pos.unrealized_pnl >= 0
                        ? "var(--green)"
                        : "var(--red)",
                  }}
                >
                  {pos.unrealized_pnl >= 0 ? "+" : ""}$
                  {pos.unrealized_pnl.toFixed(2)}
                </td>
                <td
                  className="px-4 py-3 text-right font-mono"
                  style={{
                    color:
                      pos.unrealized_pnl_pct >= 0
                        ? "var(--green)"
                        : "var(--red)",
                  }}
                >
                  {pos.unrealized_pnl_pct >= 0 ? "+" : ""}
                  {(pos.unrealized_pnl_pct * 100).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
