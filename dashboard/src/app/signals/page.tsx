"use client";

import { useEffect, useState } from "react";
import SignalCard from "@/components/SignalCard";
import ThesisPanel from "@/components/ThesisPanel";
import { supabase } from "@/lib/supabase";
import type { TradeSignal, AgentAnalysis, UnifiedSignal } from "@/lib/types";

const ACTIONABLE_RECOMMENDATIONS = [
  "buy",
  "sell",
  "increase_exposure",
  "reduce_exposure",
  "decrease_exposure",
  "strong_buy",
  "strong_sell",
];

function recommendationToDirection(rec: string): "long" | "short" {
  if (
    rec === "sell" ||
    rec === "reduce_exposure" ||
    rec === "decrease_exposure" ||
    rec === "strong_sell"
  ) {
    return "short";
  }
  return "long";
}

function tradeSignalToUnified(s: TradeSignal): UnifiedSignal {
  return {
    id: s.id,
    ticker: s.ticker,
    direction: s.direction,
    composite_score: s.composite_score,
    confidence: s.confidence,
    reasoning: s.reasoning,
    created_at: s.created_at,
    status: s.status,
    conflicts: s.conflicts ?? [],
    contributing_analyses: s.contributing_analyses ?? [],
    position_action: s.position_action,
    recommended_position_pct: s.recommended_position_pct,
    position_rationale: s.position_rationale,
    source: "aggregated",
  };
}

function analysisToUnified(a: AgentAnalysis): UnifiedSignal {
  return {
    id: `agent-${a.id}`,
    ticker: a.ticker,
    direction: recommendationToDirection(a.recommendation),
    composite_score: a.overall_sentiment,
    confidence: a.confidence,
    reasoning: a.reasoning,
    created_at: a.analyzed_at,
    status: a.recommendation,
    conflicts: [],
    contributing_analyses: [a.id],
    source: "agent",
    agent_type: a.agent_type,
    recommendation: a.recommendation,
    agent_signals: a.signals,
  };
}

const DEMO_SIGNALS: UnifiedSignal[] = [
  {
    id: "1",
    ticker: "NVDA",
    direction: "long",
    composite_score: 0.62,
    confidence: 0.82,
    position_action: "open",
    recommended_position_pct: 0.04,
    position_rationale:
      "Strong conviction on datacenter growth trajectory. Sizing at 4% given export control risk as a headwind.",
    contributing_analyses: [],
    conflicts: [
      {
        description:
          "Filing analyst flagged export control risks while sentiment analyst sees bullish analyst coverage",
        agents_involved: ["filing", "sentiment"],
        resolution:
          "Net positive — revenue growth and analyst targets outweigh regulatory risks, but reduced position size recommended",
      },
    ],
    reasoning:
      "Strong convergence across filing and sentiment analysts. Revenue growth of 154% YoY is exceptional and well above consensus estimates. The datacenter segment continues to be the primary growth engine, driven by AI infrastructure demand.",
    status: "executed",
    created_at: "2026-04-12T10:00:00.000Z",
    source: "aggregated",
  },
  {
    id: "agent-2",
    ticker: "AAPL",
    direction: "long",
    composite_score: 0.25,
    confidence: 0.78,
    contributing_analyses: ["2"],
    conflicts: [],
    reasoning:
      "Services growth continues to accelerate, providing a higher-margin revenue mix. Hardware is stable. Overall a modestly bullish picture.",
    status: "buy",
    created_at: "2026-04-12T09:00:00.000Z",
    source: "agent",
    agent_type: "filing",
    recommendation: "buy",
  },
  {
    id: "agent-3",
    ticker: "XOM",
    direction: "short",
    composite_score: -0.3,
    confidence: 0.72,
    contributing_analyses: ["3"],
    conflicts: [],
    reasoning:
      "ESG headwinds and increasing capex commitments may pressure margins. Macro regime shifting risk-off is negative for energy.",
    status: "reduce_exposure",
    created_at: "2026-04-12T10:30:00.000Z",
    source: "agent",
    agent_type: "sentiment",
    recommendation: "reduce_exposure",
  },
];

