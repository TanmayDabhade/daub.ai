"use client";

import { useState } from "react";
import ConfBar from "@/components/ConfBar";

const AGENT_PERF = [
  { ag: "FILING", n: 847,  hit: 0.71, sharpe: 1.82, avgConf: 0.78, model: "opus-4.6" },
  { ag: "EARN",   n: 312,  hit: 0.68, sharpe: 1.54, avgConf: 0.74, model: "opus-4.6" },
  { ag: "SENT",   n: 1920, hit: 0.59, sharpe: 0.88, avgConf: 0.64, model: "sonnet-4.6" },
  { ag: "MACRO",  n: 94,   hit: 0.64, sharpe: 1.21, avgConf: 0.71, model: "sonnet-4.6" },
  { ag: "AGGR",   n: 486,  hit: 0.73, sharpe: 2.04, avgConf: 0.81, model: "opus-4.6" },
];

const AGENT_STREAM = [
  { ts: "14:32:08", ag: "FILING", tk: "NVDA", sig: "+", msg: "10-Q filed — data center $30.8B (+122% YoY), GM 75.5%, inventory +41% QoQ signals supply confidence", conf: 0.92 },
  { ts: "14:31:44", ag: "SENT",   tk: "META", sig: "-", msg: "11 news items — Reality Labs Q3 loss widened to $4.5B, FTC probe expands into Threads data use", conf: 0.78 },
  { ts: "14:31:12", ag: "MACRO",  tk: "*",    sig: "~", msg: "Regime TRANSITIONING. Fed minutes dovish on 2026 path; 2s/10s un-inverts; risk-on tilt forming", conf: 0.71 },
  { ts: "14:30:55", ag: "FILING", tk: "PLTR", sig: "+", msg: "10-Q diff — commercial rev +54% YoY; AIP customer count 143 (+31 QoQ); NDR 118%", conf: 0.85 },
  { ts: "14:30:22", ag: "SENT",   tk: "TSLA", sig: "-", msg: "9 items — delivery estimates cut by 3 sell-side shops; robotaxi launch pushed to 2H26", conf: 0.74 },
  { ts: "14:29:58", ag: "AGGR",   tk: "AVGO", sig: "+", msg: "Composite +0.82 conf 0.88 — FILING/SENT/MACRO aligned LONG; size 4.0% cleared risk checks", conf: 0.88 },
  { ts: "14:29:31", ag: "FILING", tk: "LLY",  sig: "+", msg: "8-K — Zepbound label expanded for sleep apnea comorbid obesity; TAM +$8-12B peak", conf: 0.89 },
  { ts: "14:29:04", ag: "RISK",   tk: "*",    sig: "~", msg: "Tech exposure 47% — approaching 50% soft cap; new long adds gated to ≤1.5% notional", conf: 1.00 },
  { ts: "14:28:40", ag: "SENT",   tk: "XOM",  sig: "-", msg: "OPEC+ Q1 quota chatter softening; 14 items bearish skew; sentiment -0.48", conf: 0.66 },
  { ts: "14:28:11", ag: "EARN",   tk: "COST", sig: "+", msg: "Transcript — CFO confirms membership fee hike considered; dodge-detect 0/7 tariff Qs", conf: 0.81 },
  { ts: "14:27:48", ag: "FILING", tk: "GS",   sig: "+", msg: "10-Q — IB fees +42% YoY; equities trading at cycle high; VaR 2% QoQ higher", conf: 0.77 },
  { ts: "14:26:52", ag: "AGGR",   tk: "META", sig: "-", msg: "Conflict: SENT -0.6 vs EARN +0.2. Resolution: SENT weighted higher (recency)", conf: 0.74 },
];

const FILTERS = ["ALL", "FILING", "EARN", "SENT", "MACRO", "AGGR", "RISK"];

const TOKEN_USAGE = [
  { ag: "Filing (opus)",    t: "12.4M", cost: "$186", c: "var(--s-tech)", v: 0.82 },
  { ag: "Aggregator (opus)", t: "8.1M", cost: "$121", c: "var(--s-fin)",  v: 0.54 },
  { ag: "Earnings (opus)",  t: "3.2M",  cost: "$48",  c: "var(--s-hlth)", v: 0.21 },
  { ag: "Sentiment (sonnet)",t: "9.8M", cost: "$29",  c: "var(--s-cons)", v: 0.65 },
  { ag: "Macro (sonnet)",   t: "0.8M",  cost: "$3",   c: "var(--s-def)",  v: 0.05 },
];

