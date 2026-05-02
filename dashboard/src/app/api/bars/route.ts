/**
 * GET /api/bars?symbol=NVDA&range=3mo&interval=1d&limit=90
 *
 * OHLCV bars from Yahoo Finance.
 * `range`    — Yahoo range string: 1d | 5d | 1mo | 3mo | 6mo | 1y | 2y | 5y
 * `interval` — Yahoo interval: 1m | 5m | 15m | 30m | 1h | 1d | 1wk | 1mo
 * `limit`    — max bars returned (default 90, only applied to daily+ intervals)
 *
 * Intraday intervals (1m–1h) are only available for recent data:
 *   1m  → last 7 days max
 *   5m/15m/30m → last 60 days max
 *   1h  → last 730 days max
 */
import { NextRequest, NextResponse } from "next/server";
import { getChart } from "@/lib/yahoo";

// Intraday cache is short; daily bars can be cached longer
export const dynamic = "force-dynamic";

const RANGE_FROM_LIMIT: Record<number, string> = {
  1: "1d",
  5: "5d",
  30: "1mo",
  90: "3mo",
  180: "6mo",
  365: "1y",
  730: "2y",
};

function rangeFromLimit(limit: number): string {
  const keys = Object.keys(RANGE_FROM_LIMIT).map(Number).sort((a, b) => a - b);
  for (const k of keys) {
    if (limit <= k) return RANGE_FROM_LIMIT[k];
  }
  return "2y";
}

// Map workbench timeframe label → Yahoo range + interval
const TF_MAP: Record<string, { range: string; interval: string }> = {
  "1D":  { range: "1d",  interval: "5m"  },
  "1W":  { range: "5d",  interval: "15m" },
  "1M":  { range: "1mo", interval: "1d"  },
  "3M":  { range: "3mo", interval: "1d"  },
  "1Y":  { range: "1y",  interval: "1d"  },
  "5Y":  { range: "5y",  interval: "1wk" },
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase();
  const tf = searchParams.get("tf") ?? "";          // workbench shorthand: "1D","1W",etc.
  const limit = parseInt(searchParams.get("limit") ?? "90");

  // Explicit range/interval override any tf shorthand
  let range = searchParams.get("range") ?? "";
  let interval = searchParams.get("interval") ?? "1d";

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  // Resolve tf shorthand
  if (tf && TF_MAP[tf]) {
    range = range || TF_MAP[tf].range;
    interval = searchParams.get("interval") ?? TF_MAP[tf].interval;
  }

  if (!range) range = rangeFromLimit(limit);

  const bars = await getChart(symbol, range, interval);
  if (!bars.length) {
    return NextResponse.json({ bars: [], source: "error" });
  }

  // For daily+, respect the limit; intraday returns everything in the range
  const isIntraday = ["1m", "5m", "15m", "30m", "1h"].includes(interval);
  const sliced = isIntraday ? bars : bars.slice(-limit);

  return NextResponse.json({
    bars: sliced.map((b) => ({
      date: isIntraday
        ? new Date(b.timestamp * 1000).toISOString()
        : new Date(b.timestamp * 1000).toISOString().split("T")[0],
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    })),
    range,
    interval,
    source: "yahoo",
  });
}
