"use client";

import type { UnifiedSignal } from "@/lib/types";

function strengthColor(score: number): string {
  const abs = Math.abs(score);
  if (abs >= 0.6) return "var(--green)";
  if (abs >= 0.35) return "var(--yellow)";
  return "var(--red)";
}

function strengthLabel(score: number): string {
  const abs = Math.abs(score);
  if (abs >= 0.6) return "STRONG";
  if (abs >= 0.35) return "MODERATE";
  return "WEAK";
}

function displayRecommendation(signal: UnifiedSignal): string {
  if (signal.source === "agent" && signal.recommendation) {
    return signal.recommendation.replace(/_/g, " ").toUpperCase();
  }
  return signal.direction === "long" ? "BUY" : "SELL";
}

export default function SignalCard({
  signal,
  selected,
  onClick,
}: {
  signal: UnifiedSignal;
  selected?: boolean;
  onClick?: () => void;
}) {
  const strength = strengthColor(signal.composite_score);
  const scoreWidth = Math.abs(signal.composite_score) * 100;
  const label = displayRecommendation(signal);
  const isBuy =
    signal.direction === "long" ||
    label === "BUY" ||
    label === "INCREASE EXPOSURE" ||
    label === "STRONG BUY";

  return (
    <div
      className="p-4 cursor-pointer transition-colors"
      style={{
        border: selected
          ? "2px solid var(--fg)"
          : "1px solid var(--border)",
        background: selected ? "var(--bg-hover)" : "var(--bg-card)",
      }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        {/* Left: ticker + direction badge */}
        <div className="flex items-center gap-3">
          <span
            className="font-mono font-bold text-lg"
            style={{ color: "var(--fg)" }}
          >
            {signal.ticker}
          </span>
          {/* BUY/SELL — monochrome, no red/green */}
          <span
            className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 font-mono"
            style={{
              color: isBuy ? "var(--bg)" : "var(--fg)",
              background: isBuy ? "var(--fg)" : "transparent",
              border: "1.5px solid var(--fg)",
            }}
          >
            {label}
          </span>
          {/* Source badge */}
          {signal.source === "agent" && signal.agent_type && (
            <span
              className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5"
              style={{
                color: "var(--fg-muted)",
                border: "1px solid var(--border)",
              }}
            >
              {signal.agent_type}
            </span>
          )}
        </div>

        {/* Right: score + confidence */}
        <div className="flex items-center gap-5">
          <div className="text-right">
            <p
              className="text-[10px] uppercase tracking-wider"
              style={{ color: "var(--fg-muted)" }}
            >
              Strength
            </p>
            <p
              className="font-mono text-xs font-semibold"
              style={{ color: strength }}
            >
              {strengthLabel(signal.composite_score)}
            </p>
          </div>
          <div className="text-right">
            <p
              className="text-[10px] uppercase tracking-wider"
              style={{ color: "var(--fg-muted)" }}
            >
              Score
            </p>
            <p
              className="font-mono font-semibold text-sm"
              style={{ color: "var(--fg)" }}
            >
              {signal.composite_score > 0 ? "+" : ""}
              {signal.composite_score.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p
              className="text-[10px] uppercase tracking-wider"
              style={{ color: "var(--fg-muted)" }}
            >
              Confidence
            </p>
            <p
              className="font-mono font-semibold text-sm"
              style={{ color: "var(--fg)" }}
            >
              {(signal.confidence * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      </div>

      {/* Signal strength bar */}
      <div
        className="mt-3 h-0.5 overflow-hidden"
        style={{ background: "var(--border)" }}
      >
        <div
          className="h-full transition-all"
          style={{ width: `${scoreWidth}%`, background: strength }}
        />
      </div>

      {/* One-line summary */}
      <p
        className="text-xs mt-2 line-clamp-1"
        style={{ color: "var(--fg-muted)" }}
      >
        {signal.reasoning.substring(0, 120)}
        {signal.reasoning.length > 120 ? "..." : ""}
      </p>
    </div>
  );
}
