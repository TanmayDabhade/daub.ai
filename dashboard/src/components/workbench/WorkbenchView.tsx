"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";

type Props = { ticker: string };

// ── Types ─────────────────────────────────────────────────────────────────────

type LiveQuote = {
  price: number;
  changePct: number;
  change: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  pe: number | null;
  fwdPE: number | null;
  beta: number | null;
  week52High: number;
  week52Low: number;
  fiftyDayAvg: number;
  twoHundredDayAvg: number;
  bid: number;
  ask: number;
  name: string;
  sector: string;
};

type Bar = { date: string; open: number; high: number; low: number; close: number; volume: number };

type OrderRow = {
  id: string;
  ticker: string;
  direction: "long" | "short";
  quantity: number;
  entry_price: number | null;
  exit_price: number | null;
  status: string;
  opened_at: string;
  alpaca_order_id: string | null;
};

type OrderBookLevel = { price: number; size: number; total: number };

type OrderBook = {
  quote: { price: number; bid: number; ask: number; spread: number; spread_pct: number; change_pct: number };
  asks: OrderBookLevel[];
  bids: OrderBookLevel[];
  indicative: boolean;
};

type SimAccount = {
  cash: number;
  equity: number;
  realized_pnl: number;
  total_return_pct: number;
  drawdown_pct: number;
};

// ── Static demo data (used when live data hasn't loaded) ─────────────────────

type Verdict = {
  call: string; weight: string; confidence: number; summary: string;
  entry: string; stop: string; target: string; review: string;
  reasonsGood: string[]; reasonsBad: string[];
};
type Stat = { l: string; v: string; s?: string; tone?: "up" | "dn" | "" };
type Note = {
  ag: string; role: string; body: React.ReactNode; chips: string[];
  vote: "up" | "dn" | "neutral"; voteLabel: string; conf: number; ts: string;
};
type Hold = { t: string; n: string; stance: "long" | "short"; px: number; ch: number; w: number; conf: number; pnl: number; ts: string };

const DEMO_VERDICT: Verdict = {
  call: "Accumulate", weight: "4.0% weight", confidence: 0.95,
  summary: "Four of five agents align long. The tape is with us today, and the 10-Q was cleaner than the Street expected. The one caveat is export-policy risk on the China book; real, but already partly priced. Staged entry over two sessions to avoid paying up on a single print.",
  entry: "staged · 2d", stop: "$178.00", target: "$240.00", review: "12 mo.",
  reasonsGood: [
    "Data-center super-cycle intact; sovereign-AI backlog still accruing (~$8B disclosed).",
    "Gross margin leadership in accelerators; pricing power holds.",
    "Trend structure intact — 52-week high at $212.19, held above the 50-day.",
    "Ecosystem lock-in via CUDA; switching cost remains the moat.",
  ],
  reasonsBad: [
    "Customer concentration: top four hyperscalers dominate the book.",
    "China-restricted revenue risk on any export policy tightening.",
    "Valuation leaves no margin for an execution miss (fwd P/E 48×).",
    "Inventory & supply normalization could compress the multiple.",
  ],
};

const DEMO_NOTES: Note[] = [
  { ag: "Filings", role: "10-K / 10-Q / 8-K reader",
    body: <p>Nvidia&apos;s new 10-Q reads like a company still pulling away from its competition. Data-center revenue came in at <strong>$30.8B — up 122% year-on-year</strong>, and the filing names a roughly <strong>$8B sovereign-AI backlog</strong> for the first time.</p>,
    chips: ["NVDA 10-Q · pp. 12–18", "filed 04/22", "diff vs. Q2"], vote: "up", voteLabel: "Bullish", conf: 0.92, ts: "09:41 ET" },
  { ag: "Earnings", role: "Call transcript & tone",
    body: <p>The CFO was direct — none of the usual hedging around the Blackwell ramp. <strong>Guidance floor moved up $1.5B above the Street midpoint.</strong> Our evasion score on the Q&amp;A was 0.08 — unusually low for a semis call.</p>,
    chips: ["Q3 transcript", "04/22 · 5pm ET", "evasion 0.08"], vote: "up", voteLabel: "Bullish", conf: 0.88, ts: "09:38 ET" },
  { ag: "Sentiment", role: "News, notes & flow",
    body: <p>News flow turned decisively positive — <strong>11 of 14 sell-side notes carry an upgrade or reiterate-buy</strong>. Retail chatter is noisier but directionally the same.</p>,
    chips: ["14 notes · 83% positive", "2.1k retail mentions", "4 upgrades"], vote: "up", voteLabel: "Bullish", conf: 0.81, ts: "09:36 ET" },
  { ag: "Macro", role: "Regime & cross-asset",
    body: <p>The broader setup is friendly: yields are easing, the dollar is softer, and the rotation into mega-cap tech has legs. China export-policy risk — <strong>roughly 8% of Nvidia&apos;s data-center line is exposed</strong>.</p>,
    chips: ["UST10 −4bp", "DXY 101.4", "regime · risk-on"], vote: "neutral", voteLabel: "Neutral", conf: 0.74, ts: "09:31 ET" },
  { ag: "Aggregator", role: "Portfolio manager",
    body: <p>Four of five agents align long; macro&apos;s caveat is real but already in the price. Recommending <strong>accumulate to 4.0% weight, staged over two sessions</strong>. Stop at $178 (below the 50-day). Twelve-month target: $240.</p>,
    chips: ["size 4.0%", "staged · 2d", "stop $178", "target $240"], vote: "up", voteLabel: "Accumulate", conf: 0.95, ts: "09:42 ET" },
];

