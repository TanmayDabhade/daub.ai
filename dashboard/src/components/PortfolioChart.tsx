"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface DataPoint {
  date: string;
  value: number;
}

export default function PortfolioChart({ data }: { data: DataPoint[] }) {
  if (!data.length) {
    return (
      <div
        className="rounded-none p-6 h-72 flex items-center justify-center"
        style={{
          border: "1px solid var(--border)",
          color: "var(--fg-muted)",
        }}
      >
        No portfolio data yet
      </div>
    );
  }

  const isPositive =
    data.length > 1 && data[data.length - 1].value >= data[0].value;
  const lineColor = isPositive ? "var(--green)" : "var(--red)";

  return (
    <div
      className="p-4"
      style={{ border: "1px solid var(--border)" }}
    >
      <h3
        className="text-xs uppercase tracking-wider font-medium mb-4"
        style={{ color: "var(--fg-muted)" }}
      >
        Portfolio Value
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={isPositive ? "#22c55e" : "#ef4444"}
                stopOpacity={0.15}
              />
              <stop
                offset="95%"
                stopColor={isPositive ? "#22c55e" : "#ef4444"}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="1 4"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--fg-muted)", fontSize: 10, fontFamily: "var(--font-geist-mono)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--fg-muted)", fontSize: 10, fontFamily: "var(--font-geist-mono)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "0",
              fontSize: "12px",
              color: "var(--fg)",
              fontFamily: "var(--font-geist-mono)",
            }}
            formatter={(value) => [
              `$${Number(value).toLocaleString()}`,
              "Value",
            ]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            fillOpacity={1}
            fill="url(#colorValue)"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
