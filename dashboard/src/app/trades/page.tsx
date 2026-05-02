"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ConfBar from "@/components/ConfBar";
import type { SimOrder } from "@/lib/types";


interface BacktestStats {
  finalValue: number;
  totalReturn: number;
  totalPnl: number;
  maxDrawdown: number;
  sharpe: number;
  winRate: number;
  numTrades: number;
}

interface BacktestResult {
  stats: BacktestStats;
  equityCurve: { date: string; value: number; drawdown: number }[];
  trades: { date: string; action: string; price: number; shares: number; pnl: number | null }[];
}

const DEMO_BLOTTER = [
  { id: "#2847", ts: "14:29", tk: "AVGO", dir: "Buy",    qty: 4,  px: 1846.20, n: 7384.80,  st: "Filled",   c: 0.88, lat: "124 ms" },
  { id: "#2846", ts: "13:47", tk: "TSLA", dir: "Sell",   qty: 12, px: 348.55,  n: 4182.60,  st: "Filled",   c: 0.68, lat: "98 ms" },
  { id: "#2845", ts: "11:22", tk: "LLY",  dir: "Buy",    qty: 3,  px: 826.10,  n: 2478.30,  st: "Filled",   c: 0.91, lat: "156 ms" },
  { id: "#2844", ts: "10:08", tk: "XOM",  dir: "Cover",  qty: 10, px: 115.80,  n: 1158.00,  st: "Partial",  c: 0.71, lat: "212 ms" },
  { id: "#2843", ts: "09:34", tk: "NVDA", dir: "Buy",    qty: 5,  px: 889.40,  n: 4447.00,  st: "Filled",   c: 0.87, lat: "88 ms" },
  { id: "#2842", ts: "09:31", tk: "GS",   dir: "Buy",    qty: 2,  px: 610.50,  n: 1221.00,  st: "Rejected", c: 0.64, lat: "44 ms" },
];

