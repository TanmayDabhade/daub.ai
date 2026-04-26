"use client";

import { useMemo } from "react";

type Props = { ticker: string };

type Verdict = {
  call: string;
  weight: string;
  confidence: number;
  summary: string;
  entry: string;
  stop: string;
  target: string;
  review: string;
  reasonsGood: string[];
  reasonsBad: string[];
};

type Stat = { l: string; v: string; s?: string; tone?: "up" | "dn" | "" };

type Note = {
  ag: string;
  role: string;
  body: React.ReactNode;
  chips: string[];
  vote: "up" | "dn" | "neutral";
  voteLabel: string;
  conf: number;
  ts: string;
};

type Hold = {
  t: string;
  n: string;
  stance: "long" | "short";
  px: number;
  ch: number;
  w: number;
  conf: number;
  pnl: number;
  ts: string;
};

const DEFAULT_DATA: Record<string, { name: string; exch: string; sector: string; px: number; chg: number; chgPct: number; verdict: Verdict; stats: Stat[] }> = {
  NVDA: {
    name: "NVIDIA Corporation",
    exch: "NASDAQ",
    sector: "Semis",
    px: 199.64,
    chg: 11.97,
    chgPct: 6.38,
    verdict: {
      call: "Accumulate",
      weight: "4.0% weight",
      confidence: 0.95,
      summary:
        "Four of five agents align long. The tape is with us today, and the 10-Q was cleaner than the Street expected. The one caveat is export-policy risk on the China book; real, but already partly priced. Staged entry over two sessions to avoid paying up on a single print.",
      entry: "staged · 2d",
      stop: "$178.00",
      target: "$240.00",
      review: "12 mo.",
      reasonsGood: [
        "Data-center super-cycle intact; sovereign-AI backlog still accruing (~$8B disclosed).",
        "Gross margin leadership in accelerators; pricing power holds.",
        "Trend structure intact — 52-week high at $212.19, held above the 50-day.",
        "Ecosystem lock-in via CUDA; switching cost remains the moat.",
      ],
      reasonsBad: [
        "Customer concentration: top four hyperscalers dominate the book.",
        "China-restricted revenue risk on any export policy tightening.",
        "Valuation leaves no margin for an execution miss (fwd P/E 48×).",
        "Inventory & supply normalization could compress the multiple.",
      ],
    },
    stats: [
      { l: "Day Range", v: "197.22 – 203.83", s: "intraday" },
      { l: "52W High", v: "212.19", s: "−5.9% from high", tone: "dn" },
      { l: "52W Low", v: "103.11", s: "+93.6% off low", tone: "up" },
      { l: "Volume", v: "108.9M", s: "avg 42.1M" },
      { l: "Market Cap", v: "$4.91T", s: "rank #1 semis" },
      { l: "Fwd P/E", v: "48.2×", s: "peer 32.0×" },
    ],
  },
};

const NOTES: Note[] = [
  {
    ag: "Filings",
    role: "10-K / 10-Q / 8-K reader",
    body: (
      <p>
        Nvidia&apos;s new 10-Q reads like a company still pulling away from its competition. Data-center revenue came in at{" "}
        <strong>$30.8B — up 122% year-on-year</strong>, and the filing names a roughly{" "}
        <strong>$8B sovereign-AI backlog</strong> for the first time. Inventory is up 41% QoQ, but management explained it as
        pre-positioning for Blackwell — consistent with what the CFO said on the call.
      </p>
    ),
    chips: ["NVDA 10-Q · pp. 12–18", "filed 04/22", "diff vs. Q2"],
    vote: "up",
    voteLabel: "Bullish",
    conf: 0.92,
    ts: "09:41 ET",
  },
  {
    ag: "Earnings",
    role: "Call transcript & tone",
    body: (
      <p>
        The CFO was direct — none of the usual hedging around the Blackwell ramp. When asked about inventory, she gave a clean
        answer: pre-positioning for Q1 shipments, not a demand softening.{" "}
        <strong>Guidance floor moved up $1.5B above the Street midpoint.</strong> Our evasion score on the Q&amp;A was 0.08 —
        unusually low for a semis call.
      </p>
    ),
    chips: ["Q3 transcript", "04/22 · 5pm ET", "evasion 0.08"],
    vote: "up",
    voteLabel: "Bullish",
    conf: 0.88,
    ts: "09:38 ET",
  },
  {
    ag: "Sentiment",
    role: "News, notes & flow",
    body: (
      <p>
        News flow turned decisively positive in the last 24 hours —{" "}
        <strong>11 of 14 sell-side notes carry an upgrade or reiterate-buy</strong>. Retail chatter is noisier but directionally
        the same. Worth flagging: a small group of funds is trimming into strength, which could show up as selling pressure if
        the tape turns heavy this afternoon.
      </p>
    ),
    chips: ["14 notes · 83% positive", "2.1k retail mentions", "4 upgrades"],
    vote: "up",
    voteLabel: "Bullish",
    conf: 0.81,
    ts: "09:36 ET",
  },
  {
    ag: "Macro",
    role: "Regime & cross-asset",
    body: (
      <p>
        The broader setup is friendly: yields are easing, the dollar is softer, and the rotation into mega-cap tech has legs. The
        one cloud is export-policy risk — if Washington tightens the China rules again,{" "}
        <strong>roughly 8% of Nvidia&apos;s data-center line is exposed</strong>. We&apos;re watching but not trimming on that
        basis alone.
      </p>
    ),
    chips: ["UST10 −4bp", "DXY 101.4", "regime · risk-on"],
    vote: "neutral",
    voteLabel: "Neutral",
    conf: 0.74,
    ts: "09:31 ET",
  },
  {
    ag: "Aggregator",
    role: "Portfolio manager",
    body: (
      <p>
        Four of five agents align long; macro&apos;s caveat is real but already in the price. Recommending{" "}
        <strong>accumulate to 4.0% weight, staged over two sessions</strong> to avoid paying up on a single print. Stop at $178
        (below the 50-day). Twelve-month target: $240. This lifts tech exposure to 47% — three points shy of the soft cap, so new
        longs in the sector will be throttled from here.
      </p>
    ),
    chips: ["size 4.0%", "staged · 2d", "stop $178", "target $240"],
    vote: "up",
    voteLabel: "Accumulate",
    conf: 0.95,
    ts: "09:42 ET",
  },
];

