"use client";

import { useState } from "react";

function KpiDiff({ l, p, c, d, up, flat }: { l: string; p: string; c: string; d: string; up?: boolean; flat?: boolean }) {
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
      <div className="mute" style={{ fontSize: 10.5 }}>{l}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 3 }}>
        <span className="mute mono" style={{ fontSize: 11 }}>{p}</span>
        <span className="mute" style={{ fontSize: 10 }}>→</span>
        <span className="mono" style={{ fontSize: 15, fontWeight: 500 }}>{c}</span>
      </div>
      <div className={"mono " + (up ? "up" : flat ? "acc" : "down")} style={{ fontSize: 11, marginTop: 2 }}>{d}</div>
    </div>
  );
}

function FlowRow({ c, d, sz, up }: { c: string; d: string; sz: string; up?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className="mono" style={{ flex: 1 }}>NVDA {c}</span>
      <span className={up ? "up" : "down"} style={{ fontSize: 11, fontWeight: 500 }}>{d}</span>
      <span className="mute mono" style={{ fontSize: 10.5 }}>{sz}</span>
    </div>
  );
}

const NAV_ITEMS = [
  { k: "overview",  l: "Overview",              a: false },
  { k: "10q",       l: "10-Q filing diff",       a: true,  tag: "New" },
  { k: "earnings",  l: "Earnings call",          a: false },
  { k: "news",      l: "News cluster",           a: false },
  { k: "peers",     l: "Peer comparison",        a: false },
  { k: "options",   l: "Options flow",           a: false },
  { k: "insider",   l: "Insider transactions",   a: false },
  { k: "short",     l: "Short interest",         a: false },
];

const MATERIAL_CHANGES = [
  { s: "+", t: "Data center margin expanded 60 bp QoQ on Blackwell ramp mix.", e: "p.42 · MD&A" },
  { s: "+", t: "Sovereign AI backlog disclosed at ~$8B (new).", e: "p.47" },
  { s: "~", t: "Inventory +41% QoQ — management framed as GB200 pre-positioning.", e: "p.19" },
  { s: "-", t: "China restricted revenue now 8% of data center (was 12%).", e: "p.44" },
  { s: "+", t: "Guidance floor raised $1.5B vs consensus midpoint.", e: "p.51" },
  { s: "~", t: "Stock-based comp steady at 10.8% of revenue — dilution ongoing.", e: "p.23" },
  { s: "-", t: "New risk factor: top-4 customers now 46% of revenue (concentration).", e: "p.58" },
];

