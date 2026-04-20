"use client";

import { useEffect, useState } from "react";
import type { Position } from "@/lib/types";

interface CorrelationData {
  tickers: string[];
  matrix: number[][];
}

function computeCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;
  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0,
    denA = 0,
    denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

function dailyReturns(closes: number[]): number[] {
  const ret: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    ret.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return ret;
}

function corrColor(val: number): string {
  const abs = Math.abs(val);
  if (abs < 0.3) return "transparent";
  if (val > 0) {
    const a = Math.min((abs - 0.3) / 0.7, 1) * 0.5;
    return `rgba(34, 197, 94, ${a})`;
  }
  const a = Math.min((abs - 0.3) / 0.7, 1) * 0.5;
  return `rgba(239, 68, 68, ${a})`;
}

// Deterministic seeded random to avoid hydration mismatch
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Demo correlation based on sector similarity
function demoMatrix(tickers: string[]): CorrelationData {
  const sectorMap: Record<string, string> = {
    NVDA: "tech", AAPL: "tech", MSFT: "tech", GOOGL: "tech", META: "tech",
    JPM: "fin", GS: "fin", BAC: "fin", V: "fin",
    XOM: "energy", CVX: "energy",
    UNH: "health", JNJ: "health",
  };
  let seed = 42;
  for (const t of tickers) for (const c of t) seed += c.charCodeAt(0);
  const rand = seededRandom(seed);
  const matrix: number[][] = [];
  for (let i = 0; i < tickers.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < tickers.length; j++) {
      if (i === j) {
        row.push(1);
      } else {
        const same = sectorMap[tickers[i]] === sectorMap[tickers[j]] && sectorMap[tickers[i]];
        row.push(same ? 0.6 + rand() * 0.25 : -0.1 + rand() * 0.4);
      }
    }
    matrix.push(row);
  }
  // Make symmetric
  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      matrix[j][i] = matrix[i][j];
    }
  }
  return { tickers, matrix };
}

export default function CorrelationMatrix({
  positions,
}: {
  positions: Position[];
}) {
  const tickers = positions.map((p) => p.ticker);
  const [data, setData] = useState<CorrelationData>(() =>
    demoMatrix(tickers)
  );

  useEffect(() => {
    if (!tickers.length) return;

    fetch(
      `/api/market?action=historical&tickers=${tickers.join(",")}&days=90`
    )
      .then((r) => r.json())
      .then((json) => {
        if (json.error || !json.historical) return;

        const hist = json.historical as Record<
          string,
          { date: string; close: number }[]
        >;
        const returns: Record<string, number[]> = {};
        for (const t of tickers) {
          if (hist[t]?.length > 5) {
            returns[t] = dailyReturns(hist[t].map((b) => b.close));
          }
        }

        const validTickers = tickers.filter((t) => returns[t]);
        if (validTickers.length < 2) return;

        const matrix: number[][] = [];
        for (const a of validTickers) {
          const row: number[] = [];
          for (const b of validTickers) {
            row.push(
              a === b ? 1 : computeCorrelation(returns[a], returns[b])
            );
          }
          matrix.push(row);
        }

        setData({ tickers: validTickers, matrix });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers.join(",")]);

  if (!data.tickers.length) return null;

  return (
    <div className="p-4 h-full flex flex-col">
      <h3
        className="text-[10px] uppercase tracking-wider font-medium mb-3"
        style={{ color: "var(--fg-muted)" }}
      >
        Correlation Matrix
      </h3>
      <div className="flex-1 overflow-auto">
        <table className="text-[10px] font-mono">
          <thead>
            <tr>
              <th />
              {data.tickers.map((t) => (
                <th
                  key={t}
                  className="px-1.5 py-1 text-center font-medium"
                  style={{ color: "var(--fg-muted)" }}
                >
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.tickers.map((t, i) => (
              <tr key={t}>
                <td
                  className="pr-2 py-1 font-medium text-right"
                  style={{ color: "var(--fg-muted)" }}
                >
                  {t}
                </td>
                {data.matrix[i].map((val, j) => (
                  <td
                    key={j}
                    className="px-1.5 py-1 text-center"
                    style={{
                      background: corrColor(val),
                      color:
                        i === j ? "var(--fg-muted)" : "var(--fg-secondary)",
                    }}
                  >
                    {val.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
