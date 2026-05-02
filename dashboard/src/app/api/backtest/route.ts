/**
 * POST /api/backtest
 *
 * Runs a single-symbol strategy backtest on Yahoo Finance historical data.
 *
 * Body: {
 *   symbol: string
 *   strategy: "sma_crossover" | "rsi_mean_revert" | "buy_hold" |
 *             "macd" | "bollinger" | "momentum"
 *   params: {
 *     fastPeriod?:    number   (SMA crossover fast window, default 20)
 *     slowPeriod?:    number   (SMA crossover slow window / Bollinger period, default 50/20)
 *     rsiOversold?:   number   (RSI oversold threshold, default 30)
 *     rsiOverbought?: number   (RSI overbought threshold, default 70)
 *     macdFast?:      number   (MACD fast EMA, default 12)
 *     macdSlow?:      number   (MACD slow EMA, default 26)
 *     macdSignal?:    number   (MACD signal EMA, default 9)
 *     bbPeriod?:      number   (Bollinger period, default 20)
 *     bbStd?:         number   (Bollinger std multiplier, default 2)
 *     momPeriod?:     number   (Momentum lookback, default 20)
 *     momThreshold?:  number   (Momentum entry threshold %, default 5)
 *   }
 *   startDate: string  (YYYY-MM-DD)
 *   endDate:   string  (YYYY-MM-DD)
 *   initialCapital: number
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { calcRSI, calcSMA } from "@/lib/alpaca";
import { getChart } from "@/lib/yahoo";

type Strategy = "sma_crossover" | "rsi_mean_revert" | "buy_hold" | "macd" | "bollinger" | "momentum";

interface BacktestRequest {
  symbol: string;
  strategy: Strategy;
  params: {
    fastPeriod?: number;
    slowPeriod?: number;
    rsiOversold?: number;
    rsiOverbought?: number;
    macdFast?: number;
    macdSlow?: number;
    macdSignal?: number;
    bbPeriod?: number;
    bbStd?: number;
    momPeriod?: number;
    momThreshold?: number;
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

// ── Indicator helpers ─────────────────────────────────────────────────────────

function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      ema.push(NaN);
    } else if (i === period - 1) {
      ema.push(values.slice(0, period).reduce((a, b) => a + b, 0) / period);
    } else {
      ema.push(values[i] * k + ema[i - 1] * (1 - k));
    }
  }
  return ema;
}

function calcMACD(closes: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const macdLine = closes.map((_, i) =>
    isNaN(emaFast[i]) || isNaN(emaSlow[i]) ? NaN : emaFast[i] - emaSlow[i]
  );
  const validMacd = macdLine.filter((v) => !isNaN(v));
  const signalRaw = calcEMA(validMacd, signal);
  // Re-align signal onto the original index array
  const signalLine: number[] = new Array(closes.length).fill(NaN);
  let si = 0;
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(macdLine[i])) {
      signalLine[i] = signalRaw[si++] ?? NaN;
    }
  }
  const histogram = macdLine.map((m, i) =>
    isNaN(m) || isNaN(signalLine[i]) ? NaN : m - signalLine[i]
  );
  return { macdLine, signalLine, histogram };
}

function calcBollinger(closes: number[], period = 20, stdMult = 2) {
  const upper: number[] = [];
  const lower: number[] = [];
  const mid: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(NaN); lower.push(NaN); mid.push(NaN);
      continue;
    }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
    mid.push(mean);
    upper.push(mean + stdMult * std);
    lower.push(mean - stdMult * std);
  }
  return { upper, lower, mid };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BacktestRequest;
  const {
    symbol,
    strategy = "sma_crossover",
    params = {},
    startDate,
    endDate,
    initialCapital = 100_000,
  } = body;

  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  // ── Fetch bars via Yahoo Finance ────────────────────────────────────────────
  const range = "5y"; // fetch max; we'll filter by date
  const rawBars = await getChart(symbol.toUpperCase(), range, "1d");
  if (!rawBars.length) {
    return NextResponse.json({ error: "No price data available for this symbol" }, { status: 400 });
  }

  const filtered = rawBars.filter((b) => {
    const d = new Date(b.timestamp * 1000).toISOString().split("T")[0];
    return (!startDate || d >= startDate) && (!endDate || d <= endDate);
  });

  if (filtered.length < 30) {
    return NextResponse.json({ error: "Insufficient data — try a longer date range" }, { status: 400 });
  }

  const closes = filtered.map((b) => b.close);
  const dates = filtered.map((b) => new Date(b.timestamp * 1000).toISOString().split("T")[0]);

  // ── Parameter defaults ──────────────────────────────────────────────────────
  const fast       = params.fastPeriod   ?? 20;
  const slow       = params.slowPeriod   ?? 50;
  const rsiOS      = params.rsiOversold  ?? 30;
  const rsiOB      = params.rsiOverbought ?? 70;
  const macdFast   = params.macdFast     ?? 12;
  const macdSlow   = params.macdSlow     ?? 26;
  const macdSig    = params.macdSignal   ?? 9;
  const bbPeriod   = params.bbPeriod     ?? 20;
  const bbStd      = params.bbStd        ?? 2;
  const momPeriod  = params.momPeriod    ?? 20;
  const momThresh  = params.momThreshold ?? 5;

  // ── Pre-compute indicators ──────────────────────────────────────────────────
  const { macdLine, signalLine } = strategy === "macd"
    ? calcMACD(closes, macdFast, macdSlow, macdSig)
    : { macdLine: [], signalLine: [] };

  const { upper: bbUpper, lower: bbLower } = strategy === "bollinger"
    ? calcBollinger(closes, bbPeriod, bbStd)
    : { upper: [], lower: [] };

  // ── Simulation ──────────────────────────────────────────────────────────────
  let cash = initialCapital;
  let shares = 0;
  let entryPrice = 0;
  const trades: BacktestTrade[] = [];
  const equity: EquityPoint[] = [];
  let peak = initialCapital;
  const warmup = Math.max(slow + 1, macdSlow + macdSig + 1, bbPeriod + 1, momPeriod + 1, 2);

  for (let i = warmup; i < closes.length; i++) {
    const price = closes[i];
    const date = dates[i];
    const window = closes.slice(0, i + 1);

    let signal: "buy" | "sell" | null = null;

    if (strategy === "sma_crossover") {
      const fNow = calcSMA(window, fast) ?? 0;
      const sNow = calcSMA(window, slow) ?? 0;
      const fPrev = calcSMA(window.slice(0, -1), fast) ?? 0;
      const sPrev = calcSMA(window.slice(0, -1), slow) ?? 0;
      if (fPrev <= sPrev && fNow > sNow) signal = "buy";
      if (fPrev >= sPrev && fNow < sNow) signal = "sell";

    } else if (strategy === "rsi_mean_revert") {
      const rsi     = calcRSI(window) ?? 50;
      const prevRsi = calcRSI(window.slice(0, -1)) ?? 50;
      if (prevRsi <= rsiOS && rsi > rsiOS && shares === 0) signal = "buy";
      if (prevRsi >= rsiOB && rsi < rsiOB && shares > 0)  signal = "sell";

    } else if (strategy === "buy_hold") {
      if (i === warmup) signal = "buy";
      if (i === closes.length - 1 && shares > 0) signal = "sell";

    } else if (strategy === "macd") {
      const mNow  = macdLine[i];
      const sNow  = signalLine[i];
      const mPrev = macdLine[i - 1];
      const sPrev = signalLine[i - 1];
      if (!isNaN(mNow) && !isNaN(sNow) && !isNaN(mPrev) && !isNaN(sPrev)) {
        if (mPrev <= sPrev && mNow > sNow) signal = "buy";
        if (mPrev >= sPrev && mNow < sNow) signal = "sell";
      }

    } else if (strategy === "bollinger") {
      const up  = bbUpper[i];
      const lo  = bbLower[i];
      const upP = bbUpper[i - 1];
      const loP = bbLower[i - 1];
      if (!isNaN(lo) && !isNaN(loP)) {
        // Price crosses below lower band → buy
        if (closes[i - 1] >= loP && price < lo && shares === 0) signal = "buy";
        // Price crosses above upper band → sell
        if (closes[i - 1] <= upP && price > up && shares > 0)  signal = "sell";
      }

    } else if (strategy === "momentum") {
      const lookback = closes[i - momPeriod];
      const ret = ((price - lookback) / lookback) * 100;
      const prevLookback = closes[i - momPeriod - 1];
      const prevRet = ((closes[i - 1] - prevLookback) / prevLookback) * 100;
      // Enter when momentum crosses above threshold; exit when it goes negative
      if (prevRet < momThresh && ret >= momThresh && shares === 0) signal = "buy";
      if (ret < 0 && shares > 0) signal = "sell";
    }

    // Execute
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

  // ── Stats ──────────────────────────────────────────────────────────────────
  const finalValue  = equity[equity.length - 1]?.value ?? initialCapital;
  const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;
  const maxDrawdown = equity.length ? Math.min(...equity.map((e) => e.drawdown)) : 0;
  const closed      = trades.filter((t) => t.pnl != null);
  const wins        = closed.filter((t) => (t.pnl ?? 0) > 0);
  const winRate     = closed.length ? wins.length / closed.length : 0;
  const totalPnl    = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);

  const dailyReturns = equity.slice(1).map((e, i) =>
    equity[i].value > 0 ? (e.value - equity[i].value) / equity[i].value : 0
  );
  const avgR = dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1);
  const stdR = Math.sqrt(
    dailyReturns.reduce((s, r) => s + (r - avgR) ** 2, 0) / (dailyReturns.length || 1)
  );
  const sharpe = stdR > 0 ? (avgR / stdR) * Math.sqrt(252) : 0;

  // Annualised return
  const years = equity.length / 252;
  const cagr  = years > 0 ? (Math.pow(finalValue / initialCapital, 1 / years) - 1) * 100 : totalReturn;

  return NextResponse.json({
    symbol: symbol.toUpperCase(),
    strategy,
    params: { fast, slow, rsiOS, rsiOB, macdFast, macdSlow, macdSig, bbPeriod, bbStd, momPeriod, momThresh },
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    initialCapital,
    stats: {
      finalValue,
      totalReturn:  Math.round(totalReturn  * 100) / 100,
      cagr:         Math.round(cagr         * 100) / 100,
      totalPnl:     Math.round(totalPnl),
      maxDrawdown:  Math.round(maxDrawdown  * 100) / 100,
      sharpe:       Math.round(sharpe       * 100) / 100,
      winRate:      Math.round(winRate      * 100),
      numTrades:    closed.length,
      numBars:      equity.length,
    },
    trades,
    equityCurve: equity,
  });
}
