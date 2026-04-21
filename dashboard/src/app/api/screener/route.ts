/**
 * GET /api/screener
 *
 * Returns screener data for the default universe using Yahoo Finance (free).
 * Cached for 5 minutes. Enriches with RSI calculated from 30d price history.
 *
 * Query params (all optional filters):
 *   sector=tech|fin|hlth|indu|cons|ener|def
 *   minMktCap, maxMktCap (in billions)
 *   minPE, maxPE
 *   minRSI, maxRSI
 *   maSignal=bullish|bearish|neutral
 *   sortBy=changePct|price|mktCap|pe|rsi (default: changePct)
 *   sortDir=asc|desc (default: desc)
 */
import { NextRequest, NextResponse } from "next/server";
import { getBulkQuotes, getChart, normalizeSector } from "@/lib/yahoo";
import { calcRSI, calcSMA } from "@/lib/alpaca";

export const revalidate = 300;

// ── Universe ──────────────────────────────────────────────────────────────
export const UNIVERSE: { t: string; n: string; sect: string }[] = [
  // Tech
  { t: "NVDA",  n: "NVIDIA Corp",          sect: "tech" },
  { t: "AAPL",  n: "Apple Inc",            sect: "tech" },
  { t: "MSFT",  n: "Microsoft Corp",       sect: "tech" },
  { t: "GOOGL", n: "Alphabet Inc",         sect: "tech" },
  { t: "META",  n: "Meta Platforms",       sect: "tech" },
  { t: "AMZN",  n: "Amazon.com",           sect: "tech" },
  { t: "TSLA",  n: "Tesla Inc",            sect: "tech" },
  { t: "AVGO",  n: "Broadcom Inc",         sect: "tech" },
  { t: "ORCL",  n: "Oracle Corp",          sect: "tech" },
  { t: "AMD",   n: "Advanced Micro Devices",sect: "tech" },
  { t: "INTC",  n: "Intel Corp",           sect: "tech" },
  { t: "CRM",   n: "Salesforce Inc",       sect: "tech" },
  { t: "ADBE",  n: "Adobe Inc",            sect: "tech" },
  { t: "PLTR",  n: "Palantir Technologies",sect: "tech" },
  { t: "SNOW",  n: "Snowflake Inc",        sect: "tech" },
  { t: "NOW",   n: "ServiceNow Inc",       sect: "tech" },
  { t: "UBER",  n: "Uber Technologies",    sect: "tech" },
  { t: "NET",   n: "Cloudflare Inc",       sect: "tech" },
  // Finance
  { t: "JPM",   n: "JPMorgan Chase",       sect: "fin" },
  { t: "GS",    n: "Goldman Sachs",        sect: "fin" },
  { t: "MS",    n: "Morgan Stanley",       sect: "fin" },
  { t: "BAC",   n: "Bank of America",      sect: "fin" },
  { t: "V",     n: "Visa Inc",             sect: "fin" },
  { t: "MA",    n: "Mastercard Inc",       sect: "fin" },
  { t: "BLK",   n: "BlackRock Inc",        sect: "fin" },
  { t: "SCHW",  n: "Charles Schwab",       sect: "fin" },
  // Health
  { t: "LLY",   n: "Eli Lilly & Co",       sect: "hlth" },
  { t: "JNJ",   n: "Johnson & Johnson",    sect: "hlth" },
  { t: "UNH",   n: "UnitedHealth Group",   sect: "hlth" },
  { t: "PFE",   n: "Pfizer Inc",           sect: "hlth" },
  { t: "ABBV",  n: "AbbVie Inc",           sect: "hlth" },
  { t: "MRK",   n: "Merck & Co",           sect: "hlth" },
  { t: "NVO",   n: "Novo Nordisk",         sect: "hlth" },
  // Industrials
  { t: "CAT",   n: "Caterpillar Inc",      sect: "indu" },
  { t: "DE",    n: "Deere & Co",           sect: "indu" },
  { t: "RTX",   n: "RTX Corp",             sect: "indu" },
  { t: "HON",   n: "Honeywell International",sect: "indu"},
  { t: "GE",    n: "GE Aerospace",         sect: "indu" },
  // Consumer
  { t: "WMT",   n: "Walmart Inc",          sect: "cons" },
  { t: "COST",  n: "Costco Wholesale",     sect: "cons" },
  { t: "HD",    n: "Home Depot Inc",       sect: "cons" },
  { t: "NKE",   n: "Nike Inc",             sect: "cons" },
  { t: "MCD",   n: "McDonald's Corp",      sect: "cons" },
  { t: "SBUX",  n: "Starbucks Corp",       sect: "cons" },
  // Energy
  { t: "XOM",   n: "ExxonMobil Corp",      sect: "ener" },
  { t: "CVX",   n: "Chevron Corp",         sect: "ener" },
  { t: "COP",   n: "ConocoPhillips",       sect: "ener" },
  // Defense
  { t: "LMT",   n: "Lockheed Martin",      sect: "def" },
  { t: "NOC",   n: "Northrop Grumman",     sect: "def" },
  { t: "GD",    n: "General Dynamics",     sect: "def" },
  { t: "BA",    n: "Boeing Co",            sect: "def" },
];

