"use client";

import { useEffect, useState } from "react";

interface PulseItem {
  l: string;
  v: string;
  d: string;
  up: boolean;
}

const INDEX_SYMBOLS = ["SPY", "QQQ", "DIA", "^VIX"];
const EXTRA_SYMBOLS = ["^TNX", "DXY", "BZ=F", "BTC-USD"];

const FALLBACK: PulseItem[] = [
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

// Maps Yahoo Finance symbols to display labels
const LABELS: Record<string, string> = {
  SPY: "S&P 500", QQQ: "Nasdaq", DIA: "Dow",
  "^VIX": "VIX", "^TNX": "UST10",
  "BZ=F": "Brent", "BTC-USD": "BTC",
};

function fmt(price: number, sym: string): string {
  if (sym === "^VIX" || sym === "^TNX") return price.toFixed(2);
  if (sym === "BTC-USD") return `$${Math.round(price).toLocaleString()}`;
  if (sym === "BZ=F") return `$${price.toFixed(2)}`;
  return price.toFixed(2);
}

export default function PulseStrip() {
  const [items, setItems] = useState<PulseItem[]>(FALLBACK);

  useEffect(() => {
    const symbols = [...INDEX_SYMBOLS, ...EXTRA_SYMBOLS];
    const load = async () => {
      try {
        const res = await fetch(`/api/quotes?symbols=${symbols.join(",")}`);
        if (!res.ok) return;
        const { quotes } = await res.json();
        if (!quotes || !Object.keys(quotes).length) return;

        const built: PulseItem[] = [];
        for (const sym of symbols) {
          const q = quotes[sym];
          if (!q) continue;
          const pct = q.changePct as number;
          const pctStr = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
          built.push({
            l: LABELS[sym] ?? sym,
            v: fmt(q.price as number, sym),
            d: pctStr,
            up: pct >= 0,
          });
        }
        if (built.length >= 4) setItems(built);
      } catch { /* keep fallback */ }
    };

    load();
    const id = setInterval(load, 15000); // poll every 15s
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        gap: 1,
        background: "var(--line)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      {items.map((it) => (
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
