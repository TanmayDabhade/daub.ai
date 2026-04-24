import { fetchQuotes } from "../../lib/market";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbols = (url.searchParams.get("symbols") ?? "SPY")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  try {
    const quotes = await fetchQuotes(symbols);
    return Response.json({ quotes, fetchedAt: Date.now() });
  } catch (e) {
    return Response.json(
      { quotes: [], error: (e as Error).message },
      { status: 502 },
    );
  }
}
