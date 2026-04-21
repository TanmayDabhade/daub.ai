/**
 * GET /api/quotes?symbols=AAPL,NVDA,...
 *
 * Returns live snapshots from Alpaca (free IEX feed).
 * Falls back to Yahoo Finance if Alpaca is not configured.
 * Response: { quotes: Record<symbol, QuoteData>, source: "alpaca"|"yahoo"|"error" }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSnapshots, isConfigured as alpacaReady } from "@/lib/alpaca";
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

  // ── Alpaca path ──────────────────────────────────────────────────────
  if (alpacaReady()) {
    const snaps = await getSnapshots(symbols);
    if (Object.keys(snaps).length > 0) {
      const quotes: Record<string, {
        symbol: string; price: number; bid: number; ask: number;
        bidSize: number; askSize: number; change: number; changePct: number;
        volume: number; prevClose: number;
      }> = {};
      for (const [sym, snap] of Object.entries(snaps)) {
        const prevClose = snap.prevDailyBar?.c ?? snap.dailyBar?.o ?? snap.latestTrade.p;
        const price = snap.latestTrade.p;
        const change = price - prevClose;
        quotes[sym] = {
          symbol: sym,
          price,
          bid: snap.latestQuote.bp,
          ask: snap.latestQuote.ap,
          bidSize: snap.latestQuote.bs,
          askSize: snap.latestQuote.as,
          change,
          changePct: prevClose ? (change / prevClose) * 100 : 0,
          volume: snap.dailyBar?.v ?? 0,
          prevClose,
        };
      }
      return NextResponse.json({ quotes, source: "alpaca" });
    }
  }

  // ── Yahoo Finance fallback ───────────────────────────────────────────
  const yf = await getBulkQuotes(symbols);
  if (yf.length) {
    const quotes: Record<string, unknown> = {};
    for (const q of yf) {
      quotes[q.symbol] = {
        symbol: q.symbol,
        price: q.regularMarketPrice,
        bid: q.regularMarketPrice * 0.9999, // YF doesn't give realtime bid/ask
        ask: q.regularMarketPrice * 1.0001,
        bidSize: 0,
        askSize: 0,
        change: (q.regularMarketChangePercent / 100) * q.regularMarketPrice,
        changePct: q.regularMarketChangePercent,
        volume: q.regularMarketVolume,
        prevClose: q.regularMarketPrice / (1 + q.regularMarketChangePercent / 100),
      };
    }
    return NextResponse.json({ quotes, source: "yahoo" });
  }

  return NextResponse.json({ quotes: {}, source: "error" });
}
