"use client";

import type { Trade } from "@/lib/types";

export default function TradeRow({ trade }: { trade: Trade }) {
  const pnl = trade.pnl ?? 0;
  const pnlColor =
    trade.pnl !== null
      ? pnl >= 0
        ? "var(--green)"
        : "var(--red)"
      : "var(--fg-muted)";

  const holdDuration = trade.closed_at
    ? formatDuration(new Date(trade.opened_at), new Date(trade.closed_at))
    : "Open";

  return (
    <tr
      className="transition-colors"
      style={{ borderBottom: "1px solid var(--border)" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--bg-hover)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "transparent")
      }
    >
      <td
        className="px-4 py-3 text-xs font-mono"
        style={{ color: "var(--fg-muted)" }}
      >
        {new Date(trade.opened_at).toLocaleDateString()}
      </td>
      <td
        className="px-4 py-3 font-mono font-semibold"
        style={{ color: "var(--fg)" }}
      >
        {trade.ticker}
      </td>
      <td className="px-4 py-3">
        {/* BUY/SELL — monochrome, no red/green */}
        <span
          className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5"
          style={{
            color: trade.direction === "long" ? "var(--bg)" : "var(--fg)",
            background:
              trade.direction === "long" ? "var(--fg)" : "transparent",
            border: "1px solid var(--fg)",
          }}
        >
          {trade.direction === "long" ? "BUY" : "SELL"}
        </span>
      </td>
      <td
        className="px-4 py-3 text-right font-mono"
        style={{ color: "var(--fg-secondary)" }}
      >
        {trade.quantity}
      </td>
      <td
        className="px-4 py-3 text-right font-mono"
        style={{ color: "var(--fg-secondary)" }}
      >
        {trade.entry_price ? `$${trade.entry_price.toFixed(2)}` : "\u2014"}
      </td>
      <td
        className="px-4 py-3 text-right font-mono"
        style={{ color: "var(--fg-secondary)" }}
      >
        {trade.exit_price ? `$${trade.exit_price.toFixed(2)}` : "\u2014"}
      </td>
      <td
        className="px-4 py-3 text-right font-mono"
        style={{ color: pnlColor }}
      >
        {trade.pnl !== null
          ? `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`
          : "\u2014"}
      </td>
      <td
        className="px-4 py-3 text-right text-xs font-mono"
        style={{ color: "var(--fg-muted)" }}
      >
        {holdDuration}
      </td>
      <td className="px-4 py-3">
        <span
          className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5"
          style={{
            color: "var(--fg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          {trade.status}
        </span>
      </td>
    </tr>
  );
}

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  const mins = Math.floor(ms / (1000 * 60));
  return `${mins}m`;
}
