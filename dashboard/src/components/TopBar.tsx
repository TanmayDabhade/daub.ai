"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/workbench": "Workbench",
  "/signals": "Signal Desk",
  "/agents": "Agent Swarm",
  "/research": "Research",
  "/risk": "Risk Radar",
  "/screener": "Screener",
  "/trades": "Blotter",
  "/alerts": "Alerts",
};

export default function TopBar() {
  const pathname = usePathname() || "/";
  const [clock, setClock] = useState("--:--:-- ET");
  const [search, setSearch] = useState("");

  const parts = pathname === "/" ? ["Dashboard"] : pathname.split("/").filter(Boolean);
  const label = TITLES[pathname] || (parts[0] ? parts[0][0].toUpperCase() + parts[0].slice(1) : "Dashboard");
  const sub = parts.length > 1 ? parts.slice(1).join(" / ").toUpperCase() : null;

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
        minHeight: 54,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 22px",
        background: "var(--bg)",
        borderBottom: "1px solid var(--line)",
        flexShrink: 0,
      }}
    >
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
        <span className="mute">Daub</span>
        <span style={{ color: "var(--fg-ghost)" }}>/</span>
        <span style={{ color: "var(--fg)" }}>{label}</span>
        {sub && (
          <>
            <span style={{ color: "var(--fg-ghost)" }}>/</span>
            <span className="mono" style={{ color: "var(--fg-dim)" }}>{sub}</span>
          </>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Search */}
      <div
        style={{
          width: 360,
          maxWidth: "40vw",
          height: 32,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 12px",
          background: "var(--bg-1)",
          border: "1px solid var(--line-2)",
          borderRadius: 3,
        }}
      >
        <span style={{ color: "var(--fg-ghost)", fontSize: 13 }}>⌕</span>
        <input
          placeholder="Search ticker or ask — e.g. 'why long NVDA'"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ fontSize: 12.5 }}
        />
        <span className="kbd">⌘K</span>
      </div>

      {/* Market status + clock */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
        <span className="dot live" />
        <span className="dim">Market open</span>
        <span style={{ color: "var(--fg-ghost)" }}>·</span>
        <span className="mono" style={{ color: "var(--fg-dim)" }}>{clock}</span>
      </div>
    </div>
  );
}