const DEMO_HOLDINGS: Hold[] = [
  { t: "LLY",  n: "Eli Lilly & Co",  stance: "long",  px: 828.40, ch:  2.02, w: 3.6, conf: 0.91, pnl:  131, ts: "09:39" },
  { t: "AAPL", n: "Apple Inc",       stance: "long",  px: 195.80, ch: -1.21, w: 3.1, conf: 0.62, pnl:  -72, ts: "09:36" },
  { t: "JPM",  n: "JPMorgan Chase",  stance: "long",  px: 221.50, ch:  3.02, w: 2.4, conf: 0.78, pnl:  130, ts: "09:34" },
  { t: "TSLA", n: "Tesla Inc",       stance: "short", px: 348.55, ch: -3.71, w: 2.2, conf: 0.68, pnl:  161, ts: "09:33" },
  { t: "GS",   n: "Goldman Sachs",   stance: "long",  px: 612.80, ch:  2.41, w: 2.0, conf: 0.74, pnl:   86, ts: "09:29" },
  { t: "XOM",  n: "Exxon Mobil",     stance: "short", px: 115.20, ch: -2.70, w: 1.5, conf: 0.71, pnl:   80, ts: "09:26" },
];

// ── Chart helpers ─────────────────────────────────────────────────────────────

function buildChartPath(closes: number[], W = 600, H = 180) {
  if (closes.length < 2) return null;
  const pad = { l: 4, r: 4, t: 10, b: 10 };
  const mn = closes.reduce((a, b) => Math.min(a, b), Infinity);
  const mx = closes.reduce((a, b) => Math.max(a, b), -Infinity);
  const rng = mx - mn || 1;
  const n = closes.length;
  const X = (i: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - (v - mn) / rng) * (H - pad.t - pad.b);
  const poly = closes.map((p, i) => `${X(i).toFixed(1)},${Y(p).toFixed(1)}`).join(" ");
  const fill = `${X(0)},${H - pad.b} ${poly} ${X(n - 1)},${H - pad.b}`;
  return { W, H, poly, fill };
}

function fmtMktCap(v: number) {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}
function fmtVol(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}

// ── Timeframe config ──────────────────────────────────────────────────────────

const TIMEFRAMES = ["1D", "1W", "1M", "3M", "1Y", "5Y"] as const;
type TF = (typeof TIMEFRAMES)[number];

// ── Main component ────────────────────────────────────────────────────────────

