"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  {
    g: "Workspace",
    items: [
      { href: "/",        label: "Dashboard",   icon: "◉" },
      { href: "/signals", label: "Signal Desk",  icon: "◆" },
      { href: "/agents",  label: "Agent Swarm",  icon: "◇" },
    ],
  },
  {
    g: "Research",
    items: [
      { href: "/research", label: "Research",   icon: "◈" },
      { href: "/risk",     label: "Risk Radar", icon: "◐" },
      { href: "/screener", label: "Screener",   icon: "▣" },
    ],
  },
  {
    g: "Execution",
    items: [
      { href: "/trades",  label: "Blotter",  icon: "▤" },
      { href: "/alerts",  label: "Alerts",   icon: "▲", badge: 3 },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div
      style={{
        width: 212,
        background: "var(--bg-1)",
        borderRight: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: "16px 18px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-d) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            fontFamily: "var(--mono)",
          }}
        >
          d
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--fg)" }}>
            Daub
          </div>
          <div
            className="mono mute"
            style={{ fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            research · v0.4
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: "12px 0", flex: 1, overflow: "auto" }}>
        {GROUPS.map((group) => (
          <div key={group.g} style={{ marginBottom: 14 }}>
            <div
              className="mute"
              style={{
                padding: "4px 18px",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 500,
              }}
            >
              {group.g}
            </div>
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    margin: "1px 8px",
                    padding: "7px 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    borderRadius: "var(--r-sm)",
                    background: active ? "var(--accent-bg)" : "transparent",
                    color: active ? "var(--accent-hi)" : "var(--fg-dim)",
                    fontSize: 12.5,
                    fontWeight: active ? 500 : 400,
                    textDecoration: "none",
                    transition: "all 80ms",
                  }}
                  onMouseEnter={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLElement).style.background = "var(--bg-2)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      width: 16,
                      textAlign: "center",
                      color: active ? "var(--accent)" : "var(--fg-muted)",
                    }}
                  >
                    {item.icon}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {"badge" in item && item.badge && (
                    <span
                      className="pill"
                      style={{
                        background: "var(--accent)",
                        color: "#fff",
                        fontSize: 9,
                        padding: "1px 6px",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "var(--bg-3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--fg)",
          }}
        >
          T
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--fg)" }}>Tanmay D.</div>
          <div className="mute" style={{ fontSize: 10 }}>Paper · $186.7k</div>
        </div>
        <span className="mono mute" style={{ fontSize: 10 }}>⚙</span>
      </div>
    </div>
  );
}
