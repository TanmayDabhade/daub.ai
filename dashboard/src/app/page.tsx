"use client";

import { useEffect, useState } from "react";
import PulseStrip from "@/components/PulseStrip";
import PortfolioChart from "@/components/PortfolioChart";
import SectorDonut from "@/components/SectorDonut";
import FearGreedGauge from "@/components/FearGreedGauge";
import ConfBar from "@/components/ConfBar";
import { supabase } from "@/lib/supabase";
import type { PortfolioSnapshot, Position, Trade } from "@/lib/types";

function makeDemoChart() {
  return Array.from({ length: 90 }, (_, i) => ({
    date: `Day ${i + 1}`,
    value: Math.round(100000 + i * 110 + Math.sin(i / 7) * 3200 + Math.sin(i / 3.3 + 0.7) * 1400),
  }));
}

const DEMO_POSITIONS: Position[] = [
  { ticker: "NVDA", qty: 15, side: "long",  avg_entry_price: 875.5,  current_price: 892.3,  market_value: 13384.5, unrealized_pnl: 252,  unrealized_pnl_pct: 0.019 },
  { ticker: "AAPL", qty: 30, side: "long",  avg_entry_price: 198.2,  current_price: 195.8,  market_value: 5874.0,  unrealized_pnl: -72,  unrealized_pnl_pct: -0.012 },
  { ticker: "JPM",  qty: 20, side: "long",  avg_entry_price: 215.0,  current_price: 221.5,  market_value: 4430.0,  unrealized_pnl: 130,  unrealized_pnl_pct: 0.030 },
  { ticker: "XOM",  qty: 25, side: "short", avg_entry_price: 118.4,  current_price: 115.2,  market_value: 2880.0,  unrealized_pnl: 80,   unrealized_pnl_pct: 0.027 },
  { ticker: "LLY",  qty: 8,  side: "long",  avg_entry_price: 812.0,  current_price: 828.4,  market_value: 6627.2,  unrealized_pnl: 131,  unrealized_pnl_pct: 0.020 },
  { ticker: "TSLA", qty: 12, side: "short", avg_entry_price: 362.0,  current_price: 348.55, market_value: 4182.6,  unrealized_pnl: 161,  unrealized_pnl_pct: 0.037 },
  { ticker: "GS",   qty: 6,  side: "long",  avg_entry_price: 598.4,  current_price: 612.8,  market_value: 3676.8,  unrealized_pnl: 86,   unrealized_pnl_pct: 0.024 },
];

const THESIS: Record<string, string> = {
  NVDA: "Datacenter capex surge; 10-Q shows 122% YoY revenue growth.",
  AAPL: "Services margin expansion offset by iPhone weakness in China.",
  JPM:  "NII up, credit provisions normalizing post-cycle.",
  XOM:  "Crude demand softening, OPEC+ spare capacity overhang.",
  LLY:  "GLP-1 franchise; Zepbound label expansion; Q3 raise.",
  TSLA: "Delivery miss risk; robotaxi priced in; margin compression.",
  GS:   "IB fee recovery, prime brokerage strength, buyback pace.",
};

const CONF: Record<string, number> = {
  NVDA: 0.87, AAPL: 0.62, JPM: 0.78, XOM: 0.71, LLY: 0.91, TSLA: 0.68, GS: 0.74,
};

const HELD: Record<string, string> = {
  NVDA: "12d", AAPL: "31d", JPM: "22d", XOM: "8d", LLY: "45d", TSLA: "5d", GS: "18d",
};

const SECT: Record<string, string> = {
  NVDA: "tech", AAPL: "tech", JPM: "fin", XOM: "ener", LLY: "hlth", TSLA: "tech", GS: "fin",
};

const SECT_COLOR: Record<string, string> = {
  tech: "var(--s-tech)", fin: "var(--s-fin)", hlth: "var(--s-hlth)",
  indu: "var(--s-indu)", cons: "var(--s-cons)", ener: "var(--s-ener)", def: "var(--s-def)",
};

const DEMO_NEWS = [
  { ts: "14:32", src: "REUT", tk: "NVDA", h: "Nvidia books 'several billion' in Saudi AI chip orders; Humain deal widens" },
  { ts: "14:28", src: "BBG",  tk: "META", h: "Meta FTC probe expands to Threads data practices, sources say" },
  { ts: "14:21", src: "DJ",   tk: "LLY",  h: "Eli Lilly Zepbound wins expanded label for sleep apnea in obese adults" },
  { ts: "14:14", src: "FT",   tk: "XOM",  h: "OPEC+ signals possible Q1 output hold as Brent slides below $72" },
  { ts: "14:08", src: "REUT", tk: "TSLA", h: "Wells Fargo cuts Tesla Q4 delivery estimate on China softness" },
  { ts: "13:54", src: "BBG",  tk: "JPM",  h: "JPMorgan Dimon says consumer resilient, commercial real estate 'uneven'" },
];

