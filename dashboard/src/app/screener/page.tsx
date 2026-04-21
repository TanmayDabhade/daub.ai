"use client";

import { useEffect, useState, useCallback } from "react";
import type { ScreenerRow } from "@/app/api/screener/route";

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtMktCap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(0)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}

function fmtPct(v: number | null, decimals = 1): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}%`;
}

function rsiColor(rsi: number | null): string {
  if (rsi == null) return "var(--fg-muted)";
  if (rsi >= 70) return "var(--down)";
  if (rsi <= 30) return "var(--up)";
  return "var(--fg-dim)";
}

function rsiLabel(rsi: number | null): string {
  if (rsi == null) return "—";
  if (rsi >= 70) return `${rsi} OB`;
  if (rsi <= 30) return `${rsi} OS`;
  return String(rsi);
}

const SECT_COLOR: Record<string, string> = {
  tech: "var(--s-tech)", fin: "var(--s-fin)", hlth: "var(--s-hlth)",
  indu: "var(--s-indu)", cons: "var(--s-cons)", ener: "var(--s-ener)", def: "var(--s-def)",
};

const SECTORS = ["", "tech", "fin", "hlth", "indu", "cons", "ener", "def"];
const SECT_LABELS: Record<string, string> = {
  "": "All Sectors", tech: "Technology", fin: "Financials", hlth: "Healthcare",
  indu: "Industrials", cons: "Consumer", ener: "Energy", def: "Defense",
};

const SORT_COLS = [
  { k: "mktCap",     l: "Mkt Cap" },
  { k: "changePct",  l: "Change%" },
  { k: "price",      l: "Price" },
  { k: "pe",         l: "P/E" },
  { k: "rsi",        l: "RSI" },
  { k: "revGrowth",  l: "Rev Growth" },
  { k: "epsGrowth",  l: "EPS Growth" },
  { k: "volRatio",   l: "Volume Ratio" },
];

// ── Agent Run Modal ───────────────────────────────────────────────────────
function AgentModal({ ticker, name, onClose }: { ticker: string; name: string; onClose: () => void }) {
  const [agentType, setAgentType] = useState("all");
  const [focus, setFocus] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = () => {
    setRunning(true);
    setResult(null);
    // Simulate agent invocation — real connection to agent infrastructure to be wired up
    setTimeout(() => {
      setRunning(false);
      setResult(
        `Agent analysis queued for ${ticker}. The ${agentType === "all" ? "full agent swarm" : agentType + " agent"} ` +
        `will analyze "${focus || "general outlook"}" and post results to the Signal Desk.\n\n` +
        `Status: QUEUED → Connect agent orchestrator at /agents/orchestrator to execute.`
      );
    }, 1500);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }} onClick={onClose}>
      <div
        className="card"
        style={{ width: 480, maxWidth: "90vw", zIndex: 101 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-head">
          <span className="tkr" style={{ fontSize: 14 }}>{ticker}</span>
          <span className="dim" style={{ fontSize: 12 }}>{name}</span>
          <span style={{ flex: 1 }} />
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div className="mute" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Agent</div>
            <div style={{ display: "flex", gap: 4 }}>
              {["all", "filing", "sentiment", "earnings", "macro"].map((a) => (
                <button
                  key={a}
                  className={"btn " + (agentType === a ? "active" : "")}
                  onClick={() => setAgentType(a)}
                  style={{ textTransform: "capitalize" }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mute" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Focus (optional)</div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 12px", background: "var(--bg-2)",
              border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)",
            }}>
              <input
                placeholder="e.g. earnings risk, management guidance, competitive moat…"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                style={{ fontSize: 12 }}
              />
            </div>
          </div>
          {result && (
            <div style={{
              padding: 12, background: "var(--bg-1)",
              border: "1px solid var(--accent)", borderRadius: "var(--r-sm)",
              fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap",
              color: "var(--fg-dim)",
            }}>
              {result}
            </div>
          )}
          <button
            className="btn active"
            style={{ padding: "8px" }}
            onClick={run}
            disabled={running}
          >
            {running ? "Queuing…" : "Run Agent Analysis"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Screener ─────────────────────────────────────────────────────────
export default function ScreenerPage() {
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [sector, setSector] = useState("");
  const [minPE, setMinPE] = useState("");
  const [maxPE, setMaxPE] = useState("");
  const [minRSI, setMinRSI] = useState("");
  const [maxRSI, setMaxRSI] = useState("");
  const [maSignal, setMaSignal] = useState("");
  const [minMktCap, setMinMktCap] = useState("");
  const [search, setSearch] = useState("");

  // Sort
  const [sortBy, setSortBy] = useState("mktCap");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Agent modal
  const [agentTarget, setAgentTarget] = useState<{ ticker: string; name: string } | null>(null);

  const fetchScreener = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sector)   params.set("sector", sector);
      if (minPE)    params.set("minPE", minPE);
      if (maxPE)    params.set("maxPE", maxPE);
      if (minRSI)   params.set("minRSI", minRSI);
      if (maxRSI)   params.set("maxRSI", maxRSI);
      if (maSignal) params.set("maSignal", maSignal);
      if (minMktCap)params.set("minMktCap", minMktCap);
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
      const res = await fetch(`/api/screener?${params.toString()}`);
      const json = await res.json();
      setRows(json.rows ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [sector, minPE, maxPE, minRSI, maxRSI, maSignal, minMktCap, sortBy, sortDir]);

  useEffect(() => { fetchScreener(); }, [fetchScreener]);

  const filtered = search
    ? rows.filter(
        (r) =>
          r.ticker.toLowerCase().includes(search.toLowerCase()) ||
          r.name.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  const SortArrow = ({ col }: { col: string }) =>
    sortBy === col ? (
      <span style={{ marginLeft: 3, color: "var(--accent)" }}>{sortDir === "desc" ? "↓" : "↑"}</span>
    ) : null;

  return (
    <>
      {agentTarget && (
        <AgentModal
          ticker={agentTarget.ticker}
          name={agentTarget.name}
          onClose={() => setAgentTarget(null)}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Filter bar */}
        <div className="card">
          <div className="card-head">
            <h3>Market Screener</h3>
            <span className="sub">{filtered.length} results</span>
            <span style={{ flex: 1 }} />
            <button className="btn" onClick={fetchScreener} disabled={loading}>
              {loading ? "Loading…" : "↺ Refresh"}
            </button>
          </div>
          <div style={{
            padding: "12px 16px",
            display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
          }}>
            {/* Search */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "5px 10px",
              background: "var(--bg-2)", border: "1px solid var(--line-2)",
              borderRadius: "var(--r-sm)", minWidth: 200,
            }}>
              <span className="mute">⌕</span>
              <input
                placeholder="Symbol or company…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ fontSize: 12 }}
              />
            </div>

            {/* Sector */}
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              style={{
                background: "var(--bg-2)", border: "1px solid var(--line-2)",
                borderRadius: "var(--r-sm)", padding: "5px 10px",
                color: "var(--fg-dim)", fontSize: 11, cursor: "pointer",
              }}
            >
              {SECTORS.map((s) => (
                <option key={s} value={s}>{SECT_LABELS[s]}</option>
              ))}
            </select>

            {/* P/E range */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span className="mute">P/E</span>
              <input
                placeholder="min" value={minPE}
                onChange={(e) => setMinPE(e.target.value)}
                style={{
                  width: 52, padding: "5px 8px",
                  background: "var(--bg-2)", border: "1px solid var(--line-2)",
                  borderRadius: "var(--r-sm)", color: "var(--fg)", fontSize: 11,
                }}
              />
              <span className="mute">–</span>
              <input
                placeholder="max" value={maxPE}
                onChange={(e) => setMaxPE(e.target.value)}
                style={{
                  width: 52, padding: "5px 8px",
                  background: "var(--bg-2)", border: "1px solid var(--line-2)",
                  borderRadius: "var(--r-sm)", color: "var(--fg)", fontSize: 11,
                }}
              />
            </div>

            {/* RSI range */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span className="mute">RSI</span>
              <input
                placeholder="min" value={minRSI}
                onChange={(e) => setMinRSI(e.target.value)}
                style={{
                  width: 44, padding: "5px 8px",
                  background: "var(--bg-2)", border: "1px solid var(--line-2)",
                  borderRadius: "var(--r-sm)", color: "var(--fg)", fontSize: 11,
                }}
              />
              <span className="mute">–</span>
              <input
                placeholder="max" value={maxRSI}
                onChange={(e) => setMaxRSI(e.target.value)}
                style={{
                  width: 44, padding: "5px 8px",
                  background: "var(--bg-2)", border: "1px solid var(--line-2)",
                  borderRadius: "var(--r-sm)", color: "var(--fg)", fontSize: 11,
                }}
              />
            </div>

            {/* MA Signal */}
            <div style={{ display: "flex", gap: 3 }}>
              {[
                { v: "", l: "Any" },
                { v: "bullish", l: "Bull" },
                { v: "neutral", l: "Neutral" },
                { v: "bearish", l: "Bear" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  className={"btn " + (maSignal === opt.v ? "active" : "")}
                  onClick={() => setMaSignal(opt.v)}
                  style={{ fontSize: 10.5 }}
                >
                  {opt.l}
                </button>
              ))}
            </div>

            {/* Min Mkt Cap */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span className="mute">Min Cap ($B)</span>
              <input
                placeholder="e.g. 100" value={minMktCap}
                onChange={(e) => setMinMktCap(e.target.value)}
                style={{
                  width: 72, padding: "5px 8px",
                  background: "var(--bg-2)", border: "1px solid var(--line-2)",
                  borderRadius: "var(--r-sm)", color: "var(--fg)", fontSize: 11,
                }}
              />
            </div>

            {/* Sort by */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span className="mute">Sort</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  background: "var(--bg-2)", border: "1px solid var(--line-2)",
                  borderRadius: "var(--r-sm)", padding: "5px 8px",
                  color: "var(--fg-dim)", fontSize: 11,
                }}
              >
                {SORT_COLS.map((c) => (
                  <option key={c.k} value={c.k}>{c.l}</option>
                ))}
              </select>
              <button className="btn" onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")}>
                {sortDir === "desc" ? "↓" : "↑"}
              </button>
            </div>

            {/* Clear */}
            <button
              className="btn"
              onClick={() => {
                setSector(""); setMinPE(""); setMaxPE("");
                setMinRSI(""); setMaxRSI(""); setMaSignal("");
                setMinMktCap(""); setSearch("");
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Results table */}
        <div className="card">
          {error && (
            <div style={{ padding: "12px 16px", color: "var(--down)", fontSize: 12 }}>
              Error loading screener: {error}
            </div>
          )}
          {loading && (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--fg-muted)", fontSize: 12 }}>
              Fetching market data…
            </div>
          )}
          {!loading && !error && (
            <div style={{ overflow: "auto" }}>
              <table className="t">
                <thead>
                  <tr>
                    <th></th>
                    <th>Ticker</th>
                    <th>Company</th>
                    <th
                      style={{ cursor: "pointer" }}
                      onClick={() => toggleSort("price")}
                    >
                      Price <SortArrow col="price" />
                    </th>
                    <th
                      className="num"
                      style={{ cursor: "pointer" }}
                      onClick={() => toggleSort("changePct")}
                    >
                      Chg% <SortArrow col="changePct" />
                    </th>
                    <th
                      className="num"
                      style={{ cursor: "pointer" }}
                      onClick={() => toggleSort("mktCap")}
                    >
                      Mkt Cap <SortArrow col="mktCap" />
                    </th>
                    <th
                      className="num"
                      style={{ cursor: "pointer" }}
                      onClick={() => toggleSort("pe")}
                    >
                      P/E <SortArrow col="pe" />
                    </th>
                    <th className="num">Fwd P/E</th>
                    <th
                      className="num"
                      style={{ cursor: "pointer" }}
                      onClick={() => toggleSort("epsGrowth")}
                    >
                      EPS Grwth <SortArrow col="epsGrowth" />
                    </th>
                    <th
                      className="num"
                      style={{ cursor: "pointer" }}
                      onClick={() => toggleSort("revGrowth")}
                    >
                      Rev Grwth <SortArrow col="revGrowth" />
                    </th>
                    <th className="num">GM</th>
                    <th className="num">Beta</th>
                    <th
                      className="num"
                      style={{ cursor: "pointer" }}
                      onClick={() => toggleSort("rsi")}
                    >
                      RSI <SortArrow col="rsi" />
                    </th>
                    <th>MA Signal</th>
                    <th
                      className="num"
                      style={{ cursor: "pointer" }}
                      onClick={() => toggleSort("volRatio")}
                    >
                      Vol/Avg <SortArrow col="volRatio" />
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={16} style={{ textAlign: "center", padding: "32px", color: "var(--fg-muted)" }}>
                        No results match your filters
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => {
                      const priceVs50 = r.fiftyDayAvg ? ((r.price - r.fiftyDayAvg) / r.fiftyDayAvg) * 100 : null;
                      return (
                        <tr key={r.ticker}>
                          <td>
                            <span style={{
                              display: "inline-block", width: 3, height: 18, borderRadius: 2,
                              background: SECT_COLOR[r.sector] ?? "var(--fg-muted)",
                            }} />
                          </td>
                          <td><span className="tkr">{r.ticker}</span></td>
                          <td>
                            <span style={{ fontSize: 11.5, color: "var(--fg-dim)" }}>
                              {r.name.length > 22 ? r.name.slice(0, 22) + "…" : r.name}
                            </span>
                          </td>
                          <td className="num mono">{r.price > 0 ? r.price.toFixed(2) : "—"}</td>
                          <td className={"num mono " + (r.changePct >= 0 ? "up" : "down")}>
                            {fmtPct(r.changePct)}
                          </td>
                          <td className="num mono">{r.mktCap > 0 ? fmtMktCap(r.mktCap) : "—"}</td>
                          <td className="num mono">{r.pe != null ? r.pe.toFixed(1) : "—"}</td>
                          <td className="num mono">{r.fwdPE != null ? r.fwdPE.toFixed(1) : "—"}</td>
                          <td className={"num mono " + ((r.epsGrowth ?? 0) >= 0 ? "up" : "down")}>
                            {fmtPct(r.epsGrowth)}
                          </td>
                          <td className={"num mono " + ((r.revGrowth ?? 0) >= 0 ? "up" : "down")}>
                            {fmtPct(r.revGrowth)}
                          </td>
                          <td className="num mono">
                            {r.grossMargin != null ? `${r.grossMargin.toFixed(0)}%` : "—"}
                          </td>
                          <td className="num mono" style={{ color: "var(--fg-dim)" }}>
                            {r.beta != null ? r.beta.toFixed(2) : "—"}
                          </td>
                          <td className="num mono" style={{ color: rsiColor(r.rsi) }}>
                            {rsiLabel(r.rsi)}
                          </td>
                          <td>
                            <span className={
                              "pill " +
                              (r.maSignal === "bullish" ? "up" : r.maSignal === "bearish" ? "dn" : "")
                            } style={{ fontSize: 9.5 }}>
                              {r.maSignal === "bullish" ? "▲ Bull" : r.maSignal === "bearish" ? "▼ Bear" : "● Neutral"}
                            </span>
                            {priceVs50 != null && (
                              <span
                                className={"mono " + (priceVs50 >= 0 ? "up" : "down")}
                                style={{ fontSize: 9.5, marginLeft: 5 }}
                              >
                                {priceVs50 >= 0 ? "+" : ""}{priceVs50.toFixed(1)}% vs 50d
                              </span>
                            )}
                          </td>
                          <td className="num mono" style={{ color: r.volRatio >= 1.5 ? "var(--accent)" : "var(--fg-dim)" }}>
                            {r.volRatio > 0 ? `${r.volRatio.toFixed(1)}x` : "—"}
                          </td>
                          <td>
                            <button
                              className="btn"
                              style={{
                                background: "var(--accent-bg)", color: "var(--accent-hi)",
                                borderColor: "transparent", fontSize: 10,
                              }}
                              onClick={() => setAgentTarget({ ticker: r.ticker, name: r.name })}
                            >
                              ◇ Run Agent
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Industry quick-run */}
        <div className="card">
          <div className="card-head">
            <h3>Run Agent on Industry</h3>
            <span className="sub">bulk analysis across a sector</span>
          </div>
          <div style={{ padding: "14px 18px", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(SECT_LABELS).filter(([k]) => k !== "").map(([k, l]) => (
              <button
                key={k}
                className="btn"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  paddingLeft: 10,
                }}
                onClick={() =>
                  setAgentTarget({
                    ticker: l.toUpperCase(),
                    name: `All ${l} stocks in universe`,
                  })
                }
              >
                <span style={{
                  display: "inline-block", width: 8, height: 8, borderRadius: 2,
                  background: SECT_COLOR[k],
                }} />
                {l}
              </button>
            ))}
          </div>
          <div className="mute" style={{ padding: "0 18px 14px", fontSize: 11 }}>
            Sector-level analysis will run sentiment, macro, and filing agents across all matching tickers simultaneously.
          </div>
        </div>
      </div>
    </>
  );
}
