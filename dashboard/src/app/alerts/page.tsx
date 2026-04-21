"use client";

const ALERTS = [
  { ts: "14:32", sev: "HI",  tk: "NVDA", msg: "Filing agent confidence spiked to 0.92 on 10-Q print",         act: "Review" },
  { ts: "14:28", sev: "MED", tk: "META", msg: "Agent disagreement: sentiment vs earnings on composite",        act: "Resolve" },
  { ts: "14:14", sev: "HI",  tk: "LLY",  msg: "8-K: Zepbound label expansion — thesis reinforced",            act: "View" },
  { ts: "13:54", sev: "LOW", tk: "JPM",  msg: "Headline flagged: Dimon on CRE. No action recommended",        act: "Dismiss" },
  { ts: "12:18", sev: "MED", tk: "TSLA", msg: "Short thesis strengthened: 3 sell-side delivery cuts",         act: "View" },
  { ts: "11:02", sev: "HI",  tk: "—",   msg: "Tech exposure 47% — approaching 50% cap; new longs throttled",  act: "Acknowledge" },
  { ts: "09:44", sev: "LOW", tk: "XOM",  msg: "Stop-loss proximity 1.8%; position healthy",                   act: "Dismiss" },
];

const WATCHLIST = [
  { t: "NVDA",  sect: "tech", px: 892.30, chgp: +2.11 },
  { t: "AAPL",  sect: "tech", px: 195.80, chgp: -1.21 },
  { t: "MSFT",  sect: "tech", px: 438.12, chgp: +0.84 },
  { t: "META",  sect: "tech", px: 624.30, chgp: -0.89 },
  { t: "JPM",   sect: "fin",  px: 221.50, chgp: +1.12 },
  { t: "GS",    sect: "fin",  px: 612.80, chgp: +1.34 },
  { t: "LLY",   sect: "hlth", px: 828.40, chgp: +1.54 },
  { t: "XOM",   sect: "ener", px: 115.20, chgp: -1.10 },
  { t: "TSLA",  sect: "tech", px: 348.55, chgp: -3.41 },
  { t: "AVGO",  sect: "tech", px: 1846.20,chgp: +2.30 },
];

const SECT_COLOR: Record<string, string> = {
  tech: "var(--s-tech)", fin: "var(--s-fin)", hlth: "var(--s-hlth)",
  indu: "var(--s-indu)", cons: "var(--s-cons)", ener: "var(--s-ener)", def: "var(--s-def)",
};

export default function AlertsPage() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14 }}>
      {/* Inbox */}
      <div className="card">
        <div className="card-head">
          <h3>Inbox</h3>
          <span className="sub">7 active · 3 today</span>
        </div>
        <table className="t">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Time</th>
              <th>Ticker</th>
              <th>Message</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ALERTS.map((a, i) => (
              <tr key={i}>
                <td>
                  <span
                    className={"pill " + (a.sev === "HI" ? "dn" : a.sev === "MED" ? "gold" : "")}
                    style={{ minWidth: 46, justifyContent: "center" }}
                  >
                    {a.sev === "HI" ? "High" : a.sev === "MED" ? "Medium" : "Low"}
                  </span>
                </td>
                <td className="mute">{a.ts}</td>
                <td><span className="tkr">{a.tk}</span></td>
                <td style={{ whiteSpace: "normal" }}>{a.msg}</td>
                <td><button className="btn">{a.act}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Watchlist */}
      <div className="card">
        <div className="card-head">
          <h3>Watchlist</h3>
          <span className="sub">{WATCHLIST.length} tickers</span>
        </div>
        <div style={{ maxHeight: 560, overflow: "auto" }}>
          <table className="t">
            <thead>
              <tr>
                <th></th>
                <th>Ticker</th>
                <th className="num">Last</th>
                <th className="num">Chg%</th>
              </tr>
            </thead>
            <tbody>
              {WATCHLIST.map((t) => (
                <tr key={t.t}>
                  <td>
                    <span style={{
                      display: "inline-block", width: 3, height: 18, borderRadius: 2,
                      background: SECT_COLOR[t.sect] || "var(--fg-muted)",
                    }} />
                  </td>
                  <td><span className="tkr">{t.t}</span></td>
                  <td className="num">{t.px.toFixed(2)}</td>
                  <td className={"num " + (t.chgp >= 0 ? "up" : "down")}>
                    {t.chgp >= 0 ? "+" : ""}{t.chgp.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
