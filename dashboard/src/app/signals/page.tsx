"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ConfBar from "@/components/ConfBar";
import { supabase } from "@/lib/supabase";
import type { TradeSignal, AgentAnalysis, UnifiedSignal } from "@/lib/types";

const DEMO_SIGNALS = [
  { t: "AVGO", dir: "LONG",  score: +0.82, conf: 0.88, action: "OPEN", sect: "tech", pct: 0.040, conflicts: 0, age: "4m",  agents: ["FILING","SENT","MACRO"],
    why: "Networking silicon leadership; hyperscaler capex visibility through 2027." },
  { t: "PLTR", dir: "LONG",  score: +0.71, conf: 0.79, action: "ADD",  sect: "tech", pct: 0.025, conflicts: 1, age: "11m", agents: ["FILING","SENT"],
    why: "Commercial AIP bookings accelerating; gov-sector moat compounding." },
  { t: "META", dir: "SHORT", score: -0.64, conf: 0.74, action: "OPEN", sect: "tech", pct: 0.030, conflicts: 2, age: "1h",  agents: ["SENT","EARN"],
    why: "Reality Labs burn; ad pricing softness Q3; regulatory tail risk." },
  { t: "CAT",  dir: "LONG",  score: +0.58, conf: 0.71, action: "OPEN", sect: "indu", pct: 0.020, conflicts: 0, age: "23m", agents: ["FILING","MACRO"],
    why: "Mining fleet refresh cycle; backlog +14% QoQ; pricing discipline." },
  { t: "PFE",  dir: "SHORT", score: -0.51, conf: 0.69, action: "OPEN", sect: "hlth", pct: 0.015, conflicts: 1, age: "2h",  agents: ["FILING","SENT"],
    why: "Patent cliff 2026-28; oncology pipeline derisking slower than guided." },
  { t: "COST", dir: "LONG",  score: +0.44, conf: 0.72, action: "HOLD", sect: "cons", pct: 0.018, conflicts: 0, age: "3h",  agents: ["EARN","SENT"],
    why: "Membership renewal 93%; traffic +5.2% comps; pricing power intact." },
  { t: "CVX",  dir: "SHORT", score: -0.38, conf: 0.66, action: "ADD",  sect: "ener", pct: 0.012, conflicts: 0, age: "5h",  agents: ["FILING","MACRO"],
    why: "Refining margin compression; Hess deal synergies back-loaded." },
];

const SECT_COLOR: Record<string, string> = {
  tech: "var(--s-tech)", fin: "var(--s-fin)", hlth: "var(--s-hlth)",
  indu: "var(--s-indu)", cons: "var(--s-cons)", ener: "var(--s-ener)", def: "var(--s-def)",
};

function QRow({ l, v, sub, cls }: { l: string; v: string; sub?: string; cls?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span className="mute" style={{ fontSize: 11, flex: 1 }}>{l}</span>
      <span className={"mono " + (cls || "")} style={{ fontSize: 13, fontWeight: 500 }}>{v}</span>
      {sub && <span className="mute mono" style={{ fontSize: 10 }}>{sub}</span>}
    </div>
  );
}

function Trail({ src, ago, note }: { src: string; ago: string; note: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div>
        <span className="acc" style={{ fontWeight: 500 }}>{src}</span>{" "}
        <span className="mute" style={{ fontSize: 10.5 }}>· {ago}</span>
      </div>
      <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>→ {note}</div>
    </div>
  );
}

function PlanRow({ l, v, extra, cls }: { l: string; v: string; extra?: string; cls?: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      padding: "5px 10px", background: "var(--bg-2)", borderRadius: "var(--r-sm)",
    }}>
      <span className="mute">{l}</span>
      <span>
        <span className={"mono " + (cls || "")}>{v}</span>
        {extra && <span className={"mono " + (cls || "mute")} style={{ fontSize: 10, marginLeft: 5 }}>{extra}</span>}
      </span>
    </div>
  );
}