const DEMO_EARNINGS = [
  { date: "TUE 04/21", tk: "NVDA", eps: "5.89", wh: "HIGH" },
  { date: "WED 04/22", tk: "MSFT", eps: "3.42", wh: "HIGH" },
  { date: "WED 04/22", tk: "META", eps: "5.21", wh: "MED" },
  { date: "THU 04/23", tk: "AAPL", eps: "2.38", wh: "HIGH" },
  { date: "THU 04/23", tk: "AMZN", eps: "1.49", wh: "MED" },
  { date: "FRI 04/24", tk: "XOM",  eps: "1.82", wh: "MED" },
];

const TODAY_TRADES = [
  { t: "14:29", dir: "Buy",   tk: "AVGO", sz: "40bp", c: 0.88 },
  { t: "13:47", dir: "Sell",  tk: "TSLA", sz: "30bp", c: 0.68 },
  { t: "11:22", dir: "Buy",   tk: "LLY",  sz: "20bp", c: 0.91 },
  { t: "10:08", dir: "Cover", tk: "XOM",  sz: "10bp", c: 0.71 },
  { t: "09:34", dir: "Buy",   tk: "NVDA", sz: "25bp", c: 0.87 },
];

function Sparkline({ data, w = 70, h = 20 }: { data: number[]; w?: number; h?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / rng) * h]);
  const last = data[data.length - 1], first = data[0];
  const c = last >= first ? "var(--up)" : "var(--down)";
  const polyline = pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <polygon points={`0,${h} ${polyline} ${w},${h}`} fill={c} opacity="0.15" />
      <polyline points={polyline} fill="none" stroke={c} strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  );
}

function Kpi({ l, v, cls }: { l: string; v: string; cls?: string }) {
  return (
    <div>
      <div className="mute" style={{ fontSize: 10.5 }}>{l}</div>
      <div className={"mono " + (cls || "")} style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{v}</div>
    </div>
  );
}

const CHART_PERIODS = ["1D", "5D", "1M", "3M", "YTD", "1Y", "ALL"];

