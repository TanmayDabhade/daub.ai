"use client";

const ITEMS = [
  { l: "S&P 500", v: "5,842.3",  d: "+0.82%", up: true },
  { l: "Nasdaq",  v: "18,420",   d: "+1.14%", up: true },
  { l: "Dow",     v: "42,186",   d: "+0.36%", up: true },
  { l: "VIX",     v: "14.80",    d: "-3.90%", up: true },
  { l: "UST10",   v: "4.18%",    d: "-4bp",   up: true },
  { l: "DXY",     v: "101.4",    d: "-0.3%",  up: true },
  { l: "Brent",   v: "$71.80",   d: "-1.64%", up: false },
  { l: "BTC",     v: "$94,820",  d: "+2.41%", up: true },
  { l: "Breadth", v: "312/186",  d: "adv/dec",up: true },
];

export default function PulseStrip() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${ITEMS.length}, 1fr)`,
        gap: 1,
        background: "var(--line)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      {ITEMS.map((it) => (
        <div key={it.l} style={{ padding: "10px 14px", background: "var(--card)" }}>
          <div
            className="mute"
            style={{ fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 500 }}
          >
            {it.l}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 3 }}>
            <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{it.v}</span>
            <span className={"mono " + (it.up ? "up" : "down")} style={{ fontSize: 10.5 }}>{it.d}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