export default function SignalsPage() {
  const [filter, setFilter] = useState("ALL");
  const filters = ["ALL", "LONG", "SHORT"];

  const filtered = filter === "ALL" ? DEMO_SIGNALS : DEMO_SIGNALS.filter((s) => s.dir === filter);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: 14 }}>
      {/* Left: signal table */}
      <div className="card">
        <div className="card-head">
          <h3>Ranked signals</h3>
          <span className="sub">{DEMO_SIGNALS.length} candidates · min confidence 0.65</span>
          <span className="spacer" style={{ flex: 1 }} />
          {filters.map((f) => (
            <button
              key={f}
              className={"btn " + (filter === f ? "active" : "")}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div style={{ overflow: "auto" }}>
          <table className="t">
            <thead>
              <tr>
                <th>#</th>
                <th></th>
                <th>Ticker</th>
                <th>Direction</th>
                <th>Action</th>
                <th className="num">Score</th>
                <th>Confidence</th>
                <th className="num">Size</th>
                <th>Evidence from</th>
                <th>Age</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.t}>
                  <td className="mute mono">{i + 1}</td>
                  <td>
                    <span style={{
                      display: "inline-block", width: 3, height: 18, borderRadius: 2,
                      background: SECT_COLOR[s.sect] || "var(--fg-muted)",
                    }} />
                  </td>
                  <td><span className="tkr">{s.t}</span></td>
                  <td>
                    <span className={"pill " + (s.dir === "LONG" ? "up" : "dn")}>
                      {s.dir === "LONG" ? "Long" : "Short"}
                    </span>
                  </td>
                  <td>
                    <span className="pill acc">{s.action.charAt(0) + s.action.slice(1).toLowerCase()}</span>
                  </td>
                  <td className={"num " + (s.score >= 0 ? "up" : "down")} style={{ fontWeight: 500 }}>
                    {s.score >= 0 ? "+" : ""}{s.score.toFixed(2)}
                  </td>
                  <td><ConfBar v={s.conf} /></td>
                  <td className="num">{(s.pct * 100).toFixed(1)}%</td>
                  <td>
                    {s.agents.map((a, j) => (
                      <span key={j} className="chip" style={{ marginRight: 3, fontSize: 9.5 }}>
                        {a.toLowerCase()}
                      </span>
                    ))}
                    {s.conflicts > 0 && (
                      <span className="pill gold" style={{ fontSize: 9 }}>⚠ {s.conflicts} conflict</span>
                    )}
                  </td>
                  <td className="mute" style={{ fontSize: 11 }}>{s.age}</td>
                  <td style={{ display: "flex", gap: 3 }}>
                    <button className="btn">Review</button>
                    <button className="btn" style={{ background: "var(--up-bg)", color: "var(--up)", borderColor: "transparent" }}>✓</button>
                    <Link href={`/workbench/${s.t}`} className="btn" style={{ fontSize: 10, whiteSpace: "nowrap" }}>
                      Chart →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Expanded top signal */}
        <div style={{ padding: "18px 20px", background: "var(--bg-1)", borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--accent-bg)", color: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--mono)", fontWeight: 600, fontSize: 13,
            }}>A</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="tkr" style={{ fontSize: 15 }}>AVGO</span>
                <span className="pill up" style={{ fontSize: 10 }}>Long</span>
                <span className="pill solid" style={{ fontSize: 10 }}>Open 4.0% position</span>
              </div>
              <div className="mute" style={{ fontSize: 11, marginTop: 2 }}>
                Broadcom · composite +0.82 · confidence 0.88 · 4 min ago
              </div>
            </div>
            <span style={{ flex: 1 }} />
            <button className="btn">Dismiss</button>
            <button className="btn active">Approve trade</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginTop: 6 }}>
            <div>
              <div className="mute" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                Why
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--fg)" }}>
                Networking silicon leadership compounds as hyperscaler capex visibility extends through 2027.
                Custom ASIC wins at Meta and Google add an estimated $6–8B run-rate by FY26. VMware cross-sell
                is behind plan but unit economics are intact. Three agents align long on fundamentals, news
                flow, and macro regime — no material conflicts.
              </div>
            </div>
            <div>
              <div className="mute" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                Trade plan
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 11.5 }}>
                <PlanRow l="Entry"  v="$1,840 – $1,865" />
                <PlanRow l="Stop"   v="$1,780" extra="(−3.5%)" cls="down" />
                <PlanRow l="Target" v="$2,100" extra="(+12.6%)" cls="up" />
                <PlanRow l="R:R"    v="3.6" cls="acc" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="card">
          <div className="card-head"><h3>Signal quality · 30d</h3></div>
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            <QRow l="Generated"            v="142" />
            <QRow l="Approved by risk"     v="84"    sub="59%" />
            <QRow l="Executed"             v="71"    sub="50%" />
            <QRow l="5-day hit rate"       v="67%"   cls="up" />
            <QRow l="Avg confidence"       v="0.78" />
            <QRow l="Avg realized"         v="+1.24%" cls="up" />
            <QRow l="Edge vs S&P 500"      v="+18bp"  cls="acc" />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Evidence trail</h3>
            <span className="sub">AVGO · today</span>
          </div>
          <div style={{ padding: "12px 16px", fontSize: 11.5, lineHeight: 1.55 }}>
            <div style={{ paddingLeft: 12, borderLeft: "2px solid var(--accent)" }}>
              <Trail src="10-Q filing"   ago="Jul 24"                   note="Networking rev $5.1B (+51%), backlog $29B" />
              <Trail src="News cluster"  ago="72h window · 23 items"    note="Custom silicon wins at 2 hyperscalers confirmed" />
              <Trail src="Macro regime"  ago="risk-on transitioning"    note="Tech tilt positive, semis favored under dovish path" />
              <Trail src="Aggregator"    ago="opus-4.6 · 2.1s"         note="Composite +0.82, no conflicts, size cleared sector cap" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