export default function ResearchPage() {
  const [activeNav, setActiveNav] = useState("10q");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "230px 1fr 320px", gap: 14 }}>
      {/* Left nav */}
      <div className="card">
        <div className="card-head"><h3>Research · NVDA</h3></div>
        <div style={{ padding: "8px 0" }}>
          {NAV_ITEMS.map((n) => {
            const active = activeNav === n.k;
            return (
              <div
                key={n.k}
                onClick={() => setActiveNav(n.k)}
                style={{
                  padding: "8px 16px",
                  borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                  background: active ? "var(--accent-bg)" : "transparent",
                  color: active ? "var(--accent-hi)" : "var(--fg-dim)",
                  cursor: "pointer",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ flex: 1 }}>{n.l}</span>
                {n.tag && <span className="pill acc" style={{ fontSize: 9 }}>{n.tag}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Center: 10-Q diff */}
      <div className="card">
        <div className="card-head">
          <h3>10-Q diff · NVDA</h3>
          <span className="sub">Q3 FY26 vs Q2 FY26</span>
          <span className="chip" style={{ marginLeft: 6 }}>AI-annotated</span>
          <span className="chip" style={{ marginLeft: 4 }}>SEC EDGAR</span>
        </div>
        <div style={{ padding: "14px 18px", fontSize: 12, lineHeight: 1.55, overflow: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            <KpiDiff l="Revenue"      p="$30.0B" c="$35.1B" d="+17.0%" up />
            <KpiDiff l="Data center"  p="$26.3B" c="$30.8B" d="+17.1%" up />
            <KpiDiff l="Gross margin" p="75.0%"  c="75.5%"  d="+50 bp" up />
            <KpiDiff l="Op margin"    p="62.0%"  c="62.4%"  d="+40 bp" up />
            <KpiDiff l="Inventory"    p="$10.1B" c="$14.2B" d="+40.6%" flat />
            <KpiDiff l="R&D"          p="$3.4B"  c="$3.8B"  d="+11.8%" flat />
          </div>

          <div className="acc" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 8 }}>
            Material changes · 7
          </div>

          {MATERIAL_CHANGES.map((d, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "20px 1fr 120px", gap: 10,
              padding: "8px 0", borderBottom: "1px solid var(--line)",
            }}>
              <span className={d.s === "+" ? "up" : d.s === "-" ? "down" : "acc"} style={{ fontWeight: 700 }}>{d.s}</span>
              <span>{d.t}</span>
              <span className="mute mono" style={{ fontSize: 10 }}>{d.e}</span>
            </div>
          ))}

          <div style={{
            marginTop: 16, padding: 14,
            background: "var(--bg-1)", border: "1px solid var(--line-2)",
            borderRadius: "var(--r-sm)",
          }}>
            <div className="acc" style={{ fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Claude summary · opus-4.6
            </div>
            <div style={{ marginTop: 6, lineHeight: 1.6 }}>
              This quarter extends the &quot;data-center super-cycle&quot; narrative with a higher-quality print:
              margin expansion, demonstrably larger backlog, and a guidance raise that outpaces consensus.
              Two quality flags — inventory build and customer concentration — warrant watching, but both
              have coherent management explanations. Recommendation:{" "}
              <span className="acc" style={{ fontWeight: 600 }}>Buy / add</span> at 3–5%
              position size, confidence <span className="mono">0.92</span>.
            </div>
          </div>
        </div>
      </div>

      {/* Right: peer snapshot + options flow */}
      <div className="card">
        <div className="card-head"><h3>Peer snapshot</h3></div>
        <table className="t">
          <thead>
            <tr>
              <th>Ticker</th>
              <th className="num">P/E</th>
              <th className="num">Growth</th>
              <th className="num">GM</th>
              <th>YTD</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["NVDA", "48.2", "+112%", "75.5%", "+42%", true],
              ["AMD",  "32.8", "+38%",  "51.2%", "+18%", true],
              ["AVGO", "42.1", "+47%",  "63.4%", "+35%", true],
              ["INTC", "—",    "−6%",   "32.1%", "−22%", false],
              ["MRVL", "38.6", "+29%",  "48.2%", "+11%", true],
              ["TSM",  "24.4", "+31%",  "53.1%", "+28%", true],
            ].map((r) => (
              <tr key={r[0] as string}>
                <td><span className="tkr">{r[0]}</span></td>
                <td className="num">{r[1]}</td>
                <td className={"num " + ((r[2] as string).startsWith("+") ? "up" : "down")}>{r[2]}</td>
                <td className="num">{r[3]}</td>
                <td>
                  <span className={"mono " + ((r[4] as string).startsWith("+") ? "up" : "down")} style={{ fontSize: 11 }}>
                    {r[4]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--line)" }}>
          <div className="acc" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 8 }}>
            Options flow · 24h
          </div>
          <div style={{ fontSize: 11.5, display: "flex", flexDirection: "column", gap: 6 }}>
            <FlowRow c="920 C 05/23" d="Bot 4,820" sz="$12.4M" up />
            <FlowRow c="880 P 05/16" d="Bot 1,140" sz="$2.1M" />
            <FlowRow c="950 C 06/20" d="Bot 3,200" sz="$8.8M" up />
          </div>
          <div className="mute" style={{ fontSize: 10.5, marginTop: 8 }}>Put/Call 0.43 · IV30 44.2 (+2.1)</div>
        </div>
      </div>
    </div>
  );
}
