"use client";

import { useEffect, useState } from "react";
import StatsBar from "@/components/StatsBar";
import PortfolioChart from "@/components/PortfolioChart";
import PositionTable from "@/components/PositionTable";
import Tile from "@/components/Tile";
import SectorDonut from "@/components/SectorDonut";
import FearGreedGauge from "@/components/FearGreedGauge";
import MacroTile from "@/components/MacroTile";
import CorrelationMatrix from "@/components/CorrelationMatrix";
import BetaVolTable from "@/components/BetaVolTable";
import NewsTile from "@/components/NewsTile";
import EarningsCalendar from "@/components/EarningsCalendar";
import { supabase } from "@/lib/supabase";
import type { PortfolioSnapshot, Position, Trade } from "@/lib/types";

function makeDemoChart() {
  // Deterministic — no Math.random(), no Date.now()
  return Array.from({ length: 30 }, (_, i) => ({
    date: `Day ${i + 1}`,
    value: Math.round(100000 + Math.sin(i / 3) * 5000 + i * 200),
  }));
}

const DEMO_POSITIONS: Position[] = [
  {
    ticker: "NVDA",
    qty: 15,
    side: "long",
    avg_entry_price: 875.5,
    current_price: 892.3,
    market_value: 13384.5,
    unrealized_pnl: 252.0,
    unrealized_pnl_pct: 0.019,
  },
  {
    ticker: "AAPL",
    qty: 30,
    side: "long",
    avg_entry_price: 198.2,
    current_price: 195.8,
    market_value: 5874.0,
    unrealized_pnl: -72.0,
    unrealized_pnl_pct: -0.012,
  },
  {
    ticker: "JPM",
    qty: 20,
    side: "long",
    avg_entry_price: 215.0,
    current_price: 221.5,
    market_value: 4430.0,
    unrealized_pnl: 130.0,
    unrealized_pnl_pct: 0.03,
  },
  {
    ticker: "XOM",
    qty: 25,
    side: "short",
    avg_entry_price: 118.4,
    current_price: 115.2,
    market_value: 2880.0,
    unrealized_pnl: 80.0,
    unrealized_pnl_pct: 0.027,
  },
];

export default function PortfolioPage() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [positions, setPositions] = useState<Position[]>(DEMO_POSITIONS);
  const [chartData, setChartData] = useState(makeDemoChart);
  const [todayTrades, setTodayTrades] = useState<Trade[]>([]);

  useEffect(() => {
    if (!supabase) return;

    supabase
      .from("portfolio_snapshots")
      .select("*")
      .order("snapshot_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) {
          setSnapshot(data[0]);
          if (data[0].positions) setPositions(data[0].positions);
        }
      });

    supabase
      .from("portfolio_snapshots")
      .select("total_value, snapshot_at")
      .order("snapshot_at", { ascending: true })
      .limit(30)
      .then(({ data }) => {
        if (data?.length) {
          setChartData(
            data.map((d) => ({
              date: new Date(d.snapshot_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              }),
              value: d.total_value,
            }))
          );
        }
      });

    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("trades")
      .select("*")
      .gte("opened_at", today)
      .order("opened_at", { ascending: false })
      .then(({ data }) => {
        if (data) setTodayTrades(data);
      });

    const channel = supabase
      .channel("portfolio-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "portfolio_snapshots" },
        (payload) => {
          setSnapshot(payload.new as PortfolioSnapshot);
          const p = (payload.new as PortfolioSnapshot).positions;
          if (p) setPositions(p);
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, []);

  const totalValue = snapshot?.total_value ?? 106568.5;
  const cash = snapshot?.cash ?? 79999.0;
  const dailyPnl = positions.reduce((sum, p) => sum + p.unrealized_pnl, 0);
  const dailyPnlPct = dailyPnl / totalValue;

  const stats = [
    {
      label: "Portfolio Value",
      value: `$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      change: `${dailyPnl >= 0 ? "+" : ""}$${dailyPnl.toFixed(0)} today`,
      positive: dailyPnl >= 0,
    },
    {
      label: "Daily P&L",
      value: `${dailyPnl >= 0 ? "+" : ""}$${dailyPnl.toFixed(0)}`,
      change: `${(dailyPnlPct * 100).toFixed(2)}%`,
      positive: dailyPnl >= 0,
    },
    {
      label: "Cash",
      value: `$${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    },
    {
      label: "Sharpe Ratio",
      value: snapshot?.sharpe_ratio?.toFixed(2) ?? "1.42",
      positive: true,
    },
    {
      label: "Max Drawdown",
      value: snapshot?.max_drawdown
        ? `${(snapshot.max_drawdown * 100).toFixed(1)}%`
        : "-2.1%",
      positive: false,
    },
    {
      label: "Win Rate",
      value: snapshot?.win_rate
        ? `${(snapshot.win_rate * 100).toFixed(0)}%`
        : "64%",
      positive: true,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: "var(--fg)" }}>
          Portfolio
        </h2>
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
      </div>

      {/* Stats row */}
      <Tile>
        <StatsBar stats={stats} />
      </Tile>

      {/* Row 1: Chart | Sector Donut | Fear & Greed */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Tile className="lg:col-span-2">
          <PortfolioChart data={chartData} />
        </Tile>
        <Tile>
          <SectorDonut positions={positions} />
        </Tile>
        <Tile>
          <FearGreedGauge />
        </Tile>
      </div>

      {/* Row 2: Positions (with sparklines) | Today's Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <PositionTable positions={positions} />
        </div>
        <Tile>
          <div className="p-4 h-full flex flex-col">
            <h3
              className="text-[10px] uppercase tracking-wider font-medium mb-3"
              style={{ color: "var(--fg-muted)" }}
            >
              Today&apos;s Trades
            </h3>
            <div className="flex-1">
              {todayTrades.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  No trades today
                </p>
              ) : (
                <div className="space-y-0">
                  {todayTrades.map((trade) => (
                    <div
                      key={trade.id}
                      className="flex items-center justify-between text-sm py-2"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono font-semibold"
                          style={{ color: "var(--fg)" }}
                        >
                          {trade.ticker}
                        </span>
                        <span
                          className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5"
                          style={{
                            color:
                              trade.direction === "long"
                                ? "var(--bg)"
                                : "var(--fg)",
                            background:
                              trade.direction === "long"
                                ? "var(--fg)"
                                : "transparent",
                            border: "1px solid var(--fg)",
                          }}
                        >
                          {trade.direction === "long" ? "BUY" : "SELL"}
                        </span>
                      </div>
                      <span
                        className="font-mono text-xs"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        {trade.quantity} shares
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Tile>
      </div>

      {/* Row 3: Correlation | Beta/Vol | Macro */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Tile>
          <CorrelationMatrix positions={positions} />
        </Tile>
        <Tile>
          <BetaVolTable positions={positions} />
        </Tile>
        <Tile>
          <MacroTile />
        </Tile>
      </div>

      {/* Row 4: News | Earnings Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Tile>
          <NewsTile positions={positions} />
        </Tile>
        <Tile>
          <EarningsCalendar />
        </Tile>
      </div>
    </div>
  );
}
