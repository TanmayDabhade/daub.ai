/**
 * GET /api/orderbook?symbol=NVDA
 *
 * Returns a synthetic order-book built from a live Yahoo Finance quote.
 * No real L2 feed is available without a paid Polygon/Alpaca subscription;
 * this generates a realistic-looking bid/ask ladder labelled "indicative".
 *
 * Spread is estimated from beta (higher beta → wider spread) and price level.
 * Sizes are proportional to average daily volume with randomised noise seeded
 * from the symbol so they're stable across calls.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBulkQuotes } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

const LEVELS = 10; // depth levels each side

function seededRand(seed: number) {
  // simple LCG for deterministic-but-varied sizes
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function symbolSeed(sym: string): number {
  return sym.split("").reduce((acc, c) => acc * 31 + c.charCodeAt(0), 1);
}

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") ?? "").toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  const quotes = await getBulkQuotes([symbol]);
  const q = quotes[0];
  if (!q) {
    return NextResponse.json({ error: `No quote for ${symbol}` }, { status: 404 });
  }

  const price = q.regularMarketPrice;
  const beta = Math.abs(q.beta ?? 1.0);
  const adv = q.averageDailyVolume10Day ?? 5_000_000;

  // Spread: base 0.01% + 0.04% per unit of beta. Wider for low-price stocks.
  const spreadPct = 0.0001 + 0.0004 * beta + (price < 20 ? 0.0005 : 0);
  const halfSpread = price * spreadPct;

  const rand = seededRand(symbolSeed(symbol) ^ Math.floor(Date.now() / 30000));
  // Refresh seed every 30 s so the book "moves" without a websocket

  // Typical order size at top of book ≈ 0.03% of ADV
  const baseSize = Math.max(100, Math.round(adv * 0.0003));

  type Level = { price: number; size: number; total: number };

  const asks: Level[] = [];
  const bids: Level[] = [];
  let askTotal = 0;
  let bidTotal = 0;

  for (let i = 0; i < LEVELS; i++) {
    // Price increments widen slightly as we go deeper
    const tick = price < 5 ? 0.01 : price < 50 ? 0.05 : price < 200 ? 0.1 : 0.25;
    const askPx = parseFloat((price + halfSpread + i * tick * (1 + i * 0.15)).toFixed(2));
    const bidPx = parseFloat((price - halfSpread - i * tick * (1 + i * 0.15)).toFixed(2));

    // Sizes decrease with depth, with noise
    const sizeMultiplier = 1 / (1 + i * 0.4);
    const askSize = Math.round(baseSize * sizeMultiplier * (0.6 + rand() * 0.8));
    const bidSize = Math.round(baseSize * sizeMultiplier * (0.6 + rand() * 0.8));

    askTotal += askSize;
    bidTotal += bidSize;

    asks.push({ price: askPx, size: askSize, total: askTotal });
    bids.push({ price: bidPx, size: bidSize, total: bidTotal });
  }

  return NextResponse.json({
    symbol,
    indicative: true, // label it clearly — not real L2
    timestamp: Date.now(),
    quote: {
      price,
      bid: parseFloat((price - halfSpread).toFixed(2)),
      ask: parseFloat((price + halfSpread).toFixed(2)),
      spread: parseFloat((halfSpread * 2).toFixed(2)),
      spread_pct: parseFloat((spreadPct * 2 * 100).toFixed(4)),
      change_pct: q.regularMarketChangePercent,
      volume: q.regularMarketVolume,
      avg_volume: adv,
    },
    asks, // sorted cheapest first
    bids, // sorted highest first
  });
}
