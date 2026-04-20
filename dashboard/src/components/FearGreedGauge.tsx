"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function gaugeColor(value: number): string {
  if (value <= 25) return "var(--red)";
  if (value <= 45) return "var(--yellow)";
  if (value <= 55) return "var(--fg-muted)";
  if (value <= 75) return "var(--yellow)";
  return "var(--green)";
}

function gaugeLabel(value: number): string {
  if (value <= 25) return "EXTREME FEAR";
  if (value <= 45) return "FEAR";
  if (value <= 55) return "NEUTRAL";
  if (value <= 75) return "GREED";
  return "EXTREME GREED";
}

export default function FearGreedGauge() {
  const [value, setValue] = useState(52); // 0-100

  useEffect(() => {
    if (!supabase) return;

    // Compute sentiment from recent agent analyses
    supabase
      .from("agent_analyses")
      .select("overall_sentiment, confidence")
      .order("analyzed_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!data?.length) return;
        // Weighted average sentiment, map from [-1,1] to [0,100]
        let totalWeight = 0;
        let weightedSum = 0;
        for (const row of data) {
          const w = row.confidence ?? 0.5;
          weightedSum += (row.overall_sentiment ?? 0) * w;
          totalWeight += w;
        }
        if (totalWeight > 0) {
          const avg = weightedSum / totalWeight; // -1 to 1
          setValue(Math.round((avg + 1) * 50)); // 0 to 100
        }
      });
  }, []);

  const color = gaugeColor(value);
  const label = gaugeLabel(value);

  // SVG arc gauge
  const radius = 60;
  const cx = 75;
  const cy = 70;
  const startAngle = Math.PI;
  const endAngle = 0;
  const valueAngle = startAngle - (value / 100) * Math.PI;

  const arcPath = (start: number, end: number, r: number) => {
    const x1 = cx + r * Math.cos(start);
    const y1 = cy - r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy - r * Math.sin(end);
    const largeArc = Math.abs(start - end) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Needle position
  const needleX = cx + (radius - 8) * Math.cos(valueAngle);
  const needleY = cy - (radius - 8) * Math.sin(valueAngle);

  return (
    <div className="p-4 h-full flex flex-col">
      <h3
        className="text-[10px] uppercase tracking-wider font-medium mb-2"
        style={{ color: "var(--fg-muted)" }}
      >
        Market Sentiment
      </h3>
      <div className="flex-1 flex flex-col items-center justify-center">
        <svg width="150" height="90" viewBox="0 0 150 90">
          {/* Background arc */}
          <path
            d={arcPath(startAngle, endAngle, radius)}
            fill="none"
            stroke="var(--border)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Value arc */}
          <path
            d={arcPath(startAngle, valueAngle, radius)}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Needle dot */}
          <circle cx={needleX} cy={needleY} r="4" fill={color} />
          {/* Center value */}
          <text
            x={cx}
            y={cy - 8}
            textAnchor="middle"
            fill="var(--fg)"
            fontSize="22"
            fontWeight="bold"
            fontFamily="var(--font-geist-mono)"
          >
            {value}
          </text>
          {/* Labels */}
          <text
            x="15"
            y={cy + 12}
            fill="var(--fg-muted)"
            fontSize="8"
            fontFamily="var(--font-geist-mono)"
          >
            FEAR
          </text>
          <text
            x="118"
            y={cy + 12}
            fill="var(--fg-muted)"
            fontSize="8"
            fontFamily="var(--font-geist-mono)"
          >
            GREED
          </text>
        </svg>
        <p
          className="text-[10px] font-mono uppercase tracking-wider mt-1"
          style={{ color }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}
