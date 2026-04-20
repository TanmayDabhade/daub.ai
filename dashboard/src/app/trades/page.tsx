"use client";

import { useEffect, useState } from "react";
import TradeRow from "@/components/TradeRow";
import { supabase } from "@/lib/supabase";
import type { Trade } from "@/lib/types";

const DEMO_TRADES: Trade[] = [
  {
    id: "1",
    signal_id: "1",
    ticker: "NVDA",
    direction: "long",
    quantity: 15,
    entry_price: 875.5,
    exit_price: null,
    pnl: null,
    alpaca_order_id: "mock-001",
    status: "open",
    opened_at: "2026-04-10T14:00:00.000Z",
    closed_at: null,
  },
  {
    id: "2",
    signal_id: "2",
    ticker: "META",
    direction: "long",
    quantity: 12,
    entry_price: 520.3,
    exit_price: 535.8,
    pnl: 186.0,
    alpaca_order_id: "mock-002",
    status: "closed",
    opened_at: "2026-04-07T10:00:00.000Z",
    closed_at: "2026-04-09T16:00:00.000Z",
  },
  {
    id: "3",
    signal_id: "3",
    ticker: "JPM",
    direction: "long",
    quantity: 20,
    entry_price: 215.0,
    exit_price: null,
    pnl: null,
    alpaca_order_id: "mock-003",
    status: "open",
    opened_at: "2026-04-11T13:00:00.000Z",
    closed_at: null,
  },
  {
    id: "4",
    signal_id: "4",
    ticker: "TSLA",
    direction: "short",
    quantity: 8,
    entry_price: 248.9,
    exit_price: 255.2,
    pnl: -50.4,
    alpaca_order_id: "mock-004",
    status: "stopped_out",
    opened_at: "2026-04-08T09:30:00.000Z",
    closed_at: "2026-04-09T16:00:00.000Z",
  },
  {
    id: "5",
    signal_id: "5",
    ticker: "XOM",
    direction: "short",
    quantity: 25,
    entry_price: 118.4,
    exit_price: null,
    pnl: null,
    alpaca_order_id: "mock-005",
    status: "open",
    opened_at: "2026-04-11T02:00:00.000Z",
    closed_at: null,
  },
];

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>(DEMO_TRADES);

  useEffect(() => {
    if (!supabase) return;

    supabase
      .from("trades")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data?.length) setTrades(data);
      });

    const channel = supabase
      .channel("trades")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trades" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setTrades((prev) => [payload.new as Trade, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setTrades((prev) =>
              prev.map((t) =>
                t.id === (payload.new as Trade).id
                  ? (payload.new as Trade)
                  : t
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, []);

  const closedTrades = trades.filter((t) => t.status !== "open");
  const winningTrades = closedTrades.filter((t) => (t.pnl ?? 0) > 0);
  const winRate =
    closedTrades.length > 0
      ? winningTrades.length / closedTrades.length
      : 0;
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const avgWin =
    winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0) /
        winningTrades.length
      : 0;
  const losingTrades = closedTrades.filter((t) => (t.pnl ?? 0) < 0);
  const avgLoss =
    losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0) /
        losingTrades.length
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: "var(--fg)" }}>
          Trade Log
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

      {/* Summary stats */}
      <div
        className="grid grid-cols-2 md:grid-cols-5 gap-px"
        style={{ background: "var(--border)" }}
      >
        <div className="p-3" style={{ background: "var(--bg)" }}>
          <p
            className="text-[10px] uppercase tracking-wider"
            style={{ color: "var(--fg-muted)" }}
          >
            Total Trades
          </p>
          <p
            className="text-lg font-mono font-semibold"
            style={{ color: "var(--fg)" }}
          >
            {trades.length}
          </p>
        </div>
        <div className="p-3" style={{ background: "var(--bg)" }}>
          <p
            className="text-[10px] uppercase tracking-wider"
            style={{ color: "var(--fg-muted)" }}
          >
            Win Rate
          </p>
          <p
            className="text-lg font-mono font-semibold"
            style={{ color: "var(--green)" }}
          >
            {(winRate * 100).toFixed(0)}%
          </p>
        </div>
        <div className="p-3" style={{ background: "var(--bg)" }}>
          <p
            className="text-[10px] uppercase tracking-wider"
            style={{ color: "var(--fg-muted)" }}
          >
            Total P&L
          </p>
          <p
            className="text-lg font-mono font-semibold"
            style={{
              color: totalPnl >= 0 ? "var(--green)" : "var(--red)",
            }}
          >
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </p>
        </div>
        <div className="p-3" style={{ background: "var(--bg)" }}>
          <p
            className="text-[10px] uppercase tracking-wider"
            style={{ color: "var(--fg-muted)" }}
          >
            Avg Win
          </p>
          <p
            className="text-lg font-mono font-semibold"
            style={{ color: "var(--green)" }}
          >
            +${avgWin.toFixed(2)}
          </p>
        </div>
        <div className="p-3" style={{ background: "var(--bg)" }}>
          <p
            className="text-[10px] uppercase tracking-wider"
            style={{ color: "var(--fg-muted)" }}
          >
            Avg Loss
          </p>
          <p
            className="text-lg font-mono font-semibold"
            style={{ color: "var(--red)" }}
          >
            ${avgLoss.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Trade table */}
      <div style={{ border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-[10px] uppercase tracking-wider"
                style={{
                  borderBottom: "1px solid var(--border)",
                  color: "var(--fg-muted)",
                }}
              >
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Ticker</th>
                <th className="text-left px-4 py-3 font-medium">Direction</th>
                <th className="text-right px-4 py-3 font-medium">Qty</th>
                <th className="text-right px-4 py-3 font-medium">Entry</th>
                <th className="text-right px-4 py-3 font-medium">Exit</th>
                <th className="text-right px-4 py-3 font-medium">P&L</th>
                <th className="text-right px-4 py-3 font-medium">Duration</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <TradeRow key={trade.id} trade={trade} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
