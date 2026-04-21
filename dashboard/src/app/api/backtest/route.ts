/**
 * POST /api/backtest
 *
 * Runs a simple strategy backtest on historical data from Alpaca/Yahoo.
 *
 * Body: {
 *   symbol: string
 *   strategy: "sma_crossover" | "rsi_mean_revert" | "buy_hold"
 *   params: { fastPeriod?: number; slowPeriod?: number; rsiOversold?: number; rsiOverbought?: number }
 *   startDate: string (YYYY-MM-DD)
 *   endDate: string (YYYY-MM-DD)
 *   initialCapital: number
 * }
 *
 * Returns:
 *   trades, equityCurve, stats (totalReturn, sharpe, maxDrawdown, winRate, numTrades)
 */
import { NextRequest, NextResponse } from "next/server";
import { getBars, isConfigured as alpacaReady, calcRSI, calcSMA } from "@/lib/alpaca";
import { getChart } from "@/lib/yahoo";

interface BacktestRequest {
  symbol: string;
  strategy: "sma_crossover" | "rsi_mean_revert" | "buy_hold";
  params: {
    fastPeriod?: number;
    slowPeriod?: number;
    rsiOversold?: number;
    rsiOverbought?: number;
  };
  startDate: string;
  endDate: string;
  initialCapital: number;
}

interface BacktestTrade {
  date: string;
  action: "buy" | "sell";
  price: number;
  shares: number;
  value: number;
  pnl: number | null;
}

interface EquityPoint {
  date: string;
  value: number;
  drawdown: number;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BacktestRequest;
  const {
    symbol,
    strategy = "sma_crossover",
    params = {},
    startDate,
    endDate,
    initialCapital = 100000,
  } = body;

  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  // ── Fetch historical bars ──────────────────────────────────────────────
  let closes: number[] = [];
  let dates: string[] = [];

  if (alpacaReady()) {
    const bars = await getBars(symbol, { timeframe: "1Day", start: startDate, end: endDate, limit: 500 });
    if (bars.length) {
      closes = bars.map((b) => b.c);
      dates = bars.map((b) => b.t.split("T")[0]);
    }
  }

  if (!closes.length) {
    const range = "2y";
    const bars = await getChart(symbol, range, "1d");
    const filtered = bars.filter((b) => {
      const d = new Date(b.timestamp * 1000).toISOString().split("T")[0];
      return d >= startDate && d <= endDate;
    });
    closes = filtered.map((b) => b.close);
    dates = filtered.map((b) => new Date(b.timestamp * 1000).toISOString().split("T")[0]);
  }

  if (closes.length < 20) {
    return NextResponse.json({ error: "Insufficient data for backtest" }, { status: 400 });
  }

  // ── Run strategy ──────────────────────────────────────────────────────
  const fast = params.fastPeriod ?? 20;
  const slow = params.slowPeriod ?? 50;
  const rsiOversold = params.rsiOversold ?? 30;
  const rsiOverbought = params.rsiOverbought ?? 70;

  let cash = initialCapital;
  let shares = 0;
  let entryPrice = 0;
  const trades: BacktestTrade[] = [];
  const equity: EquityPoint[] = [];
  let peak = initialCapital;

  for (let i = slow + 1; i < closes.length; i++) {
    const price = closes[i];
    const date = dates[i];
    const window = closes.slice(0, i + 1);

    let signal: "buy" | "sell" | null = null;

    if (strategy === "sma_crossover") {
      const fastNow = calcSMA(window, fast) ?? 0;
      const slowNow = calcSMA(window, slow) ?? 0;
      const fastPrev = calcSMA(window.slice(0, -1), fast) ?? 0;
      const slowPrev = calcSMA(window.slice(0, -1), slow) ?? 0;
      if (fastPrev <= slowPrev && fastNow > slowNow) signal = "buy";
      if (fastPrev >= slowPrev && fastNow < slowNow) signal = "sell";
    } else if (strategy === "rsi_mean_revert") {
      const rsi = calcRSI(window) ?? 50;
      const prevRsi = calcRSI(window.slice(0, -1)) ?? 50;
      if (prevRsi <= rsiOversold && rsi > rsiOversold && shares === 0) signal = "buy";
      if (prevRsi >= rsiOverbought && rsi < rsiOverbought && shares > 0) signal = "sell";
    } else if (strategy === "buy_hold") {
      if (i === slow + 1) signal = "buy";
      if (i === closes.length - 1 && shares > 0) signal = "sell";
    }

    if (signal === "buy" && shares === 0 && cash > price) {
      shares = Math.floor(cash / price);
      entryPrice = price;
      cash -= shares * price;
      trades.push({ date, action: "buy", price, shares, value: shares * price, pnl: null });
    } else if (signal === "sell" && shares > 0) {
      const proceeds = shares * price;
      const pnl = proceeds - shares * entryPrice;
      cash += proceeds;
      trades.push({ date, action: "sell", price, shares, value: proceeds, pnl });
      shares = 0;
    }

    const totalValue = cash + shares * price;
    peak = Math.max(peak, totalValue);
    equity.push({
      date,
      value: Math.round(totalValue),
      drawdown: peak > 0 ? ((totalValue - peak) / peak) * 100 : 0,
    });
  }

  // ── Compute stats ─────────────────────────────────────────────────────
  const finalValue = equity[equity.length - 1]?.value ?? initialCapital;
  const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;
  const maxDrawdown = Math.min(...equity.map((e) => e.drawdown));
  const closedTrades = trades.filter((t) => t.pnl != null);
  const wins = closedTrades.filter((t) => (t.pnl ?? 0) > 0);
  const winRate = closedTrades.length ? wins.length / closedTrades.length : 0;
  const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);

  // Approximate Sharpe (annualized, using daily returns)
  const dailyReturns = equity.slice(1).map((e, i) => (e.value - equity[i].value) / equity[i].value);
  const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1);
  const stdReturn = Math.sqrt(
    dailyReturns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / (dailyReturns.length || 1)
  );
  const sharpe = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  return NextResponse.json({
    symbol,
    strategy,
    params: { fastPeriod: fast, slowPeriod: slow, rsiOversold, rsiOverbought },
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    initialCapital,
    stats: {
      finalValue,
      totalReturn: Math.round(totalReturn * 100) / 100,
      totalPnl: Math.round(totalPnl),
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      sharpe: Math.round(sharpe * 100) / 100,
      winRate: Math.round(winRate * 100),
      numTrades: closedTrades.length,
    },
    trades,
    equityCurve: equity,
  });
}
