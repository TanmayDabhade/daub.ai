/**
 * GET /api/bars?symbol=NVDA&timeframe=1Day&limit=90
 *
 * Returns OHLCV bars from Alpaca.
 * Falls back to Yahoo Finance chart data if Alpaca not configured.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBars, isConfigured as alpacaReady } from "@/lib/alpaca";
import { getChart } from "@/lib/yahoo";

export const revalidate = 300; // 5-minute cache

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase();
  const timeframe = searchParams.get("timeframe") ?? "1Day";
  const limit = parseInt(searchParams.get("limit") ?? "90");

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  // ── Alpaca ────────────────────────────────────────────────────────────
  if (alpacaReady()) {
    const bars = await getBars(symbol, { timeframe, limit });
    if (bars.length) {
      return NextResponse.json({
        bars: bars.map((b) => ({
          date: b.t.split("T")[0],
          open: b.o,
          high: b.h,
          low: b.l,
          close: b.c,
          volume: b.v,
          vwap: b.vw,
        })),
        source: "alpaca",
      });
    }
  }

  // ── Yahoo Finance fallback ─────────────────────────────────────────────
  const range = limit <= 30 ? "1mo" : limit <= 90 ? "3mo" : limit <= 180 ? "6mo" : "1y";
  const bars = await getChart(symbol, range, "1d");
  if (bars.length) {
    return NextResponse.json({
      bars: bars.slice(-limit).map((b) => ({
        date: new Date(b.timestamp * 1000).toISOString().split("T")[0],
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
      })),
      source: "yahoo",
    });
  }

  return NextResponse.json({ bars: [], source: "error" });
}
