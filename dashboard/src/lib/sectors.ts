/** Ticker-to-sector map — mirrors agents/config.py WATCHLIST */
export const TICKER_SECTOR: Record<string, string> = {
  AAPL: "Technology",
  MSFT: "Technology",
  NVDA: "Technology",
  GOOGL: "Technology",
  META: "Technology",
  AMZN: "Technology",
  TSLA: "Technology",
  JPM: "Finance",
  GS: "Finance",
  BAC: "Finance",
  V: "Finance",
  MA: "Finance",
  UNH: "Healthcare",
  JNJ: "Healthcare",
  PFE: "Healthcare",
  LLY: "Healthcare",
  CAT: "Industrial",
  DE: "Industrial",
  HON: "Industrial",
  WMT: "Consumer",
  COST: "Consumer",
  MCD: "Consumer",
  XOM: "Energy",
  CVX: "Energy",
  LMT: "Defense",
  RTX: "Defense",
  NOC: "Defense",
};

export function getSector(ticker: string): string {
  return TICKER_SECTOR[ticker] ?? "Other";
}
