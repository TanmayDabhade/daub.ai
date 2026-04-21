/**
 * Alpaca Markets REST client helpers.
 * Reads ALPACA_API_KEY, ALPACA_SECRET_KEY from process.env.
 * Use ALPACA_FEED=iex (free) or sip (paid real-time, default iex).
 */

export const ALPACA_DATA_URL =
  process.env.ALPACA_DATA_URL ?? "https://data.alpaca.markets";
export const ALPACA_TRADING_URL =
  process.env.ALPACA_TRADING_URL ?? "https://paper-api.alpaca.markets";

function alpacaHeaders() {
  return {
    "APCA-API-KEY-ID": process.env.ALPACA_API_KEY ?? "",
    "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET_KEY ?? "",
    Accept: "application/json",
  };
}

export function isConfigured() {
  return !!(process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY);
}

const FEED = process.env.ALPACA_FEED ?? "iex"; // iex = free tier

// ── Snapshots (latest quote + daily bar + prev close) ─────────────────────
export interface AlpacaSnapshot {
  symbol: string;
  latestTrade: { p: number; s: number; t: string };
  latestQuote: { ap: number; as: number; bp: number; bs: number; t: string };
  minuteBar: { o: number; h: number; l: number; c: number; v: number; t: string };
  dailyBar: { o: number; h: number; l: number; c: number; v: number; t: string };
  prevDailyBar: { o: number; h: number; l: number; c: number; v: number; t: string };
}

export async function getSnapshots(
  symbols: string[]
): Promise<Record<string, AlpacaSnapshot>> {
  if (!isConfigured()) return {};
  const url = `${ALPACA_DATA_URL}/v2/stocks/snapshots?symbols=${symbols.join(",")}&feed=${FEED}`;
  const res = await fetch(url, {
    headers: alpacaHeaders(),
    next: { revalidate: 15 },
  });
  if (!res.ok) return {};
  return res.json();
}

// ── Latest quote (bid/ask orderbook-lite) ─────────────────────────────────
export interface AlpacaQuote {
  t: string; // timestamp
  ax: string; // ask exchange
  ap: number; // ask price
  as: number; // ask size
  bx: string; // bid exchange
  bp: number; // bid price
  bs: number; // bid size
  c: string[]; // conditions
}

export async function getLatestQuote(
  symbol: string
): Promise<AlpacaQuote | null> {
  if (!isConfigured()) return null;
  const url = `${ALPACA_DATA_URL}/v2/stocks/${symbol}/quotes/latest?feed=${FEED}`;
  const res = await fetch(url, { headers: alpacaHeaders(), next: { revalidate: 5 } });
  if (!res.ok) return null;
  const json = await res.json();
  return json.quote ?? null;
}

// ── Historical bars ───────────────────────────────────────────────────────
export interface AlpacaBar {
  t: string; // timestamp ISO
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  n: number; // num trades
  vw: number; // vwap
}

export async function getBars(
  symbol: string,
  {
    timeframe = "1Day",
    start,
    end,
    limit = 90,
  }: { timeframe?: string; start?: string; end?: string; limit?: number } = {}
): Promise<AlpacaBar[]> {
  if (!isConfigured()) return [];
  const endDate = end ?? new Date().toISOString().split("T")[0];
  const startDate =
    start ??
    new Date(Date.now() - limit * 86400000).toISOString().split("T")[0];

  const url = new URL(`${ALPACA_DATA_URL}/v2/stocks/${symbol}/bars`);
  url.searchParams.set("timeframe", timeframe);
  url.searchParams.set("start", startDate);
  url.searchParams.set("end", endDate);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("feed", FEED);
  url.searchParams.set("sort", "asc");

  const res = await fetch(url.toString(), {
    headers: alpacaHeaders(),
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.bars ?? [];
}

// ── Multi-symbol bars ─────────────────────────────────────────────────────
export async function getMultiBars(
  symbols: string[],
  {
    timeframe = "1Day",
    limit = 60,
  }: { timeframe?: string; limit?: number } = {}
): Promise<Record<string, AlpacaBar[]>> {
  if (!isConfigured()) return {};
  const start = new Date(Date.now() - limit * 86400000)
    .toISOString()
    .split("T")[0];
  const url = `${ALPACA_DATA_URL}/v2/stocks/bars?symbols=${symbols.join(",")}&timeframe=${timeframe}&start=${start}&limit=${limit}&feed=${FEED}&sort=asc`;
  const res = await fetch(url, { headers: alpacaHeaders(), next: { revalidate: 300 } });
  if (!res.ok) return {};
  const json = await res.json();
  return json.bars ?? {};
}

// ── News ──────────────────────────────────────────────────────────────────
export interface AlpacaNewsItem {
  id: number;
  headline: string;
  summary: string;
  author: string;
  created_at: string;
  updated_at: string;
  url: string;
  images: { size: string; url: string }[];
  symbols: string[];
  source: string;
}

export async function getNews(
  symbols: string[],
  limit = 20
): Promise<AlpacaNewsItem[]> {
  if (!isConfigured()) return [];
  const url = `${ALPACA_DATA_URL}/v1beta1/news?symbols=${symbols.join(",")}&limit=${limit}&sort=desc`;
  const res = await fetch(url, { headers: alpacaHeaders(), next: { revalidate: 300 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json.news ?? [];
}

// ── Paper trading account ─────────────────────────────────────────────────
export async function getAccount() {
  if (!isConfigured()) return null;
  const res = await fetch(`${ALPACA_TRADING_URL}/v2/account`, {
    headers: alpacaHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getPositions() {
  if (!isConfigured()) return [];
  const res = await fetch(`${ALPACA_TRADING_URL}/v2/positions`, {
    headers: alpacaHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function getOrders(status = "all", limit = 50) {
  if (!isConfigured()) return [];
  const res = await fetch(
    `${ALPACA_TRADING_URL}/v2/orders?status=${status}&limit=${limit}`,
    { headers: alpacaHeaders(), cache: "no-store" }
  );
  if (!res.ok) return [];
  return res.json();
}

export async function submitOrder(order: {
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  time_in_force: "day" | "gtc" | "ioc" | "fok";
  limit_price?: number;
  stop_price?: number;
}) {
  if (!isConfigured()) throw new Error("Alpaca not configured");
  const res = await fetch(`${ALPACA_TRADING_URL}/v2/orders`, {
    method: "POST",
    headers: { ...alpacaHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(order),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Order failed: ${err}`);
  }
  return res.json();
}

// ── Technical indicator helpers ───────────────────────────────────────────
export function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const recent = closes.slice(-period - 1);
  let gains = 0, losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const delta = recent[i] - recent[i - 1];
    if (delta > 0) gains += delta;
    else losses += Math.abs(delta);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return Math.round(100 - 100 / (1 + rs));
}

export function calcSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}
