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

function formatReasoning(text: string): string[] {
  if (text.includes("\n\n")) {
    return text.split("\n\n").filter(Boolean);
  }
  const sentences = text.split(/(?<=[.!?])\s+/);
  const paragraphs: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    current += (current ? " " : "") + sentence;
    if (current.length > 200) {
      paragraphs.push(current);
      current = "";
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

function displayRecommendation(signal: UnifiedSignal): string {
  if (signal.source === "agent" && signal.recommendation) {
    return signal.recommendation.replace(/_/g, " ").toUpperCase();
  }
  return signal.direction === "long" ? "BUY" : "SELL";
}

export default function ThesisPanel({
  signal,
  onClose,
}: {
  signal: UnifiedSignal;
  onClose: () => void;
}) {
  const strength = strengthColor(signal.composite_score);
  const paragraphs = formatReasoning(signal.reasoning);
  const label = displayRecommendation(signal);
  const isBuy =
    signal.direction === "long" ||
    label === "BUY" ||
    label === "INCREASE EXPOSURE" ||
    label === "STRONG BUY";

  return (
    <div
      className="h-full flex flex-col"
      style={{
        background: "var(--bg)",
        borderLeft: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="shrink-0 px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="font-mono font-bold text-xl"
            style={{ color: "var(--fg)" }}
          >
            {signal.ticker}
          </span>
          <span
            className="text-xs font-bold uppercase tracking-wider px-3 py-1 font-mono"
            style={{
              color: isBuy ? "var(--bg)" : "var(--fg)",
              background: isBuy ? "var(--fg)" : "transparent",
              border: "1.5px solid var(--fg)",
            }}
          >
            {label}
          </span>
          {signal.source === "agent" && signal.agent_type && (
            <span
              className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5"
              style={{
                color: "var(--fg-muted)",
                border: "1px solid var(--border)",
              }}
            >
              {signal.agent_type} agent
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-sm px-2 py-1 transition-colors"
          style={{ color: "var(--fg-muted)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--fg)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--fg-muted)")
          }
        >
          Close
        </button>
      </div>

      {/* Scrollable content — three sections */}
      <div className="flex-1 overflow-y-auto">
        {/* ─── SECTION 1: SIGNAL ─── */}
        <div
          className="px-6 py-5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h3
            className="text-[10px] uppercase tracking-[0.15em] font-semibold mb-4"
            style={{ color: "var(--fg-muted)" }}
          >
            Signal
          </h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p
                className="text-[10px] uppercase tracking-wider mb-1"
                style={{ color: "var(--fg-muted)" }}
              >
                Direction
              </p>
              <p
                className="font-mono font-bold text-sm uppercase"
                style={{ color: "var(--fg)" }}
              >
                {label}
              </p>
            </div>
            <div>
              <p
                className="text-[10px] uppercase tracking-wider mb-1"
                style={{ color: "var(--fg-muted)" }}
              >
                {signal.source === "agent" ? "Sentiment" : "Composite Score"}
              </p>
              <p
                className="font-mono font-bold text-sm"
                style={{ color: "var(--fg)" }}
              >
                {signal.composite_score > 0 ? "+" : ""}
                {signal.composite_score.toFixed(3)}
              </p>
            </div>
            <div>
              <p
                className="text-[10px] uppercase tracking-wider mb-1"
                style={{ color: "var(--fg-muted)" }}
              >
                Confidence
              </p>
              <p
                className="font-mono font-bold text-sm"
                style={{ color: "var(--fg)" }}
              >
                {(signal.confidence * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Strength indicator */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color: "var(--fg-muted)" }}
              >
                Signal Strength
              </span>
              <span
                className="text-xs font-mono font-semibold"
                style={{ color: strength }}
              >
                {strengthLabel(signal.composite_score)}
              </span>
            </div>
            <div
              className="h-1 w-full"
              style={{ background: "var(--border)" }}
            >
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.abs(signal.composite_score) * 100}%`,
                  background: strength,
                }}
              />
            </div>
          </div>

          {/* Source + time */}
          <div className="flex items-center gap-4 mt-4">
            <span
              className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5"
              style={{
                color: "var(--fg-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              {signal.source === "aggregated"
                ? signal.status
                : signal.recommendation?.replace(/_/g, " ") ?? signal.status}
            </span>
            {signal.source === "agent" && (
              <span
                className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5"
                style={{
                  color: "var(--fg-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                {signal.agent_type} agent
              </span>
            )}
            <span
              className="text-xs font-mono"
              style={{ color: "var(--fg-muted)" }}
            >
              {new Date(signal.created_at).toLocaleString()}
            </span>
          </div>
        </div>

        {/* ─── SECTION 2: INVESTMENT THESIS ─── */}
        <div
          className="px-6 py-5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h3
            className="text-[10px] uppercase tracking-[0.15em] font-semibold mb-4"
            style={{ color: "var(--fg-muted)" }}
          >
            Investment Thesis
          </h3>

          <div className="space-y-3">
            {paragraphs.map((para, i) => (
              <p
                key={i}
                className="text-sm leading-relaxed"
                style={{ color: "var(--fg-secondary)" }}
              >
                {para}
              </p>
            ))}
          </div>

          {/* Agent-level signals (only for agent source) */}
          {signal.agent_signals && signal.agent_signals.length > 0 && (
            <div className="mt-5">
              <p
                className="text-[10px] uppercase tracking-wider mb-2"
                style={{ color: "var(--fg-muted)" }}
              >
                Underlying Signals
              </p>
              <div className="space-y-2">
                {signal.agent_signals.map((sig, i) => (
                  <div
                    key={i}
                    className="p-3"
                    style={{
                      borderLeft: `2px solid ${
                        sig.sentiment === "positive"
                          ? "var(--green)"
                          : sig.sentiment === "negative"
                            ? "var(--red)"
                            : "var(--border-strong)"
                      }`,
                      background:
                        sig.sentiment === "positive"
                          ? "var(--green-subtle)"
                          : sig.sentiment === "negative"
                            ? "var(--red-subtle)"
                            : "var(--bg-hover)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] font-mono uppercase tracking-wider"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        {sig.type.replace(/_/g, " ")}
                      </span>
                      <span
                        className="text-[10px] font-mono"
                        style={{
                          color:
                            sig.sentiment === "positive"
                              ? "var(--green)"
                              : sig.sentiment === "negative"
                                ? "var(--red)"
                                : "var(--fg-muted)",
                        }}
                      >
                        {sig.sentiment} &middot;{" "}
                        {(sig.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p
                      className="text-sm"
                      style={{ color: "var(--fg-secondary)" }}
                    >
                      {sig.description}
                    </p>
                    {sig.evidence && (
                      <p
                        className="text-xs mt-1 italic"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        &quot;{sig.evidence.substring(0, 250)}
                        {sig.evidence.length > 250 ? "..." : ""}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contributing analyses (aggregated signals) */}
          {signal.source === "aggregated" &&
            signal.contributing_analyses &&
            signal.contributing_analyses.length > 0 && (
              <div className="mt-5">
                <p
                  className="text-[10px] uppercase tracking-wider mb-2"
                  style={{ color: "var(--fg-muted)" }}
                >
                  Contributing Analyses
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {signal.contributing_analyses.map((id, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono px-2 py-0.5"
                      style={{
                        color: "var(--fg-muted)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {id.substring(0, 8)}
                    </span>
                  ))}
                </div>
              </div>
            )}

          {/* Conflicts */}
          {signal.conflicts && signal.conflicts.length > 0 && (
            <div className="mt-5">
              <p
                className="text-[10px] uppercase tracking-wider mb-2"
                style={{ color: "var(--yellow)" }}
              >
                Conflicts
              </p>
              <div className="space-y-2">
                {signal.conflicts.map((conflict, i) => (
                  <div
                    key={i}
                    className="p-3"
                    style={{
                      background: "var(--yellow-subtle)",
                      borderLeft: "2px solid var(--yellow)",
                    }}
                  >
                    <p
                      className="text-sm"
                      style={{ color: "var(--fg-secondary)" }}
                    >
                      {conflict.description}
                    </p>
                    {conflict.agents_involved && (
                      <p
                        className="text-[10px] uppercase tracking-wider mt-1.5"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        Agents: {conflict.agents_involved.join(", ")}
                      </p>
                    )}
                    <p
                      className="text-xs mt-1.5"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      Resolution: {conflict.resolution}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── SECTION 3: PORTFOLIO IMPACT ─── */}
        <div className="px-6 py-5">
          <h3
            className="text-[10px] uppercase tracking-[0.15em] font-semibold mb-4"
            style={{ color: "var(--fg-muted)" }}
          >
            Portfolio Impact
          </h3>

          <div className="space-y-3">
            {signal.position_action && (
              <div className="flex items-center justify-between">
                <span
                  className="text-xs uppercase tracking-wider"
                  style={{ color: "var(--fg-muted)" }}
                >
                  Action
                </span>
                <span
                  className="font-mono font-bold text-sm uppercase"
                  style={{ color: "var(--fg)" }}
                >
                  {signal.position_action}
                </span>
              </div>
            )}

            {signal.recommended_position_pct != null && (
              <>
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs uppercase tracking-wider"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    Recommended Size
                  </span>
                  <span
                    className="font-mono font-semibold text-sm"
                    style={{ color: "var(--fg)" }}
                  >
                    {(signal.recommended_position_pct * 100).toFixed(1)}% of
                    portfolio
                  </span>
                </div>
                <div className="mt-2">
                  <div
                    className="h-1.5 w-full"
                    style={{ background: "var(--border)" }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${(signal.recommended_position_pct / 0.05) * 100}%`,
                        background: "var(--fg)",
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span
                      className="text-[10px] font-mono"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      0%
                    </span>
                    <span
                      className="text-[10px] font-mono"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      5% max
                    </span>
                  </div>
                </div>
              </>
            )}

            {signal.position_rationale && (
              <div className="mt-3">
                <p
                  className="text-[10px] uppercase tracking-wider mb-1.5"
                  style={{ color: "var(--fg-muted)" }}
                >
                  Rationale
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  {signal.position_rationale}
                </p>
              </div>
            )}

            {!signal.position_action &&
              !signal.recommended_position_pct &&
              !signal.position_rationale && (
                <p
                  className="text-sm"
                  style={{ color: "var(--fg-muted)" }}
                >
                  {signal.source === "agent"
                    ? "This is an individual agent recommendation. Run the signal aggregator to generate portfolio-level sizing."
                    : "No portfolio sizing data available for this signal."}
                </p>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
