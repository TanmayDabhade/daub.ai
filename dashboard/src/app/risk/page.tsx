"use client";

import { useState } from "react";

const TICKERS = ["NVDA", "AAPL", "JPM", "XOM", "LLY", "TSLA", "GS"];

function corr(i: number, j: number) {
  if (i === j) return 1;
  const s = (i * 7 + j * 13 + 5) % 100;
  return Math.round(((s / 100) * 1.4 - 0.4) * 100) / 100;
}

function Slider({
  l, v, set, min, max, unit,
}: {
  l: string; v: number; set: (n: number) => void; min: number; max: number; unit: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
        <span style={{ flex: 1, fontSize: 11.5, color: "var(--fg)" }}>{l}</span>
        <span className={"mono " + (v >= 0 ? "up" : "down")} style={{ fontSize: 13, fontWeight: 500 }}>
          {v >= 0 ? "+" : ""}{v}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={v}
        onChange={(e) => set(parseInt(e.target.value))}
        style={{ width: "100%", accentColor: "var(--accent)" }}
      />
    </div>
  );
}

const BETA: Record<string, number> = {
  NVDA: 1.8, AAPL: 1.2, JPM: 1.1, XOM: 0.7, LLY: 0.8, TSLA: 2.1, GS: 1.4,
};
const PORT_VAL = 186742;

const POSITIONS = [
  { t: "NVDA", mv: 13384, side: "LONG" },
  { t: "AAPL", mv: 5874,  side: "LONG" },
  { t: "JPM",  mv: 4430,  side: "LONG" },
  { t: "XOM",  mv: 2880,  side: "SHORT" },
  { t: "LLY",  mv: 6627,  side: "LONG" },
  { t: "TSLA", mv: 4182,  side: "SHORT" },
  { t: "GS",   mv: 3676,  side: "LONG" },
];