export default function PortfolioPage() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [positions, setPositions] = useState<Position[]>(DEMO_POSITIONS);
  const [chartData, setChartData] = useState(makeDemoChart);
  const [chartPeriod, setChartPeriod] = useState(2); // "1M"

  useEffect(() => {
    if (!supabase) return;

    supabase.from("portfolio_snapshots").select("*")
      .order("snapshot_at", { ascending: false }).limit(1)
      .then(({ data }) => {
        if (data?.[0]) {
          setSnapshot(data[0]);
          if (data[0].positions) setPositions(data[0].positions);
        }
      });

    supabase.from("portfolio_snapshots").select("total_value, snapshot_at")
      .order("snapshot_at", { ascending: true }).limit(90)
      .then(({ data }) => {
        if (data?.length) {
          setChartData(data.map((d) => ({
            date: new Date(d.snapshot_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            value: d.total_value,
          })));
        }
      });

    const channel = supabase.channel("portfolio-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "portfolio_snapshots" },
        (payload) => {
          setSnapshot(payload.new as PortfolioSnapshot);
          const p = (payload.new as PortfolioSnapshot).positions;
          if (p) setPositions(p);
        }
      ).subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, []);

  const totalValue = snapshot?.total_value ?? 186742.5;
  const cash = snapshot?.cash ?? 84230;
  const dailyPnl = 2840.3;
  const dailyPnlPct = 1.55;
  const sharpe = snapshot?.sharpe_ratio ?? 1.82;
  const drawdown = -2.8;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PulseStrip />

      {/* Hero KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 14 }}>
        {/* Portfolio value */}
        <div className="card">
          <div style={{ padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span className="mute" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Portfolio value
              </span>
              <span className="pill up" style={{ fontSize: 10 }}>+{dailyPnlPct}% today</span>
            </div>
            <div className="mono" style={{ fontSize: 30, fontWeight: 600, marginTop: 6, letterSpacing: "-0.02em" }}>
              ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 10, fontSize: 11 }}>
              <Kpi l="Today"       v={`+$${dailyPnl.toFixed(0)}`}                cls="up" />
              <Kpi l="Cash"        v={`$${(cash / 1000).toFixed(1)}k`} />
              <Kpi l="Gross"       v="70%" />
              <Kpi l="Sharpe (90d)" v={sharpe.toFixed(2)}                        cls="acc" />
            </div>
          </div>
        </div>

        {/* Win rate */}
        <div className="card">
          <div className="card-head"><h3>Win rate · 30d</h3></div>
          <div style={{ padding: "12px 16px 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <span className="mono up" style={{ fontSize: 24, fontWeight: 600 }}>
                67<span style={{ fontSize: 14 }}>%</span>
              </span>
              <span className="mute" style={{ fontSize: 11, marginBottom: 5 }}>of 486 trades</span>
            </div>
            <div style={{ display: "flex", gap: 2, marginTop: 10 }}>
              {Array.from({ length: 30 }).map((_, i) => {
                const hit = [0,3,4,6,7,9,10,11,13,14,16,17,19,20,22,23,25,26,27,29].includes(i);
                return (
                  <div key={i} style={{
                    flex: 1, height: 20, borderRadius: 2,
                    background: hit ? "var(--up)" : "var(--bg-3)",
                  }} />
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 9.5 }} className="mute">
              <span>30d ago</span><span>today</span>
            </div>
          </div>
        </div>

        {/* Drawdown */}
        <div className="card">
          <div className="card-head"><h3>Max drawdown</h3></div>
          <div style={{ padding: "12px 16px 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <span className="mono down" style={{ fontSize: 24, fontWeight: 600 }}>
                {drawdown}<span style={{ fontSize: 14 }}>%</span>
              </span>
              <span className="mute" style={{ fontSize: 11, marginBottom: 5 }}>limit −10.0%</span>
            </div>
            <div className="bar" style={{ marginTop: 14 }}>
              <div className="bar-inner" style={{ width: "28%", background: "var(--down)" }} />
            </div>
            <div className="mute" style={{ fontSize: 10.5, marginTop: 6 }}>2.8% of 10% limit used</div>
          </div>
        </div>

        {/* Market regime */}
        <div className="card">
          <div className="card-head"><h3>Market regime</h3></div>
          <div style={{ padding: "12px 16px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="pill acc" style={{ fontSize: 10 }}>◆ TRANSITIONING</span>
            </div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 8 }}>Risk-on forming</div>
            <div className="dim" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.45 }}>
              Fed dovish on 2026 path · 2s/10s un-inverts · conf 0.71
            </div>
          </div>
        </div>
      </div>

      {/* Chart + allocation + sentiment */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14 }}>
        <div className="card">
          <div className="card-head">
            <h3>Equity curve</h3>
            <span className="sub">last 90 days</span>
            <span className="spacer" style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 4 }}>
              {CHART_PERIODS.map((p, i) => (
                <button
                  key={p}
                  className={"btn " + (i === chartPeriod ? "active" : "")}
                  onClick={() => setChartPeriod(i)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: "14px 12px 8px" }}>
            <PortfolioChart data={chartData} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Allocation</h3>
            <span className="sub">by sector</span>
          </div>
          <div style={{ padding: "10px 16px 14px" }}>
            <SectorDonut positions={positions} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Market sentiment</h3>
            <span className="sub">fear / greed</span>
          </div>
          <div style={{ padding: "12px 16px 14px" }}>
            <FearGreedGauge />
          </div>
        </div>
      </div>

      {/* Holdings + Thesis */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <div className="card">
          <div className="card-head">
            <h3>Holdings</h3>
            <span className="sub">{positions.length} positions</span>
            <span className="spacer" style={{ flex: 1 }} />
            <button className="btn">+ New trade</button>
          </div>
          <div style={{ overflow: "auto", maxHeight: 360 }}>
            <table className="t">
              <thead>
                <tr>
                  <th></th>
                  <th>Ticker</th>
                  <th>Side</th>
                  <th className="num">Qty</th>
                  <th className="num">Avg</th>
                  <th className="num">Last</th>
                  <th className="num">Value</th>
                  <th className="num">P&amp;L</th>
                  <th>Conf.</th>
                  <th>7d</th>
                  <th>Held</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p, i) => {
                  const up = p.unrealized_pnl >= 0;
                  const sect = SECT[p.ticker] || "tech";
                  const spark = Array.from({ length: 14 }, (_, j) =>
                    p.avg_entry_price +
                    Math.sin((i + j) / 2.2) * (p.avg_entry_price * 0.012) +
                    (p.current_price - p.avg_entry_price) * (j / 13)
                  );
                  return (
                    <tr key={p.ticker}>
                      <td>
                        <span style={{
                          display: "inline-block", width: 3, height: 18, borderRadius: 2,
                          background: SECT_COLOR[sect] || "var(--fg-muted)",
                        }} />
                      </td>
                      <td>
                        <span className="tkr">{p.ticker}</span>
                      </td>
                      <td>
                        <span className={"pill " + (p.side === "long" ? "up" : "dn")}>
                          {p.side === "long" ? "Long" : "Short"}
                        </span>
                      </td>
                      <td className="num">{p.qty}</td>
                      <td className="num dim">{p.avg_entry_price.toFixed(2)}</td>
                      <td className="num">{p.current_price.toFixed(2)}</td>
                      <td className="num">${p.market_value.toLocaleString()}</td>
                      <td className={"num " + (up ? "up" : "down")}>
                        {up ? "+" : ""}{p.unrealized_pnl.toFixed(0)}
                        <span className="mute" style={{ fontSize: 9.5, marginLeft: 5 }}>
                          {up ? "+" : ""}{(p.unrealized_pnl_pct * 100).toFixed(2)}%
                        </span>
                      </td>
                      <td><ConfBar v={CONF[p.ticker] ?? 0.7} /></td>
                      <td><Sparkline data={spark} /></td>
                      <td className="mute" style={{ fontSize: 11 }}>{HELD[p.ticker] ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Thesis panel */}
        <div className="card">
          <div className="card-head">
            <h3>Why we&apos;re holding</h3>
            <span className="sub">AI-authored</span>
          </div>
          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10, fontSize: 12, maxHeight: 360, overflow: "auto" }}>
            {positions.slice(0, 4).map((p) => (
              <div key={p.ticker} style={{ paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <span className="tkr">{p.ticker}</span>
                  <span className={"pill " + (p.side === "long" ? "up" : "dn")} style={{ fontSize: 9 }}>
                    {p.side === "long" ? "Long" : "Short"}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span className="mute mono" style={{ fontSize: 10 }}>
                    conf {(CONF[p.ticker] ?? 0.7).toFixed(2)}
                  </span>
                </div>
                <div className="dim" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                  {THESIS[p.ticker] ?? "—"}
                </div>
              </div>
            ))}
            <button className="btn" style={{ alignSelf: "flex-start" }}>Explain all positions →</button>
          </div>
        </div>
      </div>

      {/* News + Earnings + Today's trades */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14 }}>
        {/* Headlines */}
        <div className="card">
          <div className="card-head">
            <h3>Headlines</h3>
            <span className="sub">tickers you hold</span>
          </div>
          <div style={{ maxHeight: 260, overflow: "auto" }}>
            <table className="t">
              <tbody>
                {DEMO_NEWS.map((n, i) => (
                  <tr key={i}>
                    <td className="mute mono" style={{ width: 46, fontSize: 11 }}>{n.ts}</td>
                    <td style={{ width: 44 }}><span className="pill" style={{ fontSize: 9 }}>{n.src}</span></td>
                    <td><span className="tkr">{n.tk}</span></td>
                    <td style={{ whiteSpace: "normal", lineHeight: 1.45 }}>{n.h}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Earnings */}
        <div className="card">
          <div className="card-head"><h3>This week&apos;s earnings</h3></div>
          <table className="t">
            <tbody>
              {DEMO_EARNINGS.map((e, i) => (
                <tr key={i}>
                  <td className="mute" style={{ fontSize: 10.5 }}>{e.date}</td>
                  <td><span className="tkr">{e.tk}</span></td>
                  <td className="num mono">{e.eps}</td>
                  <td>
                    <span className={"pill " + (e.wh === "HIGH" ? "acc" : "")} style={{ fontSize: 9 }}>
                      {e.wh === "HIGH" ? "High impact" : "Med"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Today's trades */}
        <div className="card">
          <div className="card-head">
            <h3>Today&apos;s trades</h3>
            <span className="sub">5 fills</span>
          </div>
          <div style={{ padding: "10px 14px", fontSize: 11.5, display: "flex", flexDirection: "column", gap: 7 }}>
            {TODAY_TRADES.map((x, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mute mono" style={{ width: 40, fontSize: 10.5 }}>{x.t}</span>
                <span
                  className={"pill " + (x.dir === "Buy" ? "up" : x.dir === "Sell" ? "dn" : "acc")}
                  style={{ fontSize: 9, width: 52, justifyContent: "center" }}
                >
                  {x.dir}
                </span>
                <span className="tkr" style={{ width: 52 }}>{x.tk}</span>
                <span className="mono mute" style={{ fontSize: 10.5 }}>{x.sz}</span>
                <span style={{ flex: 1 }} />
                <span className="mono mute" style={{ fontSize: 10 }}>{x.c.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
