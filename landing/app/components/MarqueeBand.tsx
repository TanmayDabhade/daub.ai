import type { Quote } from "../lib/market";

function fmtPct(p: number) {
  const s = p >= 0 ? "+" : "";
  return `${s}${p.toFixed(2)}%`;
}

export default function MarqueeBand({ quotes }: { quotes: Quote[] }) {
  const items = quotes.map((q) => (
    <span key={q.symbol} className="band-item">
      <span className="star">★</span>
      <span className="tkr">{q.symbol}</span>
      <span>${q.price.toFixed(2)}</span>
      <span className={q.changePct >= 0 ? "up" : "dn"}>
        {q.changePct >= 0 ? "▲" : "▼"} {fmtPct(q.changePct)}
      </span>
    </span>
  ));
  return (
    <div className="band">
      <div className="band-track">
        {items}
        {items}
      </div>
    </div>
  );
}