// ── Backtest panel ────────────────────────────────────────────────────────
function BacktestPanel() {
  const [symbol, setSymbol] = useState("NVDA");
  const [strategy, setStrategy] = useState("sma_crossover");
  const [startDate, setStartDate] = useState("2023-01-01");
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [capital, setCapital] = useState("100000");
  const [fastPeriod, setFastPeriod] = useState("20");
  const [slowPeriod, setSlowPeriod] = useState("50");
  const [rsiOversold, setRsiOversold] = useState("30");
  const [rsiOverbought, setRsiOverbought] = useState("70");
  const [macdFast, setMacdFast] = useState("12");
  const [macdSlow, setMacdSlow] = useState("26");
  const [macdSignal, setMacdSignal] = useState("9");
  const [bbPeriod, setBbPeriod] = useState("20");
  const [bbStd, setBbStd] = useState("2");
  const [momPeriod, setMomPeriod] = useState("20");
  const [momThreshold, setMomThreshold] = useState("5");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params: Record<string, number> = {};
      if (strategy === "sma_crossover") {
        params.fastPeriod = parseInt(fastPeriod);
        params.slowPeriod = parseInt(slowPeriod);
      } else if (strategy === "rsi_mean_revert") {
        params.rsiOversold = parseInt(rsiOversold);
        params.rsiOverbought = parseInt(rsiOverbought);
      } else if (strategy === "macd") {
        params.macdFast = parseInt(macdFast);
        params.macdSlow = parseInt(macdSlow);
        params.macdSignal = parseInt(macdSignal);
      } else if (strategy === "bollinger") {
        params.bbPeriod = parseInt(bbPeriod);
        params.bbStd = parseFloat(bbStd);
      } else if (strategy === "momentum") {
        params.momPeriod = parseInt(momPeriod);
        params.momThreshold = parseFloat(momThreshold);
      }
      const body = {
        symbol: symbol.toUpperCase(),
        strategy,
        params,
        startDate,
        endDate,
        initialCapital: parseInt(capital),
      };
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Backtest failed");
      else setResult(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <h3>Backtest Simulator</h3>
        <span className="sub">historical strategy simulation · Yahoo Finance data</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
        {/* Config */}
        <div style={{ padding: "16px 18px", borderRight: "1px solid var(--line)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 11.5 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div className="mute" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Symbol</div>
                <input
                  value={symbol} onChange={(e) => setSymbol(e.target.value)}
                  style={{
                    width: "100%", padding: "6px 10px",
                    background: "var(--bg-2)", border: "1px solid var(--line-2)",
                    borderRadius: "var(--r-sm)", color: "var(--fg)",
                    fontFamily: "var(--mono)", fontSize: 13,
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div className="mute" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Capital ($)</div>
                <input
                  value={capital} onChange={(e) => setCapital(e.target.value)}
                  style={{
                    width: "100%", padding: "6px 10px",
                    background: "var(--bg-2)", border: "1px solid var(--line-2)",
                    borderRadius: "var(--r-sm)", color: "var(--fg)", fontSize: 12,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mute" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Strategy</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {[
                  { v: "sma_crossover",   l: "SMA X" },
                  { v: "rsi_mean_revert", l: "RSI" },
                  { v: "macd",            l: "MACD" },
                  { v: "bollinger",       l: "Bollinger" },
                  { v: "momentum",        l: "Momentum" },
                  { v: "buy_hold",        l: "Buy & Hold" },
                ].map((s) => (
                  <button
                    key={s.v}
                    className={"btn " + (strategy === s.v ? "active" : "")}
                    onClick={() => setStrategy(s.v)}
                    style={{ fontSize: 10.5 }}
                  >
                    {s.l}
                  </button>
                ))}
              </div>
            </div>

            {strategy === "sma_crossover" && (
              <div style={{ display: "flex", gap: 10 }}>
                <div>
                  <div className="mute" style={{ fontSize: 10, marginBottom: 4 }}>Fast SMA</div>
                  <input value={fastPeriod} onChange={(e) => setFastPeriod(e.target.value)}
                    style={{ width: 64, padding: "5px 8px", background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", color: "var(--fg)", fontSize: 12 }} />
                </div>
                <div>
                  <div className="mute" style={{ fontSize: 10, marginBottom: 4 }}>Slow SMA</div>
                  <input value={slowPeriod} onChange={(e) => setSlowPeriod(e.target.value)}
                    style={{ width: 64, padding: "5px 8px", background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", color: "var(--fg)", fontSize: 12 }} />
                </div>
              </div>
            )}

            {strategy === "rsi_mean_revert" && (
              <div style={{ display: "flex", gap: 10 }}>
                <div>
                  <div className="mute" style={{ fontSize: 10, marginBottom: 4 }}>RSI Oversold</div>
                  <input value={rsiOversold} onChange={(e) => setRsiOversold(e.target.value)}
                    style={{ width: 64, padding: "5px 8px", background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", color: "var(--fg)", fontSize: 12 }} />
                </div>
                <div>
                  <div className="mute" style={{ fontSize: 10, marginBottom: 4 }}>RSI Overbought</div>
                  <input value={rsiOverbought} onChange={(e) => setRsiOverbought(e.target.value)}
                    style={{ width: 64, padding: "5px 8px", background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", color: "var(--fg)", fontSize: 12 }} />
                </div>
              </div>
            )}

            {strategy === "macd" && (
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { l: "Fast EMA", v: macdFast, s: setMacdFast },
                  { l: "Slow EMA", v: macdSlow, s: setMacdSlow },
                  { l: "Signal",   v: macdSignal, s: setMacdSignal },
                ].map(({ l, v, s }) => (
                  <div key={l}>
                    <div className="mute" style={{ fontSize: 10, marginBottom: 4 }}>{l}</div>
                    <input value={v} onChange={(e) => s(e.target.value)}
                      style={{ width: 56, padding: "5px 8px", background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", color: "var(--fg)", fontSize: 12 }} />
                  </div>
                ))}
              </div>
            )}

            {strategy === "bollinger" && (
              <div style={{ display: "flex", gap: 10 }}>
                <div>
                  <div className="mute" style={{ fontSize: 10, marginBottom: 4 }}>Period</div>
                  <input value={bbPeriod} onChange={(e) => setBbPeriod(e.target.value)}
                    style={{ width: 64, padding: "5px 8px", background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", color: "var(--fg)", fontSize: 12 }} />
                </div>
                <div>
                  <div className="mute" style={{ fontSize: 10, marginBottom: 4 }}>Std Dev</div>
                  <input value={bbStd} onChange={(e) => setBbStd(e.target.value)}
                    style={{ width: 64, padding: "5px 8px", background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", color: "var(--fg)", fontSize: 12 }} />
                </div>
              </div>
            )}

            {strategy === "momentum" && (
              <div style={{ display: "flex", gap: 10 }}>
                <div>
                  <div className="mute" style={{ fontSize: 10, marginBottom: 4 }}>Lookback</div>
                  <input value={momPeriod} onChange={(e) => setMomPeriod(e.target.value)}
                    style={{ width: 64, padding: "5px 8px", background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", color: "var(--fg)", fontSize: 12 }} />
                </div>
                <div>
                  <div className="mute" style={{ fontSize: 10, marginBottom: 4 }}>Threshold %</div>
                  <input value={momThreshold} onChange={(e) => setMomThreshold(e.target.value)}
                    style={{ width: 64, padding: "5px 8px", background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", color: "var(--fg)", fontSize: 12 }} />
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div className="mute" style={{ fontSize: 10, marginBottom: 4 }}>Start Date</div>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  style={{ width: "100%", padding: "5px 8px", background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", color: "var(--fg)", fontSize: 12 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="mute" style={{ fontSize: 10, marginBottom: 4 }}>End Date</div>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  style={{ width: "100%", padding: "5px 8px", background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", color: "var(--fg)", fontSize: 12 }} />
              </div>
            </div>

            <button
              className="btn active"
              style={{ padding: "9px" }}
              onClick={run}
              disabled={loading}
            >
              {loading ? "Running backtest…" : "▶ Run Backtest"}
            </button>

            {error && (
              <div style={{ padding: 10, background: "var(--down-bg)", borderRadius: "var(--r-sm)", color: "var(--down)", fontSize: 11.5 }}>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div style={{ padding: "16px 18px" }}>
          {!result && !loading && (
            <div style={{ textAlign: "center", color: "var(--fg-muted)", paddingTop: 32, fontSize: 12 }}>
              Configure and run a backtest to see results
            </div>
          )}
          {loading && (
            <div style={{ textAlign: "center", color: "var(--fg-muted)", paddingTop: 32, fontSize: 12 }}>
              Running backtest…
            </div>
          )}
          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { l: "Total Return",  v: `${result.stats.totalReturn >= 0 ? "+" : ""}${result.stats.totalReturn}%`, cls: result.stats.totalReturn >= 0 ? "up" : "down" },
                  { l: "CAGR",          v: `${(result.stats as Record<string,number>).cagr >= 0 ? "+" : ""}${((result.stats as Record<string,number>).cagr ?? 0).toFixed(1)}%`, cls: (result.stats as Record<string,number>).cagr >= 0 ? "up" : "down" },
                  { l: "Sharpe Ratio",  v: result.stats.sharpe.toFixed(2), cls: result.stats.sharpe >= 1 ? "up" : "" },
                  { l: "Max Drawdown",  v: `${result.stats.maxDrawdown.toFixed(1)}%`, cls: "down" },
                  { l: "Win Rate",      v: `${result.stats.winRate}%`, cls: result.stats.winRate >= 50 ? "up" : "down" },
                  { l: "Total Trades",  v: String(result.stats.numTrades), cls: "" },
                  { l: "Net P&L",       v: `$${result.stats.totalPnl.toLocaleString()}`, cls: result.stats.totalPnl >= 0 ? "up" : "down" },
                ].map((s) => (
                  <div key={s.l} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: "8px 10px" }}>
                    <div className="mute" style={{ fontSize: 10 }}>{s.l}</div>
                    <div className={"mono " + s.cls} style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{s.v}</div>
                  </div>
                ))}
              </div>

              {/* Trade log */}
              <div>
                <div className="mute" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  Trades ({result.trades.length})
                </div>
                <div style={{ maxHeight: 160, overflow: "auto" }}>
                  <table className="t" style={{ fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Action</th>
                        <th className="num">Price</th>
                        <th className="num">Shares</th>
                        <th className="num">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map((t, i) => (
                        <tr key={i}>
                          <td className="mute mono" style={{ fontSize: 10.5 }}>{t.date}</td>
                          <td>
                            <span className={"pill " + (t.action === "buy" ? "up" : "dn")} style={{ fontSize: 9 }}>
                              {t.action}
                            </span>
                          </td>
                          <td className="num mono">{t.price.toFixed(2)}</td>
                          <td className="num mono">{t.shares}</td>
                          <td className={"num mono " + (t.pnl == null ? "" : t.pnl >= 0 ? "up" : "down")}>
                            {t.pnl == null ? "—" : `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(0)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Order entry ───────────────────────────────────────────────────────────
function OrderEntry() {
  const [sym, setSym] = useState("NVDA");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState("10");
  const [orderType, setOrderType] = useState("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resp, setResp] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setResp(null);
    try {
      const body = {
        action: "order",
        symbol: sym.toUpperCase(),
        qty: parseInt(qty),
        side,
        type: orderType,
        time_in_force: "day",
        ...(orderType === "limit" && limitPrice ? { limit_price: parseFloat(limitPrice) } : {}),
      };
      const res = await fetch("/api/trading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) setResp(`Error: ${json.error ?? "Order failed"}`);
      else setResp(`✓ Order submitted: ${json.id ?? "OK"} · status ${json.status}`);
    } catch (e) {
      setResp(`Error: ${String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-head"><h3>Manual Order Entry</h3><span className="sub">paper account · sim broker</span></div>
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10, fontSize: 11.5 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, padding: "7px 12px", background: "var(--bg-2)", borderRadius: "var(--r-sm)" }}>
            <div className="mute" style={{ fontSize: 10, marginBottom: 3 }}>SYMBOL</div>
            <input value={sym} onChange={(e) => setSym(e.target.value)}
              style={{ fontFamily: "var(--mono)", fontWeight: 600, fontSize: 13 }} />
          </div>
          <div style={{ flex: 1, padding: "7px 12px", background: "var(--bg-2)", borderRadius: "var(--r-sm)" }}>
            <div className="mute" style={{ fontSize: 10, marginBottom: 3 }}>QTY</div>
            <input value={qty} onChange={(e) => setQty(e.target.value)}
              style={{ fontFamily: "var(--mono)", fontWeight: 600, fontSize: 13 }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {(["buy", "sell"] as const).map((s) => (
            <button key={s} className={"btn " + (side === s ? "active" : "")} onClick={() => setSide(s)}>
              {s.toUpperCase()}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          {(["market", "limit"] as const).map((t) => (
            <button key={t} className={"btn " + (orderType === t ? "active" : "")} onClick={() => setOrderType(t)}>
              {t}
            </button>
          ))}
        </div>

        {orderType === "limit" && (
          <div style={{ padding: "7px 12px", background: "var(--bg-2)", borderRadius: "var(--r-sm)" }}>
            <div className="mute" style={{ fontSize: 10, marginBottom: 3 }}>LIMIT PRICE</div>
            <input value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)}
              placeholder="0.00"
              style={{ fontFamily: "var(--mono)", fontWeight: 600, fontSize: 13 }} />
          </div>
        )}

        <button className="btn active" style={{ padding: 8 }} onClick={submit} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit Order"}
        </button>

        <div className="mute" style={{ fontSize: 10, textAlign: "center" }}>
          Paper account · no real capital at risk
        </div>

        {resp && (
          <div style={{
            padding: 10, borderRadius: "var(--r-sm)", fontSize: 11.5,
            background: resp.startsWith("✓") ? "var(--up-bg)" : "var(--down-bg)",
            color: resp.startsWith("✓") ? "var(--up)" : "var(--down)",
          }}>
            {resp}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Blotter page ──────────────────────────────────────────────────────────
export default function BlotterPage() {
  const [simOrders, setSimOrders] = useState<SimOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [tab, setTab] = useState<"blotter" | "backtest">("blotter");

  useEffect(() => {
    fetch("/api/trading?action=orders")
      .then((r) => r.json())
      .then((data) => { if (data?.orders) setSimOrders(data.orders); })
      .catch(() => {});
  }, []);

  const STATUS_LABEL: Record<string, string> = {
    open: "Filled", pending: "Pending", closed: "Closed", cancelled: "Cancelled",
  };

  const displayRows = simOrders.length
    ? simOrders.map((o) => ({
        id: o.id.slice(0, 8),
        ts: new Date(o.opened_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        tk: o.ticker,
        dir: o.direction === "long" ? "Buy" : "Sell",
        qty: o.quantity,
        px: o.entry_price ?? 0,
        n: (o.entry_price ?? 0) * o.quantity,
        st: STATUS_LABEL[o.status] ?? o.status,
        c: 0.75,
        lat: "—",
      }))
    : DEMO_BLOTTER;

  const filtered = statusFilter === "All"
    ? displayRows
    : displayRows.filter((r) =>
        statusFilter === "Filled" ? r.st.toLowerCase() === "filled" : r.st.toLowerCase() !== "filled"
      );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4 }}>
        <button className={"btn " + (tab === "blotter" ? "active" : "")} onClick={() => setTab("blotter")}>
          ▤ Blotter
        </button>
        <button className={"btn " + (tab === "backtest" ? "active" : "")} onClick={() => setTab("backtest")}>
          ▶ Backtest Simulator
        </button>
      </div>

      {tab === "blotter" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 14 }}>
          {/* Order table */}
          <div className="card">
            <div className="card-head">
              <h3>Blotter</h3>
              <span className="sub">
                {simOrders.length > 0 ? "sim account" : "demo data"}
              </span>
              <span style={{ flex: 1 }} />
              {["All", "Filled", "Pending"].map((f) => (
                <button key={f} className={"btn " + (statusFilter === f ? "active" : "")} onClick={() => setStatusFilter(f)}>
                  {f}
                </button>
              ))}
            </div>
            <div style={{ overflow: "auto" }}>
              <table className="t">
                <thead>
                  <tr>
                    <th>Order</th><th>Time</th><th>Ticker</th><th>Side</th>
                    <th className="num">Qty</th><th className="num">Price</th>
                    <th className="num">Notional</th><th>Status</th>
                    <th>Conf.</th><th>Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="mute mono">{r.id}</td>
                      <td className="mute">{r.ts}</td>
                      <td>
                        <Link href={`/workbench/${r.tk}`} className="tkr" style={{ textDecoration: "none" }}>
                          {r.tk}
                        </Link>
                      </td>
                      <td>
                        <span className={"pill " + (r.dir === "Buy" ? "up" : r.dir === "Sell" ? "dn" : "acc")}>
                          {r.dir}
                        </span>
                      </td>
                      <td className="num">{r.qty}</td>
                      <td className="num">{r.px > 0 ? r.px.toFixed(2) : "—"}</td>
                      <td className="num">{r.n > 0 ? `$${r.n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}</td>
                      <td>
                        <span className={
                          "pill " + (r.st.toLowerCase() === "filled" ? "up" : r.st.toLowerCase() === "rejected" ? "dn" : "gold")
                        }>
                          {r.st}
                        </span>
                      </td>
                      <td><ConfBar v={r.c} /></td>
                      <td className="mute mono" style={{ fontSize: 11 }}>{r.lat}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <OrderEntry />
        </div>
      )}

      {tab === "backtest" && <BacktestPanel />}
    </div>
  );
}
