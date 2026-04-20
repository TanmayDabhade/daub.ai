import { NextRequest, NextResponse } from "next/server";

const POLYGON_KEY = process.env.POLYGON_API_KEY ?? "";
const BASE = "https://api.polygon.io";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const action = searchParams.get("action");

  if (!POLYGON_KEY) {
    return NextResponse.json(
      { error: "Polygon API key not configured" },
      { status: 503 }
    );
  }

  try {
    switch (action) {
      case "news":
        return await fetchNews(searchParams);
      case "historical":
        return await fetchHistorical(searchParams);
      default:
        return NextResponse.json(
          { error: "Unknown action. Use: news, historical" },
          { status: 400 }
        );
    }
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

async function fetchNews(params: URLSearchParams) {
  const tickers = params.get("tickers") ?? "";
  const limit = params.get("limit") ?? "10";

  let url = `${BASE}/v2/reference/news?limit=${limit}&sort=published_utc&order=desc&apiKey=${POLYGON_KEY}`;
  if (tickers) {
    url += `&ticker=${tickers}`;
  }

  const res = await fetch(url, { next: { revalidate: 300 } });
  const data = await res.json();

  if (data.status === "ERROR" || data.error) {
    return NextResponse.json(
      { error: data.error ?? data.message ?? "Polygon API error" },
      { status: 502 }
    );
  }

  const articles = (data.results ?? []).map(
    (a: {
      title?: string;
      author?: string;
      published_utc?: string;
      article_url?: string;
      tickers?: string[];
      description?: string;
    }) => ({
      title: a.title,
      author: a.author,
      published: a.published_utc,
      url: a.article_url,
      tickers: a.tickers ?? [],
      snippet: a.description?.substring(0, 200) ?? "",
    })
  );

  return NextResponse.json({ articles });
}

async function fetchHistorical(params: URLSearchParams) {
  const tickers = (params.get("tickers") ?? "").split(",").filter(Boolean);
  const days = parseInt(params.get("days") ?? "90");

  if (!tickers.length) {
    return NextResponse.json({ error: "tickers required" }, { status: 400 });
  }

  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - days * 86400000)
    .toISOString()
    .split("T")[0];

  const results: Record<string, { date: string; close: number }[]> = {};

  // Fetch in series to respect rate limits (5/min on free tier)
  for (const ticker of tickers.slice(0, 10)) {
    const url = `${BASE}/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&apiKey=${POLYGON_KEY}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const data = await res.json();

    results[ticker] = (data.results ?? []).map(
      (bar: { t: number; c: number }) => ({
        date: new Date(bar.t).toISOString().split("T")[0],
        close: bar.c,
      })
    );
  }

  return NextResponse.json({ historical: results });
}
