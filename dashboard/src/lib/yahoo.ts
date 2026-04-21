/**
 * Yahoo Finance unofficial API helpers — no API key required.
 * Used for fundamentals, screener enrichment, and historical prices as fallback.
 */

const YF_BASE = "https://query2.finance.yahoo.com";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
  Accept: "application/json",
};

// ── Bulk quote (price + fundamentals) ─────────────────────────────────────
export interface YFQuote {
  symbol: string;
  shortName: string;
  longName: string;
  sector: string;
  industry: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  averageDailyVolume10Day: number;
  marketCap: number;
  trailingPE: number | null;
  forwardPE: number | null;
  earningsGrowth: number | null;
  revenueGrowth: number | null;
  grossMargins: number | null;
  fiftyDayAverage: number;
  twoHundredDayAverage: number;
  beta: number | null;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  trailingAnnualDividendYield: number | null;
}

export async function getBulkQuotes(symbols: string[]): Promise<YFQuote[]> {
  // Yahoo allows up to ~100 symbols per request
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += 50) {
    chunks.push(symbols.slice(i, i + 50));
  }

  const results: YFQuote[] = [];
  for (const chunk of chunks) {
    try {
      const url = `${YF_BASE}/v7/finance/quote?symbols=${chunk.join(",")}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketVolume,averageDailyVolume10Day,marketCap,trailingPE,forwardPE,earningsGrowth,revenueGrowth,grossMargins,fiftyDayAverage,twoHundredDayAverage,beta,fiftyTwoWeekHigh,fiftyTwoWeekLow,sector,industry,shortName,longName,trailingAnnualDividendYield`;
      const res = await fetch(url, {
        headers: HEADERS,
        next: { revalidate: 60 },
      });
      if (!res.ok) continue;
      const json = await res.json();
      const quotes = json?.quoteResponse?.result ?? [];
      results.push(...quotes);
    } catch {
      // continue on error
    }
  }
  return results;
}

// ── Chart data (OHLCV) for RSI calculation ────────────────────────────────
export interface YFBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function getChart(
  symbol: string,
  range = "3mo",
  interval = "1d"
): Promise<YFBar[]> {
  try {
    const url = `${YF_BASE}/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`;
    const res = await fetch(url, {
      headers: HEADERS,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return [];
    const { timestamp, indicators } = result;
    const { open, high, low, close, volume } = indicators.quote[0];
    return (timestamp as number[]).map((t: number, i: number) => ({
      timestamp: t,
      open: open[i],
      high: high[i],
      low: low[i],
      close: close[i],
      volume: volume[i],
    }));
  } catch {
    return [];
  }
}

// ── Quote summary (detailed fundamentals) ─────────────────────────────────
export async function getQuoteSummary(symbol: string) {
  try {
    const modules = [
      "summaryDetail",
      "defaultKeyStatistics",
      "financialData",
      "assetProfile",
    ].join(",");
    const url = `${YF_BASE}/v10/finance/quoteSummary/${symbol}?modules=${modules}`;
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.quoteSummary?.result?.[0] ?? null;
  } catch {
    return null;
  }
}

// ── Sector/industry lookup for tickers we know ────────────────────────────
export function normalizeSector(yfSector: string): string {
  const map: Record<string, string> = {
    Technology: "tech",
    "Financial Services": "fin",
    Healthcare: "hlth",
    Industrials: "indu",
    "Consumer Cyclical": "cons",
    "Consumer Defensive": "cons",
    Energy: "ener",
    "Communication Services": "tech",
    "Basic Materials": "indu",
    "Real Estate": "fin",
    Utilities: "indu",
  };
  return map[yfSector] ?? "tech";
}