export interface ScreenerRow {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  changePct: number;
  mktCap: number;
  pe: number | null;
  fwdPE: number | null;
  epsGrowth: number | null;
  revGrowth: number | null;
  grossMargin: number | null;
  beta: number | null;
  fiftyDayAvg: number | null;
  twoHundredDayAvg: number | null;
  maSignal: "bullish" | "bearish" | "neutral";
  volume: number;
  avgVolume: number;
  volRatio: number;
  week52High: number;
  week52Low: number;
  rsi: number | null;
}

function maSignal(
  price: number,
  sma50: number | null,
  sma200: number | null
): "bullish" | "bearish" | "neutral" {
  if (!sma50 || !sma200) return "neutral";
  if (price > sma50 && price > sma200) return "bullish";
  if (price < sma50 && price < sma200) return "bearish";
  return "neutral";
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const sectorFilter = p.get("sector");
  const minMktCap = parseFloat(p.get("minMktCap") ?? "0") * 1e9;
  const maxMktCap = parseFloat(p.get("maxMktCap") ?? "99999") * 1e9;
  const minPE = parseFloat(p.get("minPE") ?? "0");
  const maxPE = parseFloat(p.get("maxPE") ?? "9999");
  const minRSI = parseFloat(p.get("minRSI") ?? "0");
  const maxRSI = parseFloat(p.get("maxRSI") ?? "100");
  const maFilter = p.get("maSignal");
  const sortBy = p.get("sortBy") ?? "mktCap";
  const sortDir = p.get("sortDir") ?? "desc";

  // Filter universe first if sector specified
  const universe = sectorFilter
    ? UNIVERSE.filter((u) => u.sect === sectorFilter)
    : UNIVERSE;

  const symbols = universe.map((u) => u.t);
  const yf = await getBulkQuotes(symbols);

  // Build a map for enrichment
  const yfMap = new Map(yf.map((q) => [q.symbol, q]));

  // Fetch RSI for all symbols in parallel (uses Yahoo chart API, cached 1h)
  const rsiMap = new Map<string, number | null>();
  await Promise.all(
    symbols.map(async (sym) => {
      const bars = await getChart(sym, "1mo", "1d");
      const closes = bars.map((b) => b.close).filter(Boolean);
      rsiMap.set(sym, calcRSI(closes));
    })
  );

  const rows: ScreenerRow[] = universe
    .map((u) => {
      const q = yfMap.get(u.t);
      if (!q) {
        return {
          ticker: u.t, name: u.n,
          sector: u.sect,
          price: 0, changePct: 0, mktCap: 0, pe: null, fwdPE: null,
          epsGrowth: null, revGrowth: null, grossMargin: null, beta: null,
          fiftyDayAvg: null, twoHundredDayAvg: null,
          maSignal: "neutral" as const,
          volume: 0, avgVolume: 0, volRatio: 0,
          week52High: 0, week52Low: 0, rsi: null,
        };
      }

      const sma50 = q.fiftyDayAverage ?? null;
      const sma200 = q.twoHundredDayAverage ?? null;
      const avgVol = q.averageDailyVolume10Day ?? 0;
      const vol = q.regularMarketVolume ?? 0;

      return {
        ticker: u.t,
        name: q.shortName || q.longName || u.n,
        sector: q.sector ? normalizeSector(q.sector) : u.sect,
        price: q.regularMarketPrice ?? 0,
        changePct: q.regularMarketChangePercent ?? 0,
        mktCap: q.marketCap ?? 0,
        pe: q.trailingPE ?? null,
        fwdPE: q.forwardPE ?? null,
        epsGrowth: q.earningsGrowth != null ? q.earningsGrowth * 100 : null,
        revGrowth: q.revenueGrowth != null ? q.revenueGrowth * 100 : null,
        grossMargin: q.grossMargins != null ? q.grossMargins * 100 : null,
        beta: q.beta ?? null,
        fiftyDayAvg: sma50,
        twoHundredDayAvg: sma200,
        maSignal: maSignal(q.regularMarketPrice, sma50, sma200),
        volume: vol,
        avgVolume: avgVol,
        volRatio: avgVol > 0 ? vol / avgVol : 0,
        week52High: q.fiftyTwoWeekHigh ?? 0,
        week52Low: q.fiftyTwoWeekLow ?? 0,
        rsi: rsiMap.get(u.t) ?? null,
      };
    })
    .filter((r) => r.price > 0)
    .filter((r) => !minMktCap || r.mktCap >= minMktCap)
    .filter((r) => !maxMktCap || r.mktCap <= maxMktCap)
    .filter((r) => r.pe == null || (r.pe >= minPE && r.pe <= maxPE))
    .filter((r) => r.rsi == null || (r.rsi >= minRSI && r.rsi <= maxRSI))
    .filter((r) => !maFilter || r.maSignal === maFilter);

  // Sort
  rows.sort((a, b) => {
    const av = (a as Record<string, number | null | string>)[sortBy] ?? 0;
    const bv = (b as Record<string, number | null | string>)[sortBy] ?? 0;
    const diff = (av as number) - (bv as number);
    return sortDir === "asc" ? diff : -diff;
  });

  return NextResponse.json({ rows, total: rows.length });
}
