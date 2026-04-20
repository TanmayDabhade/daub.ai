"use client";

interface EarningsEvent {
  ticker: string;
  date: string;
  time: "BMO" | "AMC" | "TBD"; // before market open, after market close
  estimate: string;
}

// Demo earnings data — in production this would come from Financial Modeling Prep API
const DEMO_EARNINGS: EarningsEvent[] = [
  { ticker: "AAPL", date: "2026-04-24", time: "AMC", estimate: "$1.62" },
  { ticker: "MSFT", date: "2026-04-22", time: "AMC", estimate: "$3.22" },
  { ticker: "META", date: "2026-04-23", time: "AMC", estimate: "$5.28" },
  { ticker: "GOOGL", date: "2026-04-24", time: "AMC", estimate: "$2.01" },
  { ticker: "AMZN", date: "2026-04-29", time: "AMC", estimate: "$1.38" },
  { ticker: "NVDA", date: "2026-05-21", time: "AMC", estimate: "$0.89" },
  { ticker: "JPM", date: "2026-04-15", time: "BMO", estimate: "$4.81" },
  { ticker: "UNH", date: "2026-04-15", time: "BMO", estimate: "$7.29" },
  { ticker: "JNJ", date: "2026-04-15", time: "BMO", estimate: "$2.58" },
  { ticker: "PFE", date: "2026-04-29", time: "BMO", estimate: "$0.65" },
];

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

export default function EarningsCalendar() {
  // Sort by date, show upcoming first
  const sorted = [...DEMO_EARNINGS].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="p-4 h-full flex flex-col">
      <h3
        className="text-[10px] uppercase tracking-wider font-medium mb-3"
        style={{ color: "var(--fg-muted)" }}
      >
        Earnings Calendar
      </h3>
      <div className="flex-1 overflow-y-auto space-y-0">
        {sorted.map((e) => {
          const days = daysUntil(e.date);
          const isPast = days < 0;
          const isSoon = days >= 0 && days <= 7;
          return (
            <div
              key={`${e.ticker}-${e.date}`}
              className="flex items-center justify-between py-2"
              style={{
                borderBottom: "1px solid var(--border)",
                opacity: isPast ? 0.4 : 1,
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="font-mono font-semibold text-[12px] w-12"
                  style={{ color: "var(--fg)" }}
                >
                  {e.ticker}
                </span>
                <span
                  className="text-[11px]"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span
                  className="text-[9px] font-mono px-1 py-0.5"
                  style={{
                    color: "var(--fg-muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {e.time}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] font-mono"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  Est {e.estimate}
                </span>
                {isSoon && !isPast && (
                  <span
                    className="text-[9px] font-mono px-1 py-0.5"
                    style={{
                      color: "var(--yellow)",
                      border: "1px solid var(--yellow)",
                    }}
                  >
                    {days === 0 ? "TODAY" : `${days}D`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
