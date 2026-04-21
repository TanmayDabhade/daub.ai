/**
 * GET /api/orderbook?symbol=NVDA
 *
 * Returns latest bid/ask + recent trades from Alpaca.
 * On free IEX feed we get the top-of-book (NBBO-equivalent).
 * Alpaca Unlimited subscription unlocks full Level 2 depth.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getLatestQuote,
  isConfigured as alpacaReady,
  ALPACA_DATA_URL,
} from "@/lib/alpaca";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") ?? "").toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  if (!alpacaReady()) {
    return NextResponse.json({ error: "Alpaca not configured" }, { status: 503 });
  }

  // Latest NBBO quote
  const quote = await getLatestQuote(symbol);

  // Recent trades (last 10)
  let recentTrades: { t: string; p: number; s: number }[] = [];
  try {
    const headers = {
      "APCA-API-KEY-ID": process.env.ALPACA_API_KEY ?? "",
      "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET_KEY ?? "",
    };
    const url = `${ALPACA_DATA_URL}/v2/stocks/${symbol}/trades/latest?feed=${process.env.ALPACA_FEED ?? "iex"}`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json.trade) recentTrades = [json.trade];
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    symbol,
    quote,
    recentTrades,
    level2Note: "Full Level 2 depth requires Alpaca Unlimited subscription",
  });
}
