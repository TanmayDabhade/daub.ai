"use client";

import { useState } from "react";
import type { AgentAnalysis } from "@/lib/types";

const agentLabels: Record<string, string> = {
  filing: "FILING",
  earnings: "EARNINGS",
  sentiment: "SENTIMENT",
  macro: "MACRO",
};

function sentimentStrength(val: number): {
  color: string;
  label: string;
} {
  const abs = Math.abs(val);
  if (abs >= 0.5) return { color: "var(--green)", label: "STRONG" };
  if (abs >= 0.2) return { color: "var(--yellow)", label: "MODERATE" };
  return { color: "var(--red)", label: "WEAK" };
}

function AgentCard({ analysis }: { analysis: AgentAnalysis }) {
  const [expanded, setExpanded] = useState(false);
  const { color: sentColor } = sentimentStrength(analysis.overall_sentiment);

  return (
    <div
      className="cursor-pointer transition-colors"
      style={{
        border: "1px solid var(--border)",
        background: "var(--bg-card)",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="text-[10px] font-mono font-semibold tracking-wider px-2 py-0.5"
              style={{
                color: "var(--fg-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              {agentLabels[analysis.agent_type] || analysis.agent_type.toUpperCase()}
            </span>
            <span
              className="font-mono font-bold"
              style={{ color: "var(--fg)" }}
            >
              {analysis.ticker}
            </span>
            <span className="font-mono text-xs" style={{ color: sentColor }}>
              {analysis.overall_sentiment > 0 ? "+" : ""}
              {analysis.overall_sentiment.toFixed(2)}
            </span>
          </div>
          <div
            className="flex items-center gap-4 text-[10px] tracking-wider uppercase"
            style={{ color: "var(--fg-muted)" }}
          >
            <span>
              {analysis.signals.length} signal
              {analysis.signals.length !== 1 ? "s" : ""}
            </span>
            <span>{(analysis.confidence * 100).toFixed(0)}%</span>
            <span className="font-mono">
              {new Date(analysis.analyzed_at).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Recommendation — monochrome label */}
        <div className="mt-2">
          <span
            className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5"
            style={{
              color:
                analysis.recommendation === "buy" ||
                analysis.recommendation === "increase_exposure"
                  ? "var(--bg)"
                  : "var(--fg)",
              background:
                analysis.recommendation === "buy" ||
                analysis.recommendation === "increase_exposure"
                  ? "var(--fg)"
                  : "transparent",
              border: "1px solid var(--fg)",
            }}
          >
            {analysis.recommendation.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {expanded && (
        <div
          className="px-4 pb-4 space-y-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="pt-4">
            {/* Signals */}
            {analysis.signals.map((sig, i) => (
              <div
                key={i}
                className="py-2"
                style={{
                  borderBottom:
                    i < analysis.signals.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5"
                    style={{
                      color: "var(--fg-muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {sig.type.replace(/_/g, " ")}
                  </span>
                  <span
                    className="text-[10px] font-mono uppercase"
                    style={{
                      color:
                        sig.sentiment === "positive"
                          ? "var(--green)"
                          : sig.sentiment === "negative"
                            ? "var(--red)"
                            : "var(--fg-muted)",
                    }}
                  >
                    {sig.sentiment}
                  </span>
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    {(sig.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  {sig.description}
                </p>
                {sig.evidence && (
                  <p
                    className="text-xs mt-1 italic"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    &quot;{sig.evidence.substring(0, 200)}
                    {sig.evidence.length > 200 ? "..." : ""}&quot;
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Reasoning */}
          {analysis.reasoning && (
            <div style={{ borderTop: "1px solid var(--border)" }}>
              <p
                className="text-[10px] uppercase tracking-wider mb-2 pt-3"
                style={{ color: "var(--fg-muted)" }}
              >
                Reasoning
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--fg-secondary)" }}
              >
                {analysis.reasoning}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentFeed({
  analyses,
}: {
  analyses: AgentAnalysis[];
}) {
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all"
      ? analyses
      : analyses.filter((a) => a.agent_type === filter);

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-0 mb-4">
        {["all", "filing", "earnings", "sentiment", "macro"].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className="text-[10px] uppercase tracking-wider px-3 py-1.5 font-mono transition-colors"
            style={{
              color: filter === type ? "var(--bg)" : "var(--fg-secondary)",
              background: filter === type ? "var(--fg)" : "transparent",
              border: "1px solid var(--border)",
              marginLeft: type === "all" ? 0 : "-1px",
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="space-y-0">
        {filtered.length === 0 ? (
          <div
            className="p-8 text-center text-sm"
            style={{
              border: "1px solid var(--border)",
              color: "var(--fg-muted)",
            }}
          >
            No agent analyses yet. Run the orchestrator to generate data.
          </div>
        ) : (
          filtered.map((analysis) => (
            <AgentCard key={analysis.id} analysis={analysis} />
          ))
        )}
      </div>
    </div>
  );
}