export default function SignalsPage() {
  const [signals, setSignals] = useState<UnifiedSignal[]>(DEMO_SIGNALS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "aggregated" | "agent">("all");

  useEffect(() => {
    if (!supabase) return;

    async function fetchAll() {
      // Fetch aggregated trade signals
      const { data: tradeSignals } = await supabase!
        .from("trade_signals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      // Fetch agent analyses with actionable recommendations
      const { data: analyses } = await supabase!
        .from("agent_analyses")
        .select("*")
        .in("recommendation", ACTIONABLE_RECOMMENDATIONS)
        .order("analyzed_at", { ascending: false })
        .limit(100);

      const unified: UnifiedSignal[] = [];

      // Add aggregated signals
      if (tradeSignals?.length) {
        for (const s of tradeSignals) {
          unified.push(tradeSignalToUnified(s));
        }
      }

      // Add agent analyses, but skip if the ticker already has an aggregated signal
      // from the same time window (within 1 hour) to avoid duplicates
      const aggregatedTickers = new Set(
        unified.map((s) => `${s.ticker}-${new Date(s.created_at).toISOString().slice(0, 13)}`)
      );

      if (analyses?.length) {
        for (const a of analyses) {
          const key = `${a.ticker}-${new Date(a.analyzed_at).toISOString().slice(0, 13)}`;
          if (!aggregatedTickers.has(key)) {
            unified.push(analysisToUnified(a));
          }
        }
      }

      // Sort by time, most recent first
      unified.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      if (unified.length) setSignals(unified);
    }

    fetchAll();

    // Realtime for trade_signals
    const ch1 = supabase
      .channel("trade-signals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trade_signals" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setSignals((prev) => [
              tradeSignalToUnified(payload.new as TradeSignal),
              ...prev,
            ]);
          } else if (payload.eventType === "UPDATE") {
            const updated = tradeSignalToUnified(payload.new as TradeSignal);
            setSignals((prev) =>
              prev.map((s) => (s.id === updated.id ? updated : s))
            );
          }
        }
      )
      .subscribe();

    // Realtime for agent_analyses
    const ch2 = supabase
      .channel("agent-signals")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_analyses" },
        (payload) => {
          const a = payload.new as AgentAnalysis;
          if (
            ACTIONABLE_RECOMMENDATIONS.includes(
              (a.recommendation ?? "").toLowerCase()
            )
          ) {
            setSignals((prev) => [analysisToUnified(a), ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(ch1);
      supabase!.removeChannel(ch2);
    };
  }, []);

  const filtered =
    filter === "all"
      ? signals
      : signals.filter((s) => s.source === filter);

  const selectedSignal = signals.find((s) => s.id === selectedId) ?? null;

  const agentCount = signals.filter((s) => s.source === "agent").length;
  const aggregatedCount = signals.filter(
    (s) => s.source === "aggregated"
  ).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-lg font-semibold"
          style={{ color: "var(--fg)" }}
        >
          Signals
        </h2>
        <div className="flex items-center gap-3">
          {!supabase && (
            <span
              className="text-[10px] px-2 py-1 font-mono uppercase tracking-wider"
              style={{
                color: "var(--yellow)",
                border: "1px solid var(--yellow)",
              }}
            >
              Demo
            </span>
          )}
          <span
            className="text-xs font-mono"
            style={{ color: "var(--fg-muted)" }}
          >
            {signals.length} total
          </span>
        </div>
      </div>

      {/* Source filter */}
      <div className="flex gap-0 mb-4">
        {[
          { key: "all" as const, label: `ALL (${signals.length})` },
          {
            key: "aggregated" as const,
            label: `AGGREGATED (${aggregatedCount})`,
          },
          { key: "agent" as const, label: `AGENT (${agentCount})` },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className="text-[10px] uppercase tracking-wider px-3 py-1.5 font-mono transition-colors"
            style={{
              color:
                filter === item.key ? "var(--bg)" : "var(--fg-secondary)",
              background: filter === item.key ? "var(--fg)" : "transparent",
              border: "1px solid var(--border)",
              marginLeft: item.key === "all" ? 0 : "-1px",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex gap-0" style={{ height: "calc(100vh - 180px)" }}>
        {/* Left: signal list */}
        <div
          className="overflow-y-auto space-y-0"
          style={{
            flex: selectedSignal ? "0 0 50%" : "1",
            transition: "flex 200ms ease",
          }}
        >
          {filtered.length === 0 ? (
            <div
              className="p-8 text-center text-sm"
              style={{
                border: "1px solid var(--border)",
                color: "var(--fg-muted)",
              }}
            >
              No signals yet. Run the orchestrator to generate signals.
            </div>
          ) : (
            filtered.map((signal) => (
              <SignalCard
                key={signal.id}
                signal={signal}
                selected={signal.id === selectedId}
                onClick={() =>
                  setSelectedId(signal.id === selectedId ? null : signal.id)
                }
              />
            ))
          )}
        </div>

        {/* Right: thesis panel */}
        {selectedSignal && (
          <div className="overflow-hidden" style={{ flex: "0 0 50%" }}>
            <ThesisPanel
              signal={selectedSignal}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