export default function AgentsPage() {
  const [filter, setFilter] = useState("ALL");
  const stream = filter === "ALL" ? AGENT_STREAM : AGENT_STREAM.filter((s) => s.ag === filter);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 0.9fr) minmax(0, 2.2fr) minmax(320px, 1fr)", gap: 18 }}>
      {/* Left: agent list + freshness */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="card">
          <div className="card-head">
            <h3>Agents</h3>
            <span className="sub">5 running</span>
          </div>
          <div>
            {AGENT_PERF.map((a, i) => (
              <div
                key={a.ag}
                onClick={() => setFilter(a.ag)}
                style={{
                  padding: "16px 18px",
                  borderBottom: i < AGENT_PERF.length - 1 ? "1px solid var(--line)" : "none",
                  cursor: "pointer",
                  background: filter === a.ag ? "var(--accent-bg)" : "transparent",
                  boxShadow: filter === a.ag ? "inset 2px 0 0 var(--accent)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="dot live" style={{ width: 7, height: 7 }} />
                  <span style={{ fontWeight: 600, textTransform: "capitalize", color: "var(--fg)", fontSize: 14 }}>
                    {a.ag.toLowerCase()}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span className="chip">{a.model}</span>
                </div>
                <div className="mute" style={{ display: "flex", gap: 14, marginTop: 9, fontSize: 11.5 }}>
                  <span>n={a.n}</span>
                  <span>hit <span className="mono up">{(a.hit * 100).toFixed(0)}%</span></span>
                  <span>SR <span className="mono" style={{ color: "var(--fg)" }}>{a.sharpe.toFixed(2)}</span></span>
                </div>
                <div className="bar" style={{ marginTop: 10 }}>
                  <div className="bar-inner" style={{ width: `${a.avgConf * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Freshness</h3>
            <span className="sub">confidence vs staleness</span>
          </div>
          <div style={{ padding: "14px 18px", fontSize: 12.5 }}>
            {[
              { t: "NVDA", age: "4 min",  c: 0.92, f: 1.00 },
              { t: "META", age: "1 hr",   c: 0.74, f: 0.82 },
              { t: "PFE",  age: "2 hr",   c: 0.69, f: 0.68 },
              { t: "CVX",  age: "5 hr",   c: 0.66, f: 0.31 },
              { t: "AAPL", age: "19 hr",  c: 0.58, f: 0.08 },
            ].map((r) => (
              <div key={r.t} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span className="tkr" style={{ width: 52 }}>{r.t}</span>
                <span className="mute mono" style={{ width: 52, fontSize: 11 }}>{r.age}</span>
                <div className="bar" style={{ flex: 1 }}>
                  <div className="bar-inner" style={{
                    width: `${r.f * 100}%`,
                    background: r.f > 0.5 ? "var(--up)" : r.f > 0.2 ? "var(--gold)" : "var(--down)",
                  }} />
                </div>
                <span className="mono" style={{ width: 38, fontSize: 11.5, textAlign: "right" }}>
                  {r.c.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Center: reasoning stream */}
      <div className="card">
        <div className="card-head">
          <h3>Reasoning stream · {filter.toLowerCase()}</h3>
          <span className="sub">{stream.length} events</span>
          <span style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 3 }}>
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={"btn " + (filter === f ? "active" : "")}
                style={{ fontSize: 10 }}
              >
                {f.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        <div style={{ maxHeight: "calc(100vh - 180px)", overflow: "auto" }}>
          {stream.map((e, i) => (
            <div
              key={i}
              style={{
                padding: "14px 20px",
                borderBottom: i < stream.length - 1 ? "1px solid var(--line)" : "none",
                display: "grid",
                gridTemplateColumns: "74px 86px 58px 18px minmax(0,1fr) 80px",
                gap: 14,
                alignItems: "start",
                fontSize: 13,
              }}
            >
              <span className="mute mono" style={{ fontSize: 11 }}>{e.ts}</span>
              <span className="pill acc" style={{ fontSize: 10, alignSelf: "start" }}>{e.ag.toLowerCase()}</span>
              <span className="tkr">{e.tk}</span>
              <span className={e.sig === "+" ? "up" : e.sig === "-" ? "down" : "acc"} style={{ fontWeight: 700 }}>
                {e.sig}
              </span>
              <span style={{ lineHeight: 1.6, color: "var(--fg-dim)", whiteSpace: "normal" }}>{e.msg}</span>
              <span><ConfBar v={e.conf} w={56} /></span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: conflict + token usage */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="card">
          <div className="card-head">
            <h3>Conflict detected</h3>
            <span className="sub">META</span>
          </div>
          <div style={{ padding: "16px 18px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ border: "1px solid var(--line-2)", padding: 14, borderRadius: "var(--r-sm)" }}>
                <div className="mute" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.1em" }}>Sentiment</div>
                <div className="mono down" style={{ fontSize: 22, fontWeight: 600, marginTop: 6 }}>−0.60</div>
                <div className="dim" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
                  FTC probe · Reality Labs burn · ad pricing softness
                </div>
              </div>
              <div style={{ border: "1px solid var(--line-2)", padding: 14, borderRadius: "var(--r-sm)" }}>
                <div className="mute" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.1em" }}>Earnings</div>
                <div className="mono up" style={{ fontSize: 22, fontWeight: 600, marginTop: 6 }}>+0.20</div>
                <div className="dim" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
                  DAU +4%, ARPU steady, 2026 capex in-line
                </div>
              </div>
            </div>
            <div style={{
              marginTop: 12, padding: 14,
              border: "1px solid var(--accent)", background: "var(--accent-bg)",
              borderRadius: "var(--r-sm)", fontSize: 12.5, lineHeight: 1.55,
            }}>
              <div className="acc" style={{ fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Resolution
              </div>
              <div style={{ marginTop: 6, color: "var(--fg-dim)" }}>
                Sentiment weighted higher (recency + material event count). Composite{" "}
                <span className="mono down">−0.64</span>, confidence{" "}
                <span className="mono">0.74</span>.
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Token usage · 24h</h3>
            <span style={{ flex: 1 }} />
            <span className="mono acc" style={{ fontSize: 13, fontWeight: 500 }}>$387</span>
          </div>
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14, fontSize: 12.5 }}>
            {TOKEN_USAGE.map((r, i) => (
              <div key={i}>
                <div style={{ display: "flex", alignItems: "baseline" }}>
                  <span style={{ flex: 1, color: "var(--fg)" }}>{r.ag}</span>
                  <span className="mono mute">{r.t}</span>
                  <span className="mono" style={{ marginLeft: 14, width: 48, textAlign: "right", color: "var(--fg)" }}>{r.cost}</span>
                </div>
                <div className="bar" style={{ marginTop: 7 }}>
                  <div className="bar-inner" style={{ width: `${r.v * 100}%`, background: r.c }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
