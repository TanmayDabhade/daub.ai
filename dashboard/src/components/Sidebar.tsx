"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
};

const GROUPS: { g: string; items: Item[] }[] = [
  {
    g: "Workspace",
    items: [
      { href: "/workbench",       label: "Workbench",   icon: "▣" },
      { href: "/",                label: "Dashboard",   icon: "◨" },
      { href: "/signals",         label: "Signal Desk", icon: "◈", badge: 7 },
      { href: "/trades",          label: "Blotter",     icon: "≡" },
    ],
  },
  {
    g: "Research",
    items: [
      { href: "/agents",          label: "Agent Swarm", icon: "◉" },
      { href: "/screener",        label: "Screener",    icon: "⌕" },
      { href: "/risk",            label: "Risk Radar",  icon: "△" },
      { href: "/alerts",          label: "Alerts",      icon: "◇", badge: 3 },
    ],
  },
];

const WATCHLIST: { t: string; ch: string; dir: "up" | "dn" }[] = [
  { t: "NVDA", ch: "+6.38", dir: "up" },
  { t: "LLY",  ch: "+2.02", dir: "up" },
  { t: "TSLA", ch: "−3.71", dir: "dn" },
  { t: "AAPL", ch: "−1.21", dir: "dn" },
  { t: "JPM",  ch: "+3.02", dir: "up" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 224,
        background: "var(--bg-1)",
        borderRight: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
        overflowY: "auto",
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid var(--line)",
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            background: "var(--accent)",
            display: "inline-block",
          }}
        />
        <span>
          daub<span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>.ai</span>
        </span>
      </div>

      {/* Nav */}
      <div style={{ padding: "6px 0", flex: 1 }}>
        {GROUPS.map((group) => (
          <div key={group.g} style={{ padding: "14px 10px 6px" }}>
            <div
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "var(--fg-ghost)",
                padding: "2px 10px 10px",
                fontWeight: 500,
              }}
            >
              {group.g}
            </div>
            {group.items.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
              return (
                <SideLink key={item.href} item={item} active={!!active} />
              );
            })}
          </div>
        ))}

        {/* Watchlist */}
        <div style={{ padding: "14px 10px 6px" }}>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "var(--fg-ghost)",
              padding: "2px 10px 10px",
              fontWeight: 500,
            }}
          >
            Watchlist
          </div>
          {WATCHLIST.map((w) => (
            <Link
              key={w.t}
              href={`/workbench/${w.t}`}
              style={{
                margin: "1px 0",
                padding: "6px 10px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                borderRadius: 3,
                color: "var(--fg-dim)",
                fontSize: 13,
                textDecoration: "none",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--bg-2)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
            >
              <span
                className="mono"
                style={{ width: 14, textAlign: "center", color: "var(--fg-ghost)", fontSize: 12 }}
              >
                ·
              </span>
              <span style={{ flex: 1 }}>{w.t}</span>
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  color: w.dir === "up" ? "var(--up)" : "var(--down)",
                }}
              >
                {w.ch}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "14px 18px",
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
            border: "1px solid var(--line-2)",
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
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)" }}>Tanmay D.</div>
          <div className="mute" style={{ fontSize: 10.5 }}>Paper · $186.7k</div>
        </div>
        <Link href="#" style={{ color: "var(--fg-muted)", fontSize: 13, textDecoration: "none" }}>
          ⚙
        </Link>
      </div>
    </aside>
  );
}

function SideLink({ item, active }: { item: Item; active: boolean }) {
  return (
    <Link
      href={item.href}
      style={{
        margin: "1px 0",
        padding: "7px 10px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderRadius: 3,
        background: active ? "var(--bg-2)" : "transparent",
        color: active ? "var(--fg)" : "var(--fg-dim)",
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        textDecoration: "none",
        boxShadow: active ? "inset 2px 0 0 var(--accent)" : "none",
        transition: "background 80ms",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "var(--bg-2)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <span
        className="mono"
        style={{
          width: 14,
          textAlign: "center",
          color: active ? "var(--accent)" : "var(--fg-ghost)",
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {item.icon}
      </span>
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge && (
        <span
          className="mono"
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: "var(--fg-muted)",
            padding: "1px 6px",
          }}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}
