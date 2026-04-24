import { fetchYahooNews, tagItem } from "../../lib/market";

export const dynamic = "force-dynamic";

const TICKERS = ["SPY", "QQQ", "AAPL", "NVDA", "MSFT", "META", "TSLA", "GOOGL", "AMZN", "JPM"];

export async function GET() {
  try {
    const items = await fetchYahooNews(TICKERS);
    const tagged = items.slice(0, 25).map((it, i) => ({
      ...it,
      ...tagItem(it, i),
    }));
    return Response.json({ items: tagged, fetchedAt: Date.now() });
  } catch (e) {
    return Response.json(
      { items: [], error: (e as Error).message },
      { status: 502 },
    );
  }
}
