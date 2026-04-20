"use client";

import { useEffect, useState } from "react";
import AgentFeed from "@/components/AgentFeed";
import { supabase } from "@/lib/supabase";
import type { AgentAnalysis } from "@/lib/types";

const DEMO_ANALYSES: AgentAnalysis[] = [
  {
    id: "1",
    ticker: "NVDA",
    agent_type: "filing",
    analysis: {},
    signals: [
      {
        type: "risk_factor_change",
        description:
          "New risk factor added regarding export controls on H200 chips to China",
        sentiment: "negative",
        confidence: 0.85,
        evidence:
          "The Company faces risks related to new export restrictions...",
      },
      {
        type: "revenue_surprise",
        description:
          "Datacenter revenue grew 154% YoY, exceeding analyst estimates by 12%",
        sentiment: "positive",
        confidence: 0.92,
        evidence:
          "Data Center revenue was $18.4 billion, up 154% from a year ago...",
      },
    ],
    overall_sentiment: 0.35,
    confidence: 0.88,
    recommendation: "hold",
    reasoning:
      "Mixed signals: exceptional revenue growth in datacenter offset by escalating export control risks. The China exposure creates meaningful downside risk that tempers the bullish top-line growth story.",
    source_url: "https://www.sec.gov/Archives/edgar/data/1045810/...",
    analyzed_at: "2026-04-12T09:00:00.000Z",
  },
  {
    id: "2",
    ticker: "NVDA",
    agent_type: "sentiment",
    analysis: {},
    signals: [
      {
        type: "analyst_action",
        description:
          "Goldman Sachs raised price target to $1100 from $950",
        sentiment: "positive",
        confidence: 0.75,
        evidence:
          "Goldman Sachs analyst Toshiya Hari raised his price target...",
      },
      {
        type: "material_event",
        description:
          "Reports of Blackwell chip delays for some customers",
        sentiment: "negative",
        confidence: 0.6,
        evidence:
          "Some customers experiencing delays in Blackwell GPU deliveries...",
      },
    ],
    overall_sentiment: 0.2,
    confidence: 0.7,
    recommendation: "hold",
    reasoning:
      "Analyst sentiment remains bullish with multiple price target raises, but supply chain concerns around Blackwell create near-term uncertainty.",
    source_url: "",
    analyzed_at: "2026-04-12T09:30:00.000Z",
  },
  {
    id: "3",
    ticker: "AAPL",
    agent_type: "filing",
    analysis: {},
    signals: [
      {
        type: "guidance_change",
        description:
          "Services revenue guidance raised, hardware guidance maintained",
        sentiment: "positive",
        confidence: 0.78,
        evidence:
          "We expect Services to grow in the low double digits...",
      },
    ],
    overall_sentiment: 0.25,
    confidence: 0.78,
    recommendation: "buy",
    reasoning:
      "Services growth continues to accelerate, providing a higher-margin revenue mix. Hardware is stable. Overall a modestly bullish picture.",
    source_url: "",
    analyzed_at: "2026-04-12T08:00:00.000Z",
  },
  {
    id: "4",
    ticker: "MACRO",
    agent_type: "macro",
    analysis: {},
    signals: [
      {
        type: "regime_change",
        description:
          "Fed minutes suggest rate cuts delayed to H2 2026",
        sentiment: "negative",
        confidence: 0.72,
        evidence:
          "Several participants noted that restrictive policy may need to be maintained...",
      },
      {
        type: "sector_rotation",
        description:
          "Shift from growth to value stocks accelerating",
        sentiment: "neutral",
        confidence: 0.65,
        evidence:
          "Value stocks have outperformed growth by 4.2% over the past month...",
      },
    ],
    overall_sentiment: -0.15,
    confidence: 0.7,
    recommendation: "risk_off",
    reasoning:
      "The macro environment is shifting toward a risk-off regime. Fed rate cut expectations are being pushed out, which is negative for growth stocks and duration-sensitive assets.",
    source_url: "",
    analyzed_at: "2026-04-12T09:45:00.000Z",
  },
];

export default function AgentsPage() {
  const [analyses, setAnalyses] = useState<AgentAnalysis[]>(DEMO_ANALYSES);

  useEffect(() => {
    if (!supabase) return;

    supabase
      .from("agent_analyses")
      .select("*")
      .order("analyzed_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data?.length) setAnalyses(data);
      });

    const channel = supabase
      .channel("agent-analyses")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_analyses" },
        (payload) => {
          setAnalyses((prev) => [payload.new as AgentAnalysis, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: "var(--fg)" }}>
          Agent Activity
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
            {analyses.length} analyses
          </span>
        </div>
      </div>

      <AgentFeed analyses={analyses} />
    </div>
  );
}
