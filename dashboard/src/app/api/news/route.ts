/**
 * GET /api/news?symbols=NVDA,AAPL&limit=20
 *
 * Returns news from Alpaca (primary) → Polygon (fallback) → demo.
 */
import { NextRequest, NextResponse } from "next/server";
import { getNews, isConfigured as alpacaReady } from "@/lib/alpaca";

export const revalidate = 300;

const POLYGON_KEY = process.env.POLYGON_API_KEY ?? "";

export async function GET(req: NextRequest) {
  const symbols = (req.nextUrl.searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20");

  // ── Alpaca news ───────────────────────────────────────────────────────
  if (alpacaReady()) {
    const items = await getNews(symbols.length ? symbols : ["AAPL", "NVDA", "TSLA", "META", "MSFT"], limit);
    if (items.length) {
      return NextResponse.json({
        articles: items.map((n) => ({
          title: n.headline,
          author: n.author,
          published: n.created_at,
          url: n.url,
          tickers: n.symbols,
          snippet: n.summary?.substring(0, 200) ?? "",
          source: n.source,
        })),
        source: "alpaca",
      });
    }
  }

  // ── Polygon fallback ──────────────────────────────────────────────────
  if (POLYGON_KEY) {
    const tickerParam = symbols.length ? `&ticker=${symbols[0]}` : "";
    const url = `https://api.polygon.io/v2/reference/news?limit=${limit}&sort=published_utc&order=desc&apiKey=${POLYGON_KEY}${tickerParam}`;
    try {
      const res = await fetch(url, { next: { revalidate: 300 } });
      const data = await res.json();
      if (data.results?.length) {
        return NextResponse.json({
          articles: data.results.map((a: {
            title?: string; author?: string; published_utc?: string;
            article_url?: string; tickers?: string[]; description?: string;
            publisher?: { name?: string };
          }) => ({
            title: a.title,
            author: a.author ?? a.publisher?.name,
            published: a.published_utc,
            url: a.article_url,
            tickers: a.tickers ?? [],
            snippet: a.description?.substring(0, 200) ?? "",
            source: "polygon",
          })),
          source: "polygon",
        });
      }
    } catch { /* fall through */ }
  }

  return NextResponse.json({ articles: [], source: "none" });
}
