"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface MacroData {
  regime: string;
  confidence: number;
  indicators: { label: string; value: string; direction: string }[];
  summary: string;
}

const DEMO: MacroData = {
  regime: "Risk-Off",
  confidence: 0.72,
  indicators: [
    { label: "Fed Stance", value: "Restrictive", direction: "negative" },
    { label: "Yield Curve", value: "Inverted", direction: "negative" },
    { label: "VIX Trend", value: "Elevated", direction: "negative" },
    { label: "GDP Growth", value: "Slowing", direction: "neutral" },
    { label: "Inflation", value: "Cooling", direction: "positive" },
  ],
  summary:
    "Risk-off regime. Rate cuts delayed to H2 2026. Sector rotation from growth to value accelerating.",
};

function parseAnalysis(analysis: Record<string, unknown>): MacroData {
  const regime = analysis.regime as
    | { classification?: string; confidence?: number }
    | undefined;
  const indicators =
    (analysis.key_indicators as { label: string; value: string; direction: string }[]) ??
    (analysis.indicators as { label: string; value: string; direction: string }[]) ??
    [];

  return {
    regime: regime?.classification ?? (analysis.regime_classification as string) ?? "Unknown",
    confidence: regime?.confidence ?? (analysis.confidence as number) ?? 0,
    indicators: indicators.length ? indicators : DEMO.indicators,
    summary:
      (analysis.summary as string) ??
      (analysis.reasoning as string) ??
      "",
  };
}

export default function MacroTile() {
  const [data, setData] = useState<MacroData>(DEMO);

  useEffect(() => {
    if (!supabase) return;

    supabase
      .from("agent_analyses")
      .select("analysis, reasoning, confidence")
      .eq("agent_type", "macro")
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .then(({ data: rows }) => {
        if (rows?.[0]) {
          const parsed = parseAnalysis(rows[0].analysis as Record<string, unknown>);
          if (!parsed.summary && rows[0].reasoning) {
            parsed.summary = rows[0].reasoning;
          }
          if (!parsed.confidence && rows[0].confidence) {
            parsed.confidence = rows[0].confidence;
          }
          setData(parsed);
        }
      });
  }, []);

  const dirColor = (d: string) => {
    if (d === "positive") return "var(--green)";
    if (d === "negative") return "var(--red)";
    return "var(--fg-muted)";
  };

  return (
    <div className="p-4 h-full flex flex-col">
      <h3
        className="text-[10px] uppercase tracking-wider font-medium mb-3"
        style={{ color: "var(--fg-muted)" }}
      >
        Macro Regime
      </h3>

      <div className="flex items-center gap-3 mb-3">
        <span
          className="font-mono font-bold text-sm uppercase"
          style={{ color: "var(--fg)" }}
        >
          {data.regime}
        </span>
        <span
          className="text-[10px] font-mono"
          style={{ color: "var(--fg-muted)" }}
        >
          {(data.confidence * 100).toFixed(0)}% conf
        </span>
      </div>

      <div className="space-y-1.5 mb-3">
        {data.indicators.map((ind, idx) => (
          <div
            key={`${ind.label}-${idx}`}
            className="flex items-center justify-between"
          >
            <span
              className="text-[11px]"
              style={{ color: "var(--fg-secondary)" }}
            >
              {ind.label}
            </span>
            <span
              className="text-[11px] font-mono"
              style={{ color: dirColor(ind.direction) }}
            >
              {ind.value}
            </span>
          </div>
        ))}
      </div>

      {data.summary && (
        <p
          className="text-[11px] leading-relaxed mt-auto"
          style={{ color: "var(--fg-muted)" }}
        >
          {data.summary.substring(0, 150)}
          {data.summary.length > 150 ? "..." : ""}
        </p>
      )}
    </div>
  );
}
