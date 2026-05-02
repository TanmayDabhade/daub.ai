/**
 * GET /api/quotes?symbols=AAPL,NVDA,...
 *
 * Live quotes from Yahoo Finance (no API key required).
 * Returns price, change, bid/ask estimate, volume, fundamentals.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBulkQuotes } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbols = (req.nextUrl.searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (!symbols.length) {
    return NextResponse.json({ error: "symbols required" }, { status: 400 });
  }

  const yf = await getBulkQuotes(symbols);
  if (!yf.length) {
    return NextResponse.json({ quotes: {}, source: "error" });
  }

  const quotes: Record<string, unknown> = {};
  for (const q of yf) {
    const prevClose = q.regularMarketPrice / (1 + q.regularMarketChangePercent / 100);
    const change = q.regularMarketPrice - prevClose;
    // Estimate bid/ask from beta-based half-spread (same logic as orderbook route)
    const beta = Math.abs(q.beta ?? 1.0);
    const spreadPct = 0.0001 + 0.0004 * beta;
    const halfSpread = q.regularMarketPrice * spreadPct;
    quotes[q.symbol] = {
      symbol: q.symbol,
      price: q.regularMarketPrice,
      bid: parseFloat((q.regularMarketPrice - halfSpread).toFixed(2)),
      ask: parseFloat((q.regularMarketPrice + halfSpread).toFixed(2)),
      change,
      changePct: q.regularMarketChangePercent,
      volume: q.regularMarketVolume,
      avgVolume: q.averageDailyVolume10Day,
      marketCap: q.marketCap,
      pe: q.trailingPE,
      fwdPE: q.forwardPE,
      beta: q.beta,
      week52High: q.fiftyTwoWeekHigh,
      week52Low: q.fiftyTwoWeekLow,
      fiftyDayAvg: q.fiftyDayAverage,
      twoHundredDayAvg: q.twoHundredDayAverage,
      name: q.longName || q.shortName,
      sector: q.sector,
    };
  }

  return NextResponse.json({ quotes, source: "yahoo" });
}
