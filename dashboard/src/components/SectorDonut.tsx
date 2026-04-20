"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { Position } from "@/lib/types";
import { getSector } from "@/lib/sectors";

const SECTOR_COLORS: Record<string, string> = {
  Technology: "#ffffff",
  Finance: "#a3a3a3",
  Healthcare: "#525252",
  Industrial: "#d4d4d4",
  Consumer: "#737373",
  Energy: "#404040",
  Defense: "#e5e5e5",
  Other: "#171717",
};

export default function SectorDonut({ positions }: { positions: Position[] }) {
  const sectorMap: Record<string, number> = {};
  for (const p of positions) {
    const sector = getSector(p.ticker);
    sectorMap[sector] = (sectorMap[sector] ?? 0) + Math.abs(p.market_value);
  }

  const data = Object.entries(sectorMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (!data.length) {
    return (
      <div
        className="p-4 flex items-center justify-center h-full"
        style={{ color: "var(--fg-muted)" }}
      >
        <p className="text-sm">No positions</p>
      </div>
    );
  }

  return (
    <div className="p-4 h-full flex flex-col">
      <h3
        className="text-[10px] uppercase tracking-wider font-medium mb-3"
        style={{ color: "var(--fg-muted)" }}
      >
        Sector Exposure
      </h3>
      <div className="flex-1 min-h-0 flex items-center">
        <div className="w-1/2">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                dataKey="value"
                stroke="var(--bg)"
                strokeWidth={2}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={SECTOR_COLORS[entry.name] ?? "#525252"}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "0",
                  fontSize: "11px",
                  color: "var(--fg)",
                  fontFamily: "var(--font-geist-mono)",
                }}
                formatter={(value) => [
                  `$${Number(value).toLocaleString()}`,
                  "",
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-1/2 space-y-1.5">
          {data.map((d) => (
            <div key={d.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2"
                  style={{
                    background: SECTOR_COLORS[d.name] ?? "#525252",
                    border: "1px solid var(--border)",
                  }}
                />
                <span
                  className="text-[11px]"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  {d.name}
                </span>
              </div>
              <span
                className="text-[11px] font-mono"
                style={{ color: "var(--fg-muted)" }}
              >
                {((d.value / total) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
