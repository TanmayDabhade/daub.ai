import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const UA = "Mozilla/5.0";

type CacheEntry = { at: number; body: string };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 120_000;
const STALE_MS = 10 * 60_000;

async function httpGet(url: string, ttlMs = TTL_MS): Promise<string> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.body;
  // Yahoo's edge blocks Node's fetch (HTTP/2 fingerprint). Shell curl works.
  const { stdout } = await execFileAsync(
    "curl",
    [
      "-sSL",
      "--compressed",
      "--max-time",
      "15",
      "-A",
      UA,
      url,
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  if (/Too Many Requests|rate limit/i.test(stdout) && stdout.length < 200) {
    if (hit && Date.now() - hit.at < STALE_MS) return hit.body;
    throw new Error("rate-limited: " + stdout.trim().slice(0, 80));
  }
  cache.set(url, { at: Date.now(), body: stdout });
  return stdout;
}

export type Quote = {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePct: number;
  currency: string;
  marketState: string;
  regularMarketTime: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  exchange: string;
  longName?: string;
  shortName?: string;
};

export type ChartSeries = {
  symbol: string;
  timestamps: number[];
  closes: number[];
  meta: Quote;
};

export async function fetchChart(
  symbol: string,
  range = "3mo",
  interval = "1d",
): Promise<ChartSeries> {
  const hosts = [
    "https://query1.finance.yahoo.com",
    "https://query2.finance.yahoo.com",
  ];
  type YahooResult = {
    meta: Record<string, any>;
    timestamp?: number[];
    indicators?: { quote?: Array<{ close?: Array<number | null> }> };
  };
  let json: {
    chart?: { result?: YahooResult[]; error?: unknown };
  } | null = null;
  let lastErr = "";
  for (let attempt = 0; attempt < 3 && !json; attempt++) {
    const host = hosts[attempt % hosts.length];
    const url = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
    try {
      const body = await httpGet(url);
      json = JSON.parse(body);
    } catch (e) {
      lastErr = (e as Error).message;
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
    }
  }
  if (!json) throw new Error(lastErr || `yahoo chart ${symbol} failed`);
  const r = json?.chart?.result?.[0];
  if (!r) throw new Error(`yahoo chart ${symbol} empty`);
  const m = r.meta;
  const closes: Array<number | null> = r.indicators?.quote?.[0]?.close ?? [];
  const timestamps: number[] = r.timestamp ?? [];
  const price = m.regularMarketPrice;
  const prev = m.chartPreviousClose ?? m.previousClose ?? price;
  const change = price - prev;
  const changePct = prev ? (change / prev) * 100 : 0;
  const cleanClose: number[] = [];
  const cleanTs: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const c = closes[i];
    if (c != null) {
      cleanClose.push(c);
      cleanTs.push(timestamps[i]);
    }
  }
  const meta: Quote = {
    symbol: m.symbol,
    price,
    previousClose: prev,
    change,
    changePct,
    currency: m.currency,
    marketState: m.marketState ?? "",
    regularMarketTime: m.regularMarketTime,
    fiftyTwoWeekHigh: m.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: m.fiftyTwoWeekLow,
    dayHigh: m.regularMarketDayHigh,
    dayLow: m.regularMarketDayLow,
    volume: m.regularMarketVolume,
    exchange: m.fullExchangeName ?? m.exchangeName ?? "",
    longName: m.longName,
    shortName: m.shortName,
  };
  return { symbol, timestamps: cleanTs, closes: cleanClose, meta };
}

async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (x: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  const results = await pool(symbols, 2, (s) =>
    fetchChart(s, "5d", "1d")
      .then((c) => c.meta)
      .catch(() => null as Quote | null),
  );
  return results.filter((q): q is Quote => !!q);
}

export type NewsItem = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source?: string;
};

function decodeEntities(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function parseRss(xml: string, sourceLabel?: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemMatches = xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g);
  for (const m of itemMatches) {
    const block = m[1];
    const get = (tag: string) => {
      const mm = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return mm ? decodeEntities(mm[1]).trim() : "";
    };
    const title = get("title");
    const link = get("link");
    if (!title || !link) continue;
    items.push({
      title,
      link,
      pubDate: get("pubDate"),
      description: get("description").replace(/<[^>]+>/g, "").trim(),
      source: sourceLabel,
    });
  }
  return items;
}

export async function fetchYahooNews(tickers: string[]): Promise<NewsItem[]> {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${tickers.join(
    ",",
  )}&region=US&lang=en-US`;
  const xml = await httpGet(url);
  return parseRss(xml, "Yahoo Finance");
}

const AGENT_TAG_POOL = [
  "FILINGS",
  "SENTIMENT",
  "EARNINGS",
  "MACRO",
  "AGGREGATOR",
] as const;

export function tagItem(item: NewsItem, index: number) {
  const t = (item.title + " " + item.description).toLowerCase();
  let ag: (typeof AGENT_TAG_POOL)[number];
  if (/(10-?q|10-?k|8-?k|filing|sec\b|edgar)/.test(t)) ag = "FILINGS";
  else if (/(earnings|revenue|guidance|beat|miss|eps|quarter)/.test(t))
    ag = "EARNINGS";
  else if (/(fed|yield|rate|inflation|cpi|jobs|gdp|macro|oil|dollar)/.test(t))
    ag = "MACRO";
  else if (/(upgrade|buy|accumulate|bull)/.test(t)) ag = "AGGREGATOR";
  else ag = index % 2 ? "SENTIMENT" : AGENT_TAG_POOL[index % AGENT_TAG_POOL.length];
  let sig: "+" | "-" | "~" = "~";
  if (/(beat|surge|rally|gain|upgrade|raise|record|jump|soar)/.test(t)) sig = "+";
  else if (
    /(miss|fall|drop|plunge|cut|downgrade|probe|lawsuit|slump|warn)/.test(t)
  )
    sig = "-";
  const tickerMatch = item.title.match(/\b[A-Z]{2,5}\b/);
  const tk = tickerMatch ? tickerMatch[0] : "*";
  return { ag, sig, tk };
}