export default function RiskPage() {
  const [spx, setSpx] = useState(-10);
  const [rate, setRate] = useState(50);
  const [dxy, setDxy] = useState(2);

  const stress = POSITIONS.map((p) => {
    const b = BETA[p.t] || 1;
    const sg = p.side === "LONG" ? 1 : -1;
    const eq = sg * p.mv * b * (spx / 100);
    const rt = sg * p.mv * (b - 1) * 0.4 * (rate / 100);
    const fx = sg * p.mv * 0.3 * (dxy / 100) * -1;
    return { ...p, b, eq, rt, fx, tot: eq + rt + fx };
  });
  const total = stress.reduce((s, r) => s + r.tot, 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {/* Correlation matrix */}
      <div className="card">
        <div className="card-head">
          <h3>Correlation</h3>
          <span className="sub">7 positions · 90d daily returns</span>
        </div>
        <div style={{ padding: "14px 18px", overflow: "auto" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 2, fontFamily: "var(--mono)", fontSize: 10.5 }}>
            <thead>
              <tr>
                <th></th>
                {TICKERS.map((t) => (
                  <th key={t} style={{ padding: 4, color: "var(--fg-muted)", fontWeight: 500 }}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TICKERS.map((row, i) => (
                <tr key={row}>
                  <th style={{ padding: "4px 8px", textAlign: "left", color: "var(--fg)", fontWeight: 500 }}>{row}</th>
                  {TICKERS.map((col, j) => {
                    const v = corr(i, j);
                    const a = Math.abs(v);
                    const bg = v >= 0
                      ? `rgba(52,211,153,${a.toFixed(2)})`
                      : `rgba(248,113,113,${a.toFixed(2)})`;
                    return (
                      <td key={col} style={{
                        width: 48, height: 28, textAlign: "center",
                        background: bg, borderRadius: "var(--r-xs)",
                        color: a > 0.5 ? "#0c0f14" : "var(--fg)",
                      }}>
                        {v.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 14, fontSize: 11, lineHeight: 1.55, color: "var(--fg-dim)" }}>
            <div className="acc" style={{ fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Clusters detected
            </div>
            <div style={{ marginTop: 4 }}>• Tech pair (NVDA/AAPL) ρ 0.62 — within 0.7 limit</div>
            <div>• Financials (JPM/GS) ρ 0.68 — consider trimming one</div>
            <div>• XOM short / LLY long ρ −0.24 — effective hedge</div>
          </div>
        </div>
      </div>

      {/* Stress simulator */}
      <div className="card">
        <div className="card-head">
          <h3>What if…</h3>
          <span className="sub">stress simulator</span>
          <span style={{ flex: 1 }} />
          <span className={"mono " + (total >= 0 ? "up" : "down")} style={{ fontSize: 16, fontWeight: 600 }}>
            {total >= 0 ? "+" : ""}${Math.round(total).toLocaleString()}
          </span>
        </div>
        <div style={{ padding: "14px 18px" }}>
          <Slider l="S&P 500 shock"  v={spx}  set={setSpx}  min={-25} max={25}   unit="%" />
          <Slider l="10-year yield"  v={rate} set={setRate} min={-200} max={200} unit=" bp" />
          <Slider l="Dollar index"   v={dxy}  set={setDxy}  min={-10}  max={10}  unit="%" />

          <div style={{ marginTop: 12, maxHeight: 240, overflow: "auto" }}>
            <table className="t">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th className="num">β</th>
                  <th className="num">Equity</th>
                  <th className="num">Rate</th>
                  <th className="num">FX</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {stress.map((r) => (
                  <tr key={r.t}>
                    <td><span className="tkr">{r.t}</span></td>
                    <td className="num dim">{r.b.toFixed(2)}</td>
                    <td className={"num " + (r.eq >= 0 ? "up" : "down")}>{r.eq >= 0 ? "+" : ""}{r.eq.toFixed(0)}</td>
                    <td className={"num " + (r.rt >= 0 ? "up" : "down")}>{r.rt >= 0 ? "+" : ""}{r.rt.toFixed(0)}</td>
                    <td className={"num " + (r.fx >= 0 ? "up" : "down")}>{r.fx >= 0 ? "+" : ""}{r.fx.toFixed(0)}</td>
                    <td className={"num " + (r.tot >= 0 ? "up" : "down")} style={{ fontWeight: 600 }}>
                      {r.tot >= 0 ? "+" : ""}{r.tot.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{
            marginTop: 12, padding: 12,
            border: "1px solid var(--accent)", background: "var(--accent-bg)",
            borderRadius: "var(--r-sm)", fontSize: 11.5, lineHeight: 1.5,
          }}>
            <div className="acc" style={{ fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Portfolio impact
            </div>
            <div style={{ marginTop: 3 }}>
              Under simultaneous S&P {spx}%, 10-year {rate >= 0 ? "+" : ""}{rate}bp, and dollar {dxy >= 0 ? "+" : ""}{dxy}%,
              the portfolio would change by{" "}
              <span className={"mono " + (total >= 0 ? "up" : "down")}>
                {total >= 0 ? "+" : ""}${Math.round(total).toLocaleString()}
              </span>{" "}
              — {Math.abs((total / PORT_VAL) * 100).toFixed(1)}% of NAV.
              Your XOM and TSLA shorts are the largest offsets.
            </div>
          </div>
        </div>
      </div>

      {/* Exposure limits */}
      <div className="card">
        <div className="card-head">
          <h3>Exposure limits</h3>
          <span className="sub">live</span>
        </div>
        <div style={{ padding: "12px 18px" }}>
          {[
            { l: "Gross exposure",      v: 0.70,  max: 1.50 },
            { l: "Net exposure",        v: 0.46,  max: 1.00 },
            { l: "Sector · tech",       v: 0.47,  max: 0.50 },
            { l: "Sector · financials", v: 0.14,  max: 0.25 },
            { l: "Single name max",     v: 0.050, max: 0.050 },
            { l: "Daily drawdown",      v: 0.028, max: 0.100 },
            { l: "VaR 95% · 1d",        v: 0.016, max: 0.030 },
          ].map((r) => {
            const p = r.v / r.max;
            const col = p < 0.6 ? "var(--up)" : p < 0.9 ? "var(--gold)" : "var(--down)";
            return (
              <div key={r.l} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5 }}>
                  <span style={{ flex: 1, color: "var(--fg)" }}>{r.l}</span>
                  <span className="mono mute">{(r.v * 100).toFixed(1)}% / {(r.max * 100).toFixed(1)}%</span>
                </div>
                <div className="bar" style={{ marginTop: 6 }}>
                  <div className="bar-inner" style={{ width: `${Math.min(100, p * 100)}%`, background: col }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historical scenarios */}
      <div className="card">
        <div className="card-head">
          <h3>Historical scenarios</h3>
          <span className="sub">click apply to replay</span>
        </div>
        <table className="t">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Date</th>
              <th className="num">S&amp;P</th>
              <th className="num">10y</th>
              <th className="num">Est P&amp;L</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[
              ["COVID crash",      "Mar 12 '20", "−9.5%", "−42bp", -22140],
              ["CPI shock",        "Sep 13 '22", "−4.3%", "+34bp", -9420],
              ["SVB weekend",      "Mar 10 '23", "−1.8%", "−28bp", -3880],
              ["Yen carry unwind", "Aug 5 '24",  "−3.0%", "−12bp", -6240],
              ["Tariff sell-off",  "Apr 3 '25",  "−4.8%", "−18bp", -10820],
            ].map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{r[0]}</td>
                <td className="mute">{r[1]}</td>
                <td className="num down">{r[2]}</td>
                <td className="num dim">{r[3]}</td>
                <td className="num down">−${Math.abs(r[4] as number).toLocaleString()}</td>
                <td><button className="btn">Apply</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
