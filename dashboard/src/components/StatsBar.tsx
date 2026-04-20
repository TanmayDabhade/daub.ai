"use client";

interface Stat {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
}

export default function StatsBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px"
      style={{ background: "var(--border)" }}>
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="p-4"
          style={{ background: "var(--bg)" }}
        >
          <p
            className="text-[10px] uppercase tracking-wider font-medium"
            style={{ color: "var(--fg-muted)" }}
          >
            {stat.label}
          </p>
          <p
            className="text-xl font-mono font-semibold mt-1"
            style={{ color: "var(--fg)" }}
          >
            {stat.value}
          </p>
          {stat.change && (
            <p
              className="text-xs font-mono mt-0.5"
              style={{
                color: stat.positive ? "var(--green)" : "var(--red)",
              }}
            >
              {stat.change}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