const HOLDINGS: Hold[] = [
  { t: "LLY",  n: "Eli Lilly & Co",  stance: "long",  px: 828.40, ch:  2.02, w: 3.6, conf: 0.91, pnl:  131, ts: "09:39" },
  { t: "AAPL", n: "Apple Inc",       stance: "long",  px: 195.80, ch: -1.21, w: 3.1, conf: 0.62, pnl:  -72, ts: "09:36" },
  { t: "JPM",  n: "JPMorgan Chase",  stance: "long",  px: 221.50, ch:  3.02, w: 2.4, conf: 0.78, pnl:  130, ts: "09:34" },
  { t: "TSLA", n: "Tesla Inc",       stance: "short", px: 348.55, ch: -3.71, w: 2.2, conf: 0.68, pnl:  161, ts: "09:33" },
  { t: "GS",   n: "Goldman Sachs",   stance: "long",  px: 612.80, ch:  2.41, w: 2.0, conf: 0.74, pnl:   86, ts: "09:29" },
  { t: "XOM",  n: "Exxon Mobil",     stance: "short", px: 115.20, ch: -2.70, w: 1.5, conf: 0.71, pnl:   80, ts: "09:26" },
];

function useChartPath(n = 90) {
  return useMemo(() => {
    const W = 600, H = 180, pad = { l: 4, r: 4, t: 10, b: 10 };
    const pts: number[] = [];
    let v = 100;
    for (let i = 0; i < n; i++) {
      v += Math.sin(i / 7) * 1.1 + (Math.sin(i * 0.37) - 0.38) * 1.5 + 0.5;
      pts.push(v);
    }
    const mn = Math.min(...pts), mx = Math.max(...pts), rng = mx - mn || 1;
    const X = (i: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
    const Y = (val: number) => pad.t + (1 - (val - mn) / rng) * (H - pad.t - pad.b);
    const poly = pts.map((p, i) => `${X(i).toFixed(1)},${Y(p).toFixed(1)}`).join(" ");
    const fill = `${X(0)},${H - pad.b} ${poly} ${X(n - 1)},${H - pad.b}`;
    return { W, H, poly, fill };
  }, [n]);
}

export default function WorkbenchView({ ticker }: Props) {
  const tk = (ticker || "NVDA").toUpperCase();
  const d = DEFAULT_DATA[tk] || DEFAULT_DATA.NVDA;
  const chart = useChartPath(90);
  const up = d.chg >= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, margin: "-22px -28px" }}>
      {/* Hero */}
      <section
        style={{
          padding: "26px 32px",
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto auto",
          gap: 24,
          alignItems: "center",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, flexWrap: "wrap", minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1 }}>
            {tk !== "NVDA" ? tk : "NVDA"}
          </div>
          <div className="mute" style={{ fontSize: 13.5 }}>{d.name}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <span className="pill">{d.exch}</span>
            <span className="pill">{d.sector}</span>
            <span className="pill up">● Live</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontSize: 28, fontWeight: 500, lineHeight: 1 }}>{d.px.toFixed(2)}</div>
          <div className={"mono " + (up ? "up" : "down")} style={{ fontSize: 13, marginTop: 7 }}>
            {up ? "+" : ""}{d.chg.toFixed(2)} &nbsp;·&nbsp; {up ? "+" : ""}{d.chgPct.toFixed(2)}%
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn">Notes</button>
          <button className="btn primary">Open position</button>
        </div>
      </section>

      {/* Main grid */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)",
          gap: 0,
        }}
      >
        {/* Left: verdict + reasons */}
        <div style={{ padding: "28px 32px", borderRight: "1px solid var(--line)", minWidth: 0 }}>
          <div className="sec-title">
            Swarm verdict
            <span className="meta">Apr 23 · 04:00 PM ET · aggregator</span>
          </div>

          <div
            style={{
              border: "1px solid var(--line-2)",
              background: "var(--bg-1)",
              borderRadius: 4,
              padding: "20px 22px",
              borderLeft: "3px solid var(--accent)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.15 }}>
                {d.verdict.call} —{" "}
                <span style={{ color: "var(--accent)" }}>{d.verdict.weight}</span>
              </div>
              <div
                className="mono"
                style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--fg-muted)", flexShrink: 0 }}
              >
                confidence <span style={{ color: "var(--fg)", fontWeight: 500 }}>{d.verdict.confidence.toFixed(2)}</span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-dim)", maxWidth: "72ch" }}>
              {d.verdict.summary}
            </p>
            <div
              style={{
                display: "flex",
                gap: 24,
                marginTop: 18,
                paddingTop: 16,
                borderTop: "1px solid var(--line)",
                fontFamily: "var(--mono)",
                fontSize: 12,
                color: "var(--fg-dim)",
                flexWrap: "wrap",
              }}
            >
              {([
                ["entry", d.verdict.entry],
                ["stop", d.verdict.stop],
                ["target", d.verdict.target],
                ["review", d.verdict.review],
              ] as const).map(([k, v]) => (
                <div key={k}>
                  <span
                    style={{
                      color: "var(--fg-ghost)",
                      marginRight: 6,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      fontSize: 10.5,
                    }}
                  >
                    {k}
                  </span>
                  <span style={{ color: "var(--fg)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 32,
              marginTop: 28,
            }}
          >
            <ReasonList title="Reasons to own" items={d.verdict.reasonsGood} tone="good" />
            <ReasonList title="What could break it" items={d.verdict.reasonsBad} tone="bad" />
          </div>
        </div>

        {/* Right: stats + chart */}
        <div style={{ padding: "28px 32px", minWidth: 0 }}>
          <div className="sec-title">
            Market snapshot
            <span className="meta">delayed · 15s</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              border: "1px solid var(--line-2)",
              borderRadius: 3,
              overflow: "hidden",
              background: "var(--bg-1)",
            }}
          >
            {d.stats.map((s, i) => {
              const col = i % 2;
              const row = Math.floor(i / 2);
              const rows = Math.ceil(d.stats.length / 2);
              return (
                <div
                  key={s.l}
                  style={{
                    padding: "14px 16px",
                    borderRight: col === 0 ? "1px solid var(--line)" : "none",
                    borderBottom: row < rows - 1 ? "1px solid var(--line)" : "none",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10.5,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: "var(--fg-muted)",
                      marginBottom: 7,
                    }}
                  >
                    {s.l}
                  </div>
                  <div className="mono" style={{ fontSize: 17, fontWeight: 500 }}>{s.v}</div>
                  {s.s && (
                    <div className={"mono " + (s.tone ?? "")} style={{ fontSize: 11, color: s.tone ? undefined : "var(--fg-muted)", marginTop: 5 }}>
                      {s.s}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 20,
              border: "1px solid var(--line-2)",
              borderRadius: 3,
              background: "var(--bg-1)",
              padding: 14,
            }}
          >
            <svg viewBox={`0 0 ${chart.W} ${chart.H}`} preserveAspectRatio="none" style={{ display: "block", width: "100%", height: "auto" }}>
              <defs>
                <linearGradient id="wbgrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--accent)" stopOpacity="0.20" />
                  <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g>
                {[1, 2, 3].map((i) => (
                  <line
                    key={i}
                    x1={0}
                    x2={chart.W}
                    y1={(chart.H / 4) * i}
                    y2={(chart.H / 4) * i}
                    stroke="var(--line)"
                    strokeDasharray="2 4"
                  />
                ))}
              </g>
              <polyline points={chart.fill} fill="url(#wbgrad)" />
              <polyline points={chart.poly} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
            </svg>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 10,
                fontFamily: "var(--mono)",
                fontSize: 10.5,
                color: "var(--fg-muted)",
                padding: "0 4px",
              }}
            >
              <div>{tk} · 90 sessions · daily close</div>
              <div style={{ display: "flex", gap: 4 }}>
                {["1D", "1W", "1M", "3M", "1Y", "5Y"].map((t) => (
                  <span
                    key={t}
                    style={{
                      padding: "3px 9px",
                      borderRadius: 2,
                      cursor: "pointer",
                      background: t === "3M" ? "var(--bg-3)" : "transparent",
                      color: t === "3M" ? "var(--fg)" : "var(--fg-muted)",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agent notes */}
      <section style={{ padding: "28px 32px", borderTop: "1px solid var(--line)" }}>
        <div className="sec-title">
          Agent notes — what each specialist is seeing
          <span className="meta">last refresh · 09:42 ET</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            border: "1px solid var(--line-2)",
            borderRadius: 4,
            background: "var(--bg-1)",
            overflow: "hidden",
          }}
        >
          {NOTES.map((note, i) => (
            <div
              key={note.ag}
              style={{
                display: "grid",
                gridTemplateColumns: "150px minmax(0,1fr) 130px",
                gap: 24,
                padding: "18px 20px",
                borderBottom: i < NOTES.length - 1 ? "1px solid var(--line)" : "none",
                alignItems: "flex-start",
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>{note.ag}</div>
                <div className="mute" style={{ fontSize: 11.5, marginTop: 3 }}>{note.role}</div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--fg-dim)" }}>
                  {note.body}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  {note.chips.map((c) => (
                    <span key={c} className="chip">{c}</span>
                  ))}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 6,
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--fg-muted)",
                }}
              >
                <span className={"pill " + (note.vote === "up" ? "up" : note.vote === "dn" ? "dn" : "")} style={{ fontSize: 11.5 }}>
                  {note.vote === "up" ? "↑" : note.vote === "dn" ? "↓" : "→"} {note.voteLabel}
                </span>
                <span>conf {note.conf.toFixed(2)}</span>
                <span style={{ color: "var(--fg-ghost)" }}>{note.ts}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Holdings */}
      <section style={{ padding: "28px 32px 36px", borderTop: "1px solid var(--line)" }}>
        <div className="sec-title">
          Elsewhere in the book
          <span className="meta">{HOLDINGS.length} open · 3 flagged</span>
        </div>
        <div
          style={{
            border: "1px solid var(--line-2)",
            borderRadius: 3,
            overflow: "auto",
          }}
        >
          <table className="t" style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Stance</th>
                <th className="num">Price</th>
                <th className="num">Today</th>
                <th className="num">Weight</th>
                <th>Confidence</th>
                <th className="num">P&amp;L</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {HOLDINGS.map((h) => {
                const hUp = h.ch >= 0;
                const cfc = h.conf >= 0.8 ? "up" : h.conf >= 0.7 ? "" : "dn";
                return (
                  <tr key={h.t}>
                    <td>
                      <span className="tkr">{h.t}</span>
                      <span className="mute" style={{ fontSize: 11.5, marginLeft: 10, fontWeight: 400 }}>{h.n}</span>
                    </td>
                    <td>
                      <span className={"pill " + (h.stance === "long" ? "up" : "dn")}>
                        {h.stance[0].toUpperCase() + h.stance.slice(1)}
                      </span>
                    </td>
                    <td className="num">{h.px.toFixed(2)}</td>
                    <td className={"num " + (hUp ? "up" : "down")}>
                      {hUp ? "+" : ""}{h.ch.toFixed(2)}%
                    </td>
                    <td className="num">{h.w.toFixed(1)}%</td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          width: 60,
                          height: 4,
                          background: "var(--bg-3)",
                          position: "relative",
                          verticalAlign: "middle",
                          borderRadius: 1,
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: `${Math.round(h.conf * 100)}%`,
                            background:
                              cfc === "up" ? "var(--accent)" : cfc === "dn" ? "var(--down)" : "var(--fg-muted)",
                            borderRadius: 1,
                          }}
                        />
                      </span>
                      <span className="mono mute" style={{ marginLeft: 8, fontSize: 11 }}>
                        {h.conf.toFixed(2)}
                      </span>
                    </td>
                    <td className={"num " + (h.pnl >= 0 ? "up" : "down")}>
                      {h.pnl >= 0 ? "+" : "−"}${Math.abs(h.pnl)}
                    </td>
                    <td className="mute">{h.ts} ET</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ReasonList({ title, items, tone }: { title: string; items: string[]; tone: "good" | "bad" }) {
  const sym = tone === "good" ? "+" : "−";
  const color = tone === "good" ? "var(--accent)" : "var(--down)";
  return (
    <div>
      <h4
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--fg-muted)",
          margin: "0 0 14px",
        }}
      >
        {title}
      </h4>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((t, i) => (
          <li
            key={i}
            style={{
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--fg-dim)",
              paddingLeft: 20,
              position: "relative",
            }}
          >
            <span
              className="mono"
              style={{ position: "absolute", left: 0, top: -1, color, fontWeight: 500 }}
            >
              {sym}
            </span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