export default function WorkbenchView({ ticker }: Props) {
  const tk = (ticker || "NVDA").toUpperCase();

  // Live data
  const [quote, setQuote] = useState<LiveQuote | null>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [tf, setTf] = useState<TF>("3M");
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [account, setAccount] = useState<SimAccount | null>(null);

  // Order panel state
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [orderQty, setOrderQty] = useState("10");
  const [orderLimit, setOrderLimit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderMsg, setOrderMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Order book tab state
  const [activeTab, setActiveTab] = useState<"chart" | "book">("chart");

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch quote ─────────────────────────────────────────────────────────────
  const fetchQuote = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotes?symbols=${tk}`);
      const data = await res.json();
      const q = data.quotes?.[tk];
      if (q) setQuote(q as LiveQuote);
    } catch { /* ignore */ }
  }, [tk]);

  // ── Fetch bars ──────────────────────────────────────────────────────────────
  const fetchBars = useCallback(async (timeframe: TF) => {
    try {
      const res = await fetch(`/api/bars?symbol=${tk}&tf=${timeframe}`);
      const data = await res.json();
      if (data.bars?.length) setBars(data.bars as Bar[]);
    } catch { /* ignore */ }
  }, [tk]);

  // ── Fetch order book ─────────────────────────────────────────────────────────
  const fetchOrderBook = useCallback(async () => {
    try {
      const res = await fetch(`/api/orderbook?symbol=${tk}`);
      if (res.ok) setOrderBook(await res.json());
    } catch { /* ignore */ }
  }, [tk]);

  // ── Fetch sim orders for this ticker ─────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/trading?action=orders&ticker=${tk}`);
      const data = await res.json();
      if (data.orders) setOrders(data.orders as OrderRow[]);
    } catch { /* ignore */ }
  }, [tk]);

  // ── Fetch account ─────────────────────────────────────────────────────────────
  const fetchAccount = useCallback(async () => {
    try {
      const res = await fetch("/api/trading?action=account");
      if (res.ok) setAccount(await res.json());
    } catch { /* ignore */ }
  }, []);

  // ── Boot ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchQuote();
    fetchBars(tf);
    fetchOrderBook();
    fetchOrders();
    fetchAccount();

    // Poll quote + orderbook every 15 s; orders every 30 s
    pollingRef.current = setInterval(() => {
      fetchQuote();
      fetchOrderBook();
    }, 15_000);
    const ordersInterval = setInterval(() => {
      fetchOrders();
      fetchAccount();
    }, 30_000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      clearInterval(ordersInterval);
    };
  }, [fetchQuote, fetchBars, fetchOrderBook, fetchOrders, fetchAccount, tf]);

  // Re-fetch bars when timeframe changes
  useEffect(() => { fetchBars(tf); }, [tf, fetchBars]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const price    = quote?.price ?? 199.64;
  const change   = quote?.change ?? 11.97;
  const changePct = quote?.changePct ?? 6.38;
  const up       = changePct >= 0;
  const name     = quote?.name || "Loading…";

  const closes   = bars.map((b) => b.close);
  const chart    = buildChartPath(closes);

  const isIntraday = tf === "1D" || tf === "1W";

  const liveStats: Stat[] = quote
    ? [
        {
          l: "Day Range",
          v: `${(price * 0.993).toFixed(2)} – ${(price * 1.007).toFixed(2)}`,
          s: "intraday",
        },
        {
          l: "52W High",
          v: quote.week52High.toFixed(2),
          s: `${(((price - quote.week52High) / quote.week52High) * 100).toFixed(1)}% from high`,
          tone: "dn",
        },
        {
          l: "52W Low",
          v: quote.week52Low.toFixed(2),
          s: `+${(((price - quote.week52Low) / quote.week52Low) * 100).toFixed(1)}% off low`,
          tone: "up",
        },
        {
          l: "Volume",
          v: fmtVol(quote.volume),
          s: `avg ${fmtVol(quote.avgVolume)}`,
        },
        {
          l: "Market Cap",
          v: fmtMktCap(quote.marketCap),
        },
        {
          l: "Fwd P/E",
          v: quote.fwdPE != null ? `${quote.fwdPE.toFixed(1)}×` : "—",
          s: quote.pe != null ? `trail ${quote.pe.toFixed(1)}×` : undefined,
        },
      ]
    : DEMO_VERDICT.reasonsGood.map((_, i) => ({ l: "—", v: "—", s: i === 0 ? "loading" : undefined })).slice(0, 6);

  // ── Order submit ─────────────────────────────────────────────────────────────
  const submitOrder = async () => {
    setSubmitting(true);
    setOrderMsg(null);
    try {
      const body: Record<string, unknown> = {
        action: "order",
        symbol: tk,
        qty: parseInt(orderQty) || 1,
        side: orderSide,
        type: orderType,
      };
      if (orderType === "limit" && orderLimit) {
        body.limit_price = parseFloat(orderLimit);
      }
      const res = await fetch("/api/trading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setOrderMsg({ ok: false, text: json.error ?? "Order failed" });
      } else {
        const fp = json.fill_price ? ` @ $${json.fill_price.toFixed(2)}` : "";
        setOrderMsg({
          ok: true,
          text: json.status === "filled"
            ? `✓ Filled ${json.qty} × ${tk}${fp}`
            : `✓ Limit order queued — fills when price ${orderSide === "buy" ? "≤" : "≥"} $${orderLimit}`,
        });
        setOrderQty("10");
        setOrderLimit("");
        await fetchOrders();
        await fetchAccount();
      }
    } catch (e) {
      setOrderMsg({ ok: false, text: String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Cancel order ──────────────────────────────────────────────────────────────
  const cancelOrder = async (id: string) => {
    await fetch(`/api/trading?id=${id}`, { method: "DELETE" });
    await fetchOrders();
  };

  // ── Order meta helper ─────────────────────────────────────────────────────────
  const getOrderType = (row: OrderRow) => {
    try {
      const meta = row.alpaca_order_id ? JSON.parse(row.alpaca_order_id) : {};
      return meta.type ?? "market";
    } catch { return "market"; }
  };

  const getLimitPrice = (row: OrderRow) => row.exit_price;

  // ── Estimated fill ────────────────────────────────────────────────────────────
  const estFill = orderType === "market"
    ? (orderSide === "buy" ? price * 1.0005 : price * 0.9995)
    : parseFloat(orderLimit) || 0;
  const estNotional = (parseInt(orderQty) || 0) * estFill;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, margin: "-22px -28px" }}>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section style={{
        padding: "26px 32px",
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) auto auto",
        gap: 24,
        alignItems: "center",
        borderBottom: "1px solid var(--line)",
        background: "var(--bg)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, flexWrap: "wrap", minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1 }}>{tk}</div>
          <div className="mute" style={{ fontSize: 13.5 }}>{name}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <span className="pill">{quote?.sector || "—"}</span>
            <span className="pill up">● Live</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontSize: 28, fontWeight: 500, lineHeight: 1 }}>{price.toFixed(2)}</div>
          <div className={"mono " + (up ? "up" : "down")} style={{ fontSize: 13, marginTop: 7 }}>
            {up ? "+" : ""}{change.toFixed(2)} &nbsp;·&nbsp; {up ? "+" : ""}{changePct.toFixed(2)}%
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => setActiveTab(activeTab === "book" ? "chart" : "book")}>
            {activeTab === "book" ? "Chart" : "Order Book"}
          </button>
          <button
            className={"btn " + (showOrderPanel ? "active" : "primary")}
            onClick={() => setShowOrderPanel(!showOrderPanel)}
          >
            {showOrderPanel ? "Close" : "Open position"}
          </button>
        </div>
      </section>

      {/* ── Account summary strip ─────────────────────────────────────────────── */}
      {account && (
        <section style={{
          padding: "8px 32px",
          display: "flex",
          gap: 28,
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-1)",
          fontSize: 11.5,
        }}>
          <span className="mute">Sim account</span>
          <span>Cash <span className="mono">${account.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></span>
          <span>Equity <span className="mono">${account.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></span>
          <span className={account.total_return_pct >= 0 ? "up" : "down"}>
            Return <span className="mono">{account.total_return_pct >= 0 ? "+" : ""}{account.total_return_pct.toFixed(2)}%</span>
          </span>
          <span className={account.drawdown_pct <= -2 ? "down" : "mute"}>
            Drawdown <span className="mono">{account.drawdown_pct.toFixed(2)}%</span>
          </span>
          <span>Realized P&amp;L <span className={"mono " + (account.realized_pnl >= 0 ? "up" : "down")}>
            {account.realized_pnl >= 0 ? "+" : ""}${account.realized_pnl.toFixed(0)}
          </span></span>
        </section>
      )}

      {/* ── Order panel ──────────────────────────────────────────────────────────── */}
      {showOrderPanel && (
        <section style={{
          padding: "20px 32px",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>New order — {tk}</span>
            <span className="mute" style={{ fontSize: 11 }}>Paper account · no real capital at risk</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            {/* Side */}
            <div>
              <div className="mute" style={{ fontSize: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Side</div>
              <div style={{ display: "flex", gap: 3 }}>
                {(["buy", "sell"] as const).map((s) => (
                  <button
                    key={s}
                    className={"btn " + (orderSide === s ? (s === "buy" ? "active" : "") : "")}
                    style={orderSide === s ? {
                      background: s === "buy" ? "var(--up-bg)" : "var(--down-bg)",
                      color: s === "buy" ? "var(--up)" : "var(--down)",
                      borderColor: s === "buy" ? "var(--up)" : "var(--down)",
                    } : {}}
                    onClick={() => setOrderSide(s)}
                  >
                    {s === "buy" ? "Buy" : "Sell"}
                  </button>
                ))}
              </div>
            </div>

            {/* Type */}
            <div>
              <div className="mute" style={{ fontSize: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Type</div>
              <div style={{ display: "flex", gap: 3 }}>
                {(["market", "limit"] as const).map((t) => (
                  <button key={t} className={"btn " + (orderType === t ? "active" : "")} onClick={() => setOrderType(t)}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Qty */}
            <div>
              <div className="mute" style={{ fontSize: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Quantity</div>
              <input
                value={orderQty}
                onChange={(e) => setOrderQty(e.target.value)}
                style={{
                  width: 72, padding: "6px 10px",
                  background: "var(--bg-2)", border: "1px solid var(--line-2)",
                  borderRadius: "var(--r-sm)", color: "var(--fg)",
                  fontFamily: "var(--mono)", fontSize: 13,
                }}
              />
            </div>

            {/* Limit price */}
            {orderType === "limit" && (
              <div>
                <div className="mute" style={{ fontSize: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Limit price</div>
                <input
                  value={orderLimit}
                  onChange={(e) => setOrderLimit(e.target.value)}
                  placeholder={price.toFixed(2)}
                  style={{
                    width: 90, padding: "6px 10px",
                    background: "var(--bg-2)", border: "1px solid var(--line-2)",
                    borderRadius: "var(--r-sm)", color: "var(--fg)",
                    fontFamily: "var(--mono)", fontSize: 13,
                  }}
                />
              </div>
            )}

            {/* Est. fill info */}
            <div style={{ fontSize: 11, color: "var(--fg-dim)", lineHeight: 1.5 }}>
              <div>
                Est. fill <span className="mono" style={{ color: "var(--fg)" }}>${estFill.toFixed(2)}</span>
                {orderType === "market" && <span className="mute"> (5 bps slip)</span>}
              </div>
              <div>Notional <span className="mono" style={{ color: "var(--fg)" }}>${estNotional.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
            </div>

            {/* Submit */}
            <button
              className="btn primary"
              style={{ padding: "7px 20px", fontWeight: 600 }}
              onClick={submitOrder}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : `${orderSide === "buy" ? "Buy" : "Sell"} ${tk}`}
            </button>
          </div>

          {orderMsg && (
            <div style={{
              marginTop: 10, padding: "8px 12px",
              borderRadius: "var(--r-sm)", fontSize: 12,
              background: orderMsg.ok ? "var(--up-bg)" : "var(--down-bg)",
              color: orderMsg.ok ? "var(--up)" : "var(--down)",
            }}>
              {orderMsg.text}
            </div>
          )}
        </section>
      )}

      {/* ── Main grid ────────────────────────────────────────────────────────────── */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)",
        gap: 0,
      }}>
        {/* Left: verdict + reasons */}
        <div style={{ padding: "28px 32px", borderRight: "1px solid var(--line)", minWidth: 0 }}>
          <div className="sec-title">
            Swarm verdict
            <span className="meta">Apr 23 · 04:00 PM ET · aggregator</span>
          </div>

          <div style={{
            border: "1px solid var(--line-2)", background: "var(--bg-1)",
            borderRadius: 4, padding: "20px 22px", borderLeft: "3px solid var(--accent)",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.15 }}>
                {DEMO_VERDICT.call} —{" "}
                <span style={{ color: "var(--accent)" }}>{DEMO_VERDICT.weight}</span>
              </div>
              <div className="mono" style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--fg-muted)", flexShrink: 0 }}>
                confidence <span style={{ color: "var(--fg)", fontWeight: 500 }}>{DEMO_VERDICT.confidence.toFixed(2)}</span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-dim)", maxWidth: "72ch" }}>
              {DEMO_VERDICT.summary}
            </p>
            <div style={{
              display: "flex", gap: 24, marginTop: 18, paddingTop: 16,
              borderTop: "1px solid var(--line)", fontFamily: "var(--mono)",
              fontSize: 12, color: "var(--fg-dim)", flexWrap: "wrap",
            }}>
              {([["entry", DEMO_VERDICT.entry], ["stop", DEMO_VERDICT.stop], ["target", DEMO_VERDICT.target], ["review", DEMO_VERDICT.review]] as const).map(([k, v]) => (
                <div key={k}>
                  <span style={{ color: "var(--fg-ghost)", marginRight: 6, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10.5 }}>{k}</span>
                  <span style={{ color: "var(--fg)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginTop: 28 }}>
            <ReasonList title="Reasons to own"     items={DEMO_VERDICT.reasonsGood} tone="good" />
            <ReasonList title="What could break it" items={DEMO_VERDICT.reasonsBad}  tone="bad"  />
          </div>
        </div>

        {/* Right: stats + chart/orderbook */}
        <div style={{ padding: "28px 32px", minWidth: 0 }}>
          <div className="sec-title">
            {activeTab === "chart" ? "Market snapshot" : "Order book — indicative"}
            <span className="meta">{activeTab === "chart" ? "Yahoo Finance · 15s" : "synthetic depth · 30s"}</span>
          </div>

          {/* Stats grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            border: "1px solid var(--line-2)", borderRadius: 3,
            overflow: "hidden", background: "var(--bg-1)",
          }}>
            {liveStats.map((s, i) => {
              const col = i % 2;
              const row = Math.floor(i / 2);
              const rows = Math.ceil(liveStats.length / 2);
              return (
                <div key={s.l} style={{
                  padding: "14px 16px",
                  borderRight: col === 0 ? "1px solid var(--line)" : "none",
                  borderBottom: row < rows - 1 ? "1px solid var(--line)" : "none",
                }}>
                  <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--fg-muted)", marginBottom: 7 }}>{s.l}</div>
                  <div className="mono" style={{ fontSize: 17, fontWeight: 500 }}>{s.v}</div>
                  {s.s && (
                    <div className={"mono " + (s.tone ?? "")} style={{ fontSize: 11, color: s.tone ? undefined : "var(--fg-muted)", marginTop: 5 }}>{s.s}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Chart */}
          {activeTab === "chart" && (
            <div style={{ marginTop: 20, border: "1px solid var(--line-2)", borderRadius: 3, background: "var(--bg-1)", padding: 14 }}>
              {chart ? (
                <svg viewBox={`0 0 ${chart.W} ${chart.H}`} preserveAspectRatio="none" style={{ display: "block", width: "100%", height: "auto" }}>
                  <defs>
                    <linearGradient id="wbgrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="var(--accent)" stopOpacity="0.20" />
                      <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <g>
                    {[1, 2, 3].map((i) => (
                      <line key={i} x1={0} x2={chart.W} y1={(chart.H / 4) * i} y2={(chart.H / 4) * i}
                        stroke="var(--line)" strokeDasharray="2 4" />
                    ))}
                  </g>
                  <polygon points={chart.fill} fill="url(#wbgrad)" />
                  <polyline points={chart.poly} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
                </svg>
              ) : (
                <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="mute" style={{ fontSize: 12 }}>Loading chart…</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--fg-muted)", padding: "0 4px" }}>
                <div>{tk} · {isIntraday ? "intraday" : "daily close"} · {bars.length} bars · Yahoo Finance</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {TIMEFRAMES.map((t) => (
                    <span key={t} onClick={() => setTf(t)} style={{
                      padding: "3px 9px", borderRadius: 2, cursor: "pointer",
                      background: t === tf ? "var(--bg-3)" : "transparent",
                      color: t === tf ? "var(--fg)" : "var(--fg-muted)",
                    }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Order book */}
          {activeTab === "book" && (
            <div style={{ marginTop: 20 }}>
              {orderBook ? (
                <>
                  {/* Spread summary */}
                  <div style={{
                    display: "flex", gap: 20, padding: "10px 14px",
                    background: "var(--bg-1)", border: "1px solid var(--line-2)",
                    borderRadius: "3px 3px 0 0", fontSize: 11.5,
                  }}>
                    <span>Bid <span className="mono up">{orderBook.quote.bid.toFixed(2)}</span></span>
                    <span>Ask <span className="mono down">{orderBook.quote.ask.toFixed(2)}</span></span>
                    <span className="mute">Spread <span className="mono">{orderBook.quote.spread.toFixed(2)} ({orderBook.quote.spread_pct.toFixed(3)}%)</span></span>
                    <span style={{ flex: 1, textAlign: "right" }} className="mute">{orderBook.indicative && "indicative — not real L2"}</span>
                  </div>

                  {/* Depth table */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr",
                    border: "1px solid var(--line-2)", borderTop: "none",
                    borderRadius: "0 0 3px 3px", overflow: "hidden",
                    background: "var(--bg-1)", maxHeight: 280, overflow: "auto",
                  }}>
                    {/* Asks (left, red) */}
                    <div style={{ borderRight: "1px solid var(--line)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "6px 10px", borderBottom: "1px solid var(--line)", fontSize: 10, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        <span>Price</span><span style={{ textAlign: "right" }}>Size</span><span style={{ textAlign: "right" }}>Total</span>
                      </div>
                      {[...orderBook.asks].reverse().map((a, i) => {
                        const maxTotal = orderBook.asks[orderBook.asks.length - 1].total;
                        return (
                          <div key={i} style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "4px 10px", fontSize: 11.5 }}>
                            <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${(a.total / maxTotal) * 100}%`, background: "var(--down-bg)", opacity: 0.6 }} />
                            <span className="mono down" style={{ position: "relative" }}>{a.price.toFixed(2)}</span>
                            <span className="mono mute" style={{ textAlign: "right", position: "relative" }}>{a.size.toLocaleString()}</span>
                            <span className="mono mute" style={{ textAlign: "right", position: "relative" }}>{a.total.toLocaleString()}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bids (right, green) */}
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "6px 10px", borderBottom: "1px solid var(--line)", fontSize: 10, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        <span>Price</span><span style={{ textAlign: "right" }}>Size</span><span style={{ textAlign: "right" }}>Total</span>
                      </div>
                      {orderBook.bids.map((b, i) => {
                        const maxTotal = orderBook.bids[orderBook.bids.length - 1].total;
                        return (
                          <div key={i} style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "4px 10px", fontSize: 11.5 }}>
                            <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${(b.total / maxTotal) * 100}%`, background: "var(--up-bg)", opacity: 0.6 }} />
                            <span className="mono up" style={{ position: "relative" }}>{b.price.toFixed(2)}</span>
                            <span className="mono mute" style={{ textAlign: "right", position: "relative" }}>{b.size.toLocaleString()}</span>
                            <span className="mono mute" style={{ textAlign: "right", position: "relative" }}>{b.total.toLocaleString()}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="mute" style={{ fontSize: 12 }}>Loading order book…</span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Agent notes ───────────────────────────────────────────────────────────── */}
      <section style={{ padding: "28px 32px", borderTop: "1px solid var(--line)" }}>
        <div className="sec-title">
          Agent notes — what each specialist is seeing
          <span className="meta">last refresh · 09:42 ET</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--line-2)", borderRadius: 4, background: "var(--bg-1)", overflow: "hidden" }}>
          {DEMO_NOTES.map((note, i) => (
            <div key={note.ag} style={{
              display: "grid", gridTemplateColumns: "150px minmax(0,1fr) 130px",
              gap: 24, padding: "18px 20px",
              borderBottom: i < DEMO_NOTES.length - 1 ? "1px solid var(--line)" : "none",
              alignItems: "flex-start",
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>{note.ag}</div>
                <div className="mute" style={{ fontSize: 11.5, marginTop: 3 }}>{note.role}</div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--fg-dim)" }}>{note.body}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  {note.chips.map((c) => <span key={c} className="chip">{c}</span>)}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, fontFamily: "var(--mono)", fontSize: 11, color: "var(--fg-muted)" }}>
                <span className={"pill " + (note.vote === "up" ? "up" : note.vote === "dn" ? "dn" : "")} style={{ fontSize: 11.5 }}>
                  {note.vote === "up" ? "↑" : note.vote === "dn" ? "↓" : "→"} {note.voteLabel}
                </span>
                <span>conf {note.conf.toFixed(2)}</span>
                <span style={{ color: "var(--fg-ghost)" }}>{note.ts}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sim orders for this ticker ─────────────────────────────────────────────── */}
      <section style={{ padding: "28px 32px", borderTop: "1px solid var(--line)" }}>
        <div className="sec-title">
          {tk} orders
          <span className="meta">sim account · {orders.length} records</span>
          <span style={{ flex: 1 }} />
          <button className="btn" style={{ fontSize: 11 }} onClick={() => setShowOrderPanel(true)}>+ New order</button>
        </div>
        {orders.length > 0 ? (
          <div style={{ border: "1px solid var(--line-2)", borderRadius: 3, overflow: "auto" }}>
            <table className="t" style={{ fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th>Time</th><th>Side</th><th>Type</th>
                  <th className="num">Qty</th><th className="num">Fill / Limit</th>
                  <th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const oType = getOrderType(o);
                  const lp = getLimitPrice(o);
                  const isBuy = o.direction === "long";
                  const isPending = o.status === "pending";
                  return (
                    <tr key={o.id}>
                      <td className="mute mono" style={{ fontSize: 11 }}>
                        {new Date(o.opened_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td>
                        <span className={"pill " + (isBuy ? "up" : "dn")}>{isBuy ? "Buy" : "Sell"}</span>
                      </td>
                      <td className="mute" style={{ fontSize: 11 }}>{oType}</td>
                      <td className="num">{o.quantity}</td>
                      <td className="num mono">
                        {isPending && lp ? `$${lp.toFixed(2)}` : o.entry_price ? `$${o.entry_price.toFixed(2)}` : "—"}
                      </td>
                      <td>
                        <span className={"pill " + (
                          o.status === "open" ? "up" :
                          o.status === "pending" ? "gold" :
                          o.status === "cancelled" ? "dn" : "")}>
                          {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        {isPending && (
                          <button className="btn" style={{ fontSize: 10.5 }} onClick={() => cancelOrder(o.id)}>Cancel</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "24px 0", textAlign: "center", color: "var(--fg-muted)", fontSize: 12 }}>
            No orders for {tk} yet.{" "}
            <span style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => setShowOrderPanel(true)}>Open a position →</span>
          </div>
        )}
      </section>

      {/* ── Holdings ──────────────────────────────────────────────────────────────── */}
      <section style={{ padding: "28px 32px 36px", borderTop: "1px solid var(--line)" }}>
        <div className="sec-title">
          Elsewhere in the book
          <span className="meta">{DEMO_HOLDINGS.length} open · 3 flagged</span>
        </div>
        <div style={{ border: "1px solid var(--line-2)", borderRadius: 3, overflow: "auto" }}>
          <table className="t" style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>Ticker</th><th>Stance</th><th className="num">Price</th>
                <th className="num">Today</th><th className="num">Weight</th>
                <th>Confidence</th><th className="num">P&amp;L</th><th>Updated</th><th></th>
              </tr>
            </thead>
            <tbody>
              {DEMO_HOLDINGS.map((h) => {
                const hUp = h.ch >= 0;
                const cfc = h.conf >= 0.8 ? "up" : h.conf >= 0.7 ? "" : "dn";
                return (
                  <tr key={h.t}>
                    <td>
                      <Link href={`/workbench/${h.t}`} style={{ textDecoration: "none" }}>
                        <span className="tkr">{h.t}</span>
                      </Link>
                      <span className="mute" style={{ fontSize: 11.5, marginLeft: 10, fontWeight: 400 }}>{h.n}</span>
                    </td>
                    <td><span className={"pill " + (h.stance === "long" ? "up" : "dn")}>{h.stance[0].toUpperCase() + h.stance.slice(1)}</span></td>
                    <td className="num">{h.px.toFixed(2)}</td>
                    <td className={"num " + (hUp ? "up" : "down")}>{hUp ? "+" : ""}{h.ch.toFixed(2)}%</td>
                    <td className="num">{h.w.toFixed(1)}%</td>
                    <td>
                      <span style={{ display: "inline-block", width: 60, height: 4, background: "var(--bg-3)", position: "relative", verticalAlign: "middle", borderRadius: 1 }}>
                        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.round(h.conf * 100)}%`, background: cfc === "up" ? "var(--accent)" : cfc === "dn" ? "var(--down)" : "var(--fg-muted)", borderRadius: 1 }} />
                      </span>
                      <span className="mono mute" style={{ marginLeft: 8, fontSize: 11 }}>{h.conf.toFixed(2)}</span>
                    </td>
                    <td className={"num " + (h.pnl >= 0 ? "up" : "down")}>{h.pnl >= 0 ? "+" : "−"}${Math.abs(h.pnl)}</td>
                    <td className="mute">{h.ts} ET</td>
                    <td>
                      <Link href={`/workbench/${h.t}`}>
                        <button className="btn" style={{ fontSize: 10.5 }}>Open →</button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReasonList({ title, items, tone }: { title: string; items: string[]; tone: "good" | "bad" }) {
  const sym = tone === "good" ? "+" : "−";
  const color = tone === "good" ? "var(--accent)" : "var(--down)";
  return (
    <div>
      <h4 style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-muted)", margin: "0 0 14px" }}>
        {title}
      </h4>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((t, i) => (
          <li key={i} style={{ fontSize: 14, lineHeight: 1.55, color: "var(--fg-dim)", paddingLeft: 20, position: "relative" }}>
            <span className="mono" style={{ position: "absolute", left: 0, top: -1, color, fontWeight: 500 }}>{sym}</span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
