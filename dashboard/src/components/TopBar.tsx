"use client";

import { useEffect, useState } from "react";

export default function TopBar() {
  const [clock, setClock] = useState("--:--:-- ET");
  const [search, setSearch] = useState("");

  useEffect(() => {
    function tick() {
      const now = new Date();
      const et = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now);
      setClock(`${et} ET`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        height: 50,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 18px",
        background: "var(--bg)",
        borderBottom: "1px solid var(--line)",
        flexShrink: 0,
      }}
    >
      {/* Search */}
      <div
        style={{
          flex: 1,
          maxWidth: 520,
          height: 34,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 12px",
          background: "var(--bg-1)",
          border: "1px solid var(--line-2)",
          borderRadius: "var(--r-md)",
        }}
      >
        <span className="mute" style={{ fontSize: 13 }}>⌕</span>
        <input
          placeholder="Search ticker, ask question, or run command"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="kbd">⌘K</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Market status + clock */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
        <span className="dot live" />
        <span className="dim">Market open</span>
        <span className="mute">·</span>
        <span className="mono" style={{ color: "var(--fg-dim)" }}>{clock}</span>
      </div>

      <button className="btn ghost">◐</button>
    </div>
  );
}
