"use client";

import { useEffect, useState } from "react";
import ConfBar from "@/components/ConfBar";
import { supabase } from "@/lib/supabase";
import type { Trade } from "@/lib/types";

const BLOTTER_ROWS = [
  { id: "#2847", ts: "14:29", tk: "AVGO", dir: "Buy",    qty: 4,  px: 1846.20, n: 7384.80,  st: "Filled",   c: 0.88, lat: "124 ms" },
  { id: "#2846", ts: "13:47", tk: "TSLA", dir: "Sell",   qty: 12, px: 348.55,  n: 4182.60,  st: "Filled",   c: 0.68, lat: "98 ms" },
  { id: "#2845", ts: "11:22", tk: "LLY",  dir: "Buy",    qty: 3,  px: 826.10,  n: 2478.30,  st: "Filled",   c: 0.91, lat: "156 ms" },
  { id: "#2844", ts: "10:08", tk: "XOM",  dir: "Cover",  qty: 10, px: 115.80,  n: 1158.00,  st: "Partial",  c: 0.71, lat: "212 ms" },
  { id: "#2843", ts: "09:34", tk: "NVDA", dir: "Buy",    qty: 5,  px: 889.40,  n: 4447.00,  st: "Filled",   c: 0.87, lat: "88 ms" },
  { id: "#2842", ts: "09:31", tk: "GS",   dir: "Buy",    qty: 2,  px: 610.50,  n: 1221.00,  st: "Rejected", c: 0.64, lat: "44 ms", rsn: "confidence below threshold" },
];

function QRow({ l, v, cls }: { l: string; v: string; cls?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span className="mute" style={{ fontSize: 11, flex: 1 }}>{l}</span>
      <span className={"mono " + (cls || "")} style={{ fontSize: 13, fontWeight: 500 }}>{v}</span>
    </div>
  );
}

function OrderField({ l, v, pill }: { l: string; v: string; pill?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 12px", background: "var(--bg-2)", borderRadius: "var(--r-sm)",
    }}>
      <span className="mute" style={{ fontSize: 10.5, width: 54, textTransform: "uppercase", letterSpacing: "0.04em" }}>{l}</span>
      {pill
        ? <span className={"pill " + pill} style={{ fontSize: 10 }}>{v}</span>
        : <span className="mono" style={{ fontWeight: 500 }}>{v}</span>
      }
    </div>
  );
}

export default function BlotterPage() {
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = statusFilter === "All"
    ? BLOTTER_ROWS
    : BLOTTER_ROWS.filter((r) =>
        statusFilter === "Filled" ? r.st === "Filled" : r.st !== "Filled" && r.st !== "Rejected"
      );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14 }}>
      {/* Blotter table */}
      <div className="card">
        <div className="card-head">
          <h3>Blotter</h3>
          <span className="sub">paper account · Alpaca</span>
          <span style={{ flex: 1 }} />
          {["All", "Filled", "Pending"].map((f) => (
            <button
              key={f}
              className={"btn " + (statusFilter === f ? "active" : "")}
              onClick={() => setStatusFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div style={{ overflow: "auto" }}>
          <table className="t">
            <thead>
              <tr>
                <th>Order</th>
                <th>Time</th>
                <th>Ticker</th>
                <th>Side</th>
                <th className="num">Qty</th>
                <th className="num">Price</th>
                <th className="num">Notional</th>
                <th>Status</th>
                <th>Conf.</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="mute mono">{r.id}</td>
                  <td className="mute">{r.ts}</td>
                  <td><span className="tkr">{r.tk}</span></td>
                  <td>
                    <span className={"pill " + (r.dir === "Buy" ? "up" : r.dir === "Sell" ? "dn" : "acc")}>
                      {r.dir}
                    </span>
                  </td>
                  <td className="num">{r.qty}</td>
                  <td className="num">{r.px.toFixed(2)}</td>
                  <td className="num">${r.n.toLocaleString()}</td>
                  <td>
                    <span className={"pill " + (r.st === "Filled" ? "up" : r.st === "Rejected" ? "dn" : "gold")}>
                      {r.st}
                    </span>
                    {"rsn" in r && r.rsn && (
                      <div className="mute" style={{ fontSize: 10, marginTop: 3 }}>{r.rsn}</div>
                    )}
                  </td>
                  <td><ConfBar v={r.c} /></td>
                  <td className="mute mono" style={{ fontSize: 11 }}>{r.lat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="card">
          <div className="card-head"><h3>Execution health · 24h</h3></div>
          <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
            <QRow l="Orders"       v="47" />
            <QRow l="Fill rate"    v="95.7%" cls="up" />
            <QRow l="Avg latency"  v="126 ms" />
            <QRow l="Avg slippage" v="1.8 bp" />
            <QRow l="Rejected"     v="2" />
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Manual entry</h3></div>
          <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10, fontSize: 11.5 }}>
            <OrderField l="Symbol" v="NVDA" />
            <OrderField l="Side"   v="Buy"         pill="up" />
            <OrderField l="Qty"    v="10" />
            <OrderField l="Type"   v="Limit @ 892.00" />

            <div style={{ padding: 10, background: "var(--bg-2)", borderRadius: "var(--r-sm)" }}>
              <div style={{ display: "flex", fontSize: 11 }}>
                <span className="mute" style={{ flex: 1 }}>Notional</span>
                <span className="mono">$8,920.00</span>
              </div>
              <div style={{ display: "flex", fontSize: 11, marginTop: 3 }}>
                <span className="mute" style={{ flex: 1 }}>Risk check</span>
                <span className="mono up">Pass</span>
              </div>
            </div>

            <button className="btn active" style={{ padding: "8px" }}>Submit order</button>
            <div className="mute" style={{ fontSize: 10, textAlign: "center" }}>
              Paper account · no real capital at risk
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
