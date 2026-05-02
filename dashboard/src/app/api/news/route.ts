/**
 * GET /api/news?symbols=NVDA,AAPL&limit=20
 *
 * News from Polygon (primary, requires POLYGON_API_KEY) → Yahoo Finance RSS fallback.
 */
import { NextRequest, NextResponse } from "next/server";

export const revalidate = 300;

const POLYGON_KEY = process.env.POLYGON_API_KEY ?? "";

async function fetchPolygon(symbols: string[], limit: number) {
  if (!POLYGON_KEY) return null;
  const tickerParam = symbols.length ? `&ticker=${symbols[0]}` : "";
  const url = `https://api.polygon.io/v2/reference/news?limit=${limit}&sort=published_utc&order=desc&apiKey=${POLYGON_KEY}${tickerParam}`;
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results?.length) return null;
    return data.results.map((a: {
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
    }));
  } catch { return null; }
}

async function fetchYahooRss(symbols: string[], limit: number) {
  const tickers = symbols.length ? symbols : ["SPY", "AAPL", "NVDA", "TSLA", "META"];
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${tickers.join(",")}&region=US&lang=en-US`;
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: { title: string; author: string; published: string; url: string; tickers: string[]; snippet: string; source: string }[] = [];
    const matches = xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g);
    for (const m of matches) {
      if (items.length >= limit) break;
      const block = m[1];
      const get = (tag: string) => {
        const mm = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
        if (!mm) return "";
        return mm[1]
          .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
      };
      const title = get("title");
      const link = get("link");
      if (!title || !link) continue;
      const tickerMatches = title.matchAll(/\b([A-Z]{2,5})\b/g);
      const foundTickers = [...tickerMatches].map((t) => t[1]).filter((t) => tickers.includes(t));
      items.push({
        title,
        author: "Yahoo Finance",
        published: get("pubDate"),
        url: link,
        tickers: foundTickers,
        snippet: get("description").replace(/<[^>]+>/g, "").substring(0, 200),
        source: "yahoo",
      });
    }
    return items;
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const symbols = (req.nextUrl.searchParams.get("symbols") ?? "")
    .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20");

  const polygon = await fetchPolygon(symbols, limit);
  if (polygon) return NextResponse.json({ articles: polygon, source: "polygon" });

  const yahoo = await fetchYahooRss(symbols, limit);
  return NextResponse.json({ articles: yahoo, source: "yahoo" });
}
