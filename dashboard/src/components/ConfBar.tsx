"use client";

export default function ConfBar({ v, w = 52 }: { v: number; w?: number }) {
  const col =
    v >= 0.8 ? "var(--up)" : v >= 0.65 ? "var(--accent)" : "var(--down)";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <div className="bar" style={{ width: w }}>
        <div className="bar-inner" style={{ width: `${v * 100}%`, background: col }} />
      </div>
      <span className="mono" style={{ fontSize: 10.5, color: col }}>
        {v.toFixed(2)}
      </span>
    </div>
  );
}
