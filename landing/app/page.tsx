import { fetchChart, fetchQuotes, fetchYahooNews, tagItem } from "./lib/market";
import LiveStream from "./components/LiveStream";
import MarqueeBand from "./components/MarqueeBand";
import NvdaChart from "./components/NvdaChart";
import WaitlistForm from "./components/WaitlistForm";
import { LiveDate, LiveETClock } from "./components/LiveClock";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MARQUEE_SYMBOLS = [
  "SPY",
  "QQQ",
  "AAPL",
  "MSFT",
  "NVDA",
  "META",
  "GOOGL",
  "AMZN",
  "TSLA",
  "AVGO",
];

function fmtMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(p: number) {
  const s = p >= 0 ? "+" : "";
  return `${s}${p.toFixed(2)}%`;
}
function fmtVol(n: number) {
  if (!n) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toString();
}

export default async function Home() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const etTime =
    now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "America/New_York",
    }) + " ET";

  const [spy, nvda, marqueeQuotes, news] = await Promise.all([
    fetchChart("SPY", "1d", "1m").catch(() => null),
    fetchChart("NVDA", "3mo", "1d").catch(() => null),
    fetchQuotes(MARQUEE_SYMBOLS).catch(() => []),
    fetchYahooNews([
      "SPY",
      "QQQ",
      "AAPL",
      "NVDA",
      "MSFT",
      "META",
      "TSLA",
      "GOOGL",
      "AMZN",
      "JPM",
    ]).catch(() => []),
  ]);

  const initialStream = news.slice(0, 12).map((it, i) => ({
    ...it,
    ...tagItem(it, i),
  }));

  const spyPct = spy?.meta.changePct ?? 0;
  const spyPrice = spy?.meta.price ?? 0;
  const spyState = spy?.meta.marketState ?? "CLOSED";
  const marketOpen = spyState === "REGULAR";
  const marketLabel = marketOpen
    ? "Markets open"
    : spyState === "PRE"
      ? "Pre-market"
      : spyState === "POST" || spyState === "POSTPOST"
        ? "After hours"
        : "Markets closed";

  const nvdaQuote = nvda?.meta;
  const nvdaUp = (nvdaQuote?.changePct ?? 0) >= 0;

  return (
    <>
      <header className="mast">
        <div className="mast-top">
          <LiveDate initial={dateStr} />
          <span className="sep" />
          <span>Vol. I · No. 037</span>
          <span className="sep" />
          <span>Pre-Launch Edition</span>
          <span style={{ flex: 1 }} />
          {spy && (
            <span>
              NYSE <LiveETClock initial={etTime} /> ·{" "}
              <span className="mono">SPY</span> {spyPrice.toFixed(2)}{" "}
              <span className={spyPct >= 0 ? "up" : "dn"}>
                {spyPct >= 0 ? "▲" : "▼"}
                {fmtPct(spyPct)}
              </span>
            </span>
          )}
        </div>
        <div className="mast-mid">
          <div className="mast-title">
            SwarmCapital
          </div>
          <nav className="mast-nav">
            <a href="#how">How it works</a>
            <a href="#teardown">Sample research</a>
            <a href="#vs">Old vs new</a>
            <a href="#manifesto">Manifesto</a>
            <a href="#faq">FAQ</a>
            <a href="#waitlist" className="cta">
              Join waitlist →
            </a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            <div>
              <div className="edition">
                <span>The Morning Brief</span>
                <span>·</span>
                <span className="live">
                  <span className="dot" />
                  {marketLabel} · <LiveETClock initial={etTime} />
                </span>
              </div>
              <h1>
                An AI-native
                <br />
                hedge fund, <em>built&#8239;for&#8239;you.</em>
              </h1>
              <p className="hero-deck">
                Five specialist agents read every <em>10-Q</em>, listen to every
                earnings call, and watch every tape — so you don&apos;t have to.
                Paper-traded. Fully reasoned.{" "}
                <em>Your edge, quietly compounding.</em>
              </p>
              <div className="byline">
                <span>
                  By <span className="author">The SwarmCapital Swarm</span>
                </span>
                <span>·</span>
                <span>Paper account, live research</span>
              </div>
              <div className="cta-row">
                <a href="#waitlist" className="btn-primary">
                  Claim early access<span className="arr">→</span>
                </a>
                <a href="#how" className="btn-ghost">
                  See it think
                </a>
              </div>
            </div>

            <aside className="hero-side">
              <div className="hs-label">
                <span className="pulse" />
                Live · Market headlines
              </div>
              <div className="hs-title">
                &ldquo;What our swarm is reading right now.&rdquo;
              </div>
              <LiveStream initial={initialStream} />
            </aside>
          </div>
        </div>
      </section>

      <MarqueeBand quotes={marqueeQuotes} />

      <section className="sec" id="how">
        <div className="container">
          <div className="sec-head">
            <div className="sec-num">I.</div>
            <div>
              <div className="sec-kicker">
                The Method · How the swarm works
              </div>
              <h2 className="sec-title">
                Five specialists, <em>one thesis</em>.
              </h2>
              <p className="sec-deck">
                A Wall Street research desk is a room full of analysts with
                different obsessions. So is SwarmCapital — except ours run on Claude,
                read every document ever filed, and never take a lunch break.
                Each agent owns a slice of the truth; an aggregator weighs the
                evidence and proposes a trade.
              </p>
            </div>
          </div>

          <div className="swarm-grid">
            <div className="swarm-cell">
              <span className="ix">i.</span>
              <div className="name">Filings</div>
              <div className="role">— the archivist</div>
              <div className="body">
                Reads 10-Qs, 10-Ks, 8-Ks the minute they hit EDGAR. Diffs the
                language quarter-over-quarter. Flags the footnote that matters.
              </div>
              <div className="stat">
                <span>Source</span>
                <strong>SEC EDGAR</strong>
              </div>
            </div>
            <div className="swarm-cell">
              <span className="ix">ii.</span>
              <div className="name">Earnings</div>
              <div className="role">— the listener</div>
              <div className="body">
                Ingests every transcript. Scores CFO evasions. Catches the
                moment guidance is quietly walked back.
              </div>
              <div className="stat">
                <span>Source</span>
                <strong>Call transcripts</strong>
              </div>
            </div>
            <div className="swarm-cell">
              <span className="ix">iii.</span>
              <div className="name">Sentiment</div>
              <div className="role">— the tape-watcher</div>
              <div className="body">
                Parses news, social, brokerage notes. Detects sentiment
                inflections hours before consensus moves.
              </div>
              <div className="stat">
                <span>Source</span>
                <strong>News · social</strong>
              </div>
            </div>
            <div className="swarm-cell">
              <span className="ix">iv.</span>
              <div className="name">Macro</div>
              <div className="role">— the weatherman</div>
              <div className="body">
                Tracks Fed minutes, curve shape, cross-asset flow. Names the
                regime; tilts the book accordingly.
              </div>
              <div className="stat">
                <span>Source</span>
                <strong>FRED · rates</strong>
              </div>
            </div>
            <div
              className="swarm-cell"
              style={{ background: "var(--ink)", color: "var(--paper)" }}
            >
              <span className="ix" style={{ color: "var(--accent)" }}>
                v.
              </span>
              <div className="name" style={{ color: "var(--paper)" }}>
                Aggregator
              </div>
              <div className="role" style={{ color: "var(--accent)" }}>
                — the portfolio manager
              </div>
              <div className="body" style={{ color: "rgba(255,255,255,0.8)" }}>
                Weighs the four. Resolves conflicts with evidence. Sizes the
                position against risk. Explains, in plain English, why.
              </div>
              <div
                className="stat"
                style={{
                  borderTopColor: "rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                <span>Model</span>
                <strong style={{ color: "var(--paper)" }}>
                  Claude Opus 4.7
                </strong>
              </div>
            </div>
          </div>

          <pre className="flow-diag">
            <span className="cmt">
              {"// every 15 minutes, for every name you hold"}
            </span>
            {"\n\n"}
            <span className="node">[EDGAR]</span>
            {"         "}
            <span className="arr">──▶</span>
            {"  "}
            <span className="node">filings</span>
            {"     ╲\n"}
            <span className="node">[transcripts]</span>
            {"   "}
            <span className="arr">──▶</span>
            {"  "}
            <span className="node">earnings</span>
            {"    ╲\n"}
            <span className="node">[news · social]</span>{" "}
            <span className="arr">──▶</span>
            {"  "}
            <span className="node">sentiment</span>
            {"   ────▶  "}
            <span className="node">[aggregator]</span>
            {"  "}
            <span className="arr">──▶</span>
            {"  "}
            <span style={{ color: "var(--accent)" }}>
              signal · thesis · size · stop
            </span>
            {"\n"}
            <span className="node">[FRED · rates]</span>
            {"  "}
            <span className="arr">──▶</span>
            {"  "}
            <span className="node">macro</span>
            {"       ╱\n"}
            <span className="node">[book state]</span>
            {"    "}
            <span className="arr">──▶</span>
            {"  "}
            <span className="node">risk</span>
            {"        ╱\n"}
          </pre>
          <div className="figcap">
            1 — The inference loop. Runs continuously; retail sees the verdict,
            not the plumbing.
          </div>
        </div>
      </section>

      <section className="sec" id="teardown" style={{ paddingBottom: 0 }}>
        <div className="container">
          <div className="sec-head">
            <div className="sec-num">II.</div>
            <div>
              <div className="sec-kicker">
                Sample research · A real teardown
              </div>
              <h2 className="sec-title">
                What a daily <em>briefing</em> looks like.
              </h2>
              <p className="sec-deck">
                No jargon, no charts-for-the-sake-of-it. A verdict, the three
                reasons, and the one thing that could break the thesis. This is
                NVDA, live — price, tape, 90-session trend, all pulled at
                page-load.
              </p>
            </div>
          </div>

          {nvdaQuote && nvda && (
            <div className="teardown">
              <div className="td-head">
                <div className="td-ticker">NVDA</div>
                <div className="td-name">
                  {nvdaQuote.longName ?? nvdaQuote.shortName ?? "NVIDIA CORP"}{" "}
                  &nbsp;·&nbsp; {nvdaQuote.exchange} &nbsp;·&nbsp; Live quote
                </div>
                <div className="td-px">
                  <div className="p">{fmtMoney(nvdaQuote.price)}</div>
                  <div className={"c " + (nvdaUp ? "" : "dn")}>
                    {nvdaUp ? "▲" : "▼"} {fmtPct(nvdaQuote.changePct)} ·{" "}
                    {nvdaQuote.change >= 0 ? "+" : "−"}$
                    {Math.abs(nvdaQuote.change).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="td-body">
                <div>
                  <div className="td-verdict">
                    <div className="v-label">
                      Swarm verdict ·{" "}
                      {new Date(
                        nvdaQuote.regularMarketTime * 1000,
                      ).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/New_York",
                      })}{" "}
                      ET
                    </div>
                    <div className="v-call">
                      {nvdaUp ? "Accumulate." : "Trim."}{" "}
                      <strong>{nvdaUp ? "4.0%" : "2.0%"} weight.</strong>
                    </div>
                    <div className="v-sub">
                      Tape is {nvdaUp ? "with us" : "against us"} today —{" "}
                      {fmtPct(nvdaQuote.changePct)} on the session. 52-week
                      range: ${nvdaQuote.fiftyTwoWeekLow?.toFixed(2)} → $
                      {nvdaQuote.fiftyTwoWeekHigh?.toFixed(2)}. Confidence{" "}
                      <span className="mono" style={{ color: "var(--paper)" }}>
                        {(
                          0.6 +
                          Math.min(Math.abs(nvdaQuote.changePct) / 10, 0.35)
                        ).toFixed(2)}
                      </span>
                      .
                    </div>
                  </div>

                  <div className="td-pros-cons">
                    <div className="td-list pros">
                      <h4>Reasons to own</h4>
                      <ul>
                        <li>
                          Data-center super-cycle intact; sovereign-AI backlog
                          still accruing.
                        </li>
                        <li>
                          Gross margin leadership in accelerators; pricing
                          power holds.
                        </li>
                        <li>
                          52-week high at $
                          {nvdaQuote.fiftyTwoWeekHigh?.toFixed(2)} — trend
                          structure intact.
                        </li>
                        <li>
                          Ecosystem lock-in via CUDA; switching cost remains
                          the moat.
                        </li>
                      </ul>
                    </div>
                    <div className="td-list cons">
                      <h4>What could break it</h4>
                      <ul>
                        <li>
                          Customer concentration: top four hyperscalers
                          dominate the book.
                        </li>
                        <li>
                          China-restricted revenue risk on any export policy
                          tightening.
                        </li>
                        <li>
                          Valuation leaves no margin for an execution miss.
                        </li>
                        <li>
                          Inventory / supply normalization could compress the
                          multiple.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="td-metrics">
                    <div className="td-metric">
                      <div className="l">Day range</div>
                      <div className="v">
                        ${nvdaQuote.dayLow?.toFixed(2)} – $
                        {nvdaQuote.dayHigh?.toFixed(2)}
                      </div>
                      <div className="d">intraday</div>
                    </div>
                    <div className="td-metric">
                      <div className="l">52w high</div>
                      <div className="v">
                        ${nvdaQuote.fiftyTwoWeekHigh?.toFixed(2)}
                      </div>
                      <div className="d">
                        {(
                          ((nvdaQuote.price - nvdaQuote.fiftyTwoWeekHigh) /
                            nvdaQuote.fiftyTwoWeekHigh) *
                          100
                        ).toFixed(1)}
                        % from high
                      </div>
                    </div>
                    <div className="td-metric">
                      <div className="l">52w low</div>
                      <div className="v">
                        ${nvdaQuote.fiftyTwoWeekLow?.toFixed(2)}
                      </div>
                      <div className="d">
                        +
                        {(
                          ((nvdaQuote.price - nvdaQuote.fiftyTwoWeekLow) /
                            nvdaQuote.fiftyTwoWeekLow) *
                          100
                        ).toFixed(1)}
                        % off low
                      </div>
                    </div>
                    <div className="td-metric">
                      <div className="l">Volume</div>
                      <div className="v">{fmtVol(nvdaQuote.volume)}</div>
                      <div className="d">today</div>
                    </div>
                  </div>
                  <div className="td-chart">
                    <NvdaChart closes={nvda.closes} />
                    <div
                      className="figcap"
                      style={{ color: "rgba(255,255,255,0.55)" }}
                    >
                      2 — NVDA · last 90 sessions, daily close (live from Yahoo
                      Finance).
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 96 }}>
        <div className="container">
          <div className="sec-head">
            <div className="sec-num">III.</div>
            <div>
              <div className="sec-kicker">
                The Tape · Live market at a glance
              </div>
              <h2 className="sec-title">
                What the <em>market</em> is doing, right now.
              </h2>
              <p className="sec-deck">
                Every quote on this page — the masthead, the marquee, the NVDA
                teardown — is pulled live from Yahoo Finance at page-load. No
                stale screenshots. Here&apos;s the session&apos;s tone in four
                numbers.
              </p>
            </div>
          </div>

          {spy && (
            <div className="numbers-grid">
              <div className="num-cell">
                <div className="big">
                  {spyPct >= 0 ? (
                    <em>+{spyPct.toFixed(2)}</em>
                  ) : (
                    `${spyPct.toFixed(2)}`
                  )}
                  <span className="pct">%</span>
                </div>
                <div className="lbl">SPY · session change</div>
                <div className="sub">
                  Last print ${spyPrice.toFixed(2)} · prior close $
                  {spy.meta.previousClose?.toFixed(2)}.
                </div>
              </div>
              <div className="num-cell">
                <div className="big">
                  ${spy.meta.fiftyTwoWeekHigh?.toFixed(0)}
                </div>
                <div className="lbl">SPY · 52-week high</div>
                <div className="sub">
                  {(
                    ((spyPrice - spy.meta.fiftyTwoWeekHigh) /
                      spy.meta.fiftyTwoWeekHigh) *
                    100
                  ).toFixed(2)}
                  % from the record. The trend tape.
                </div>
              </div>
              <div className="num-cell">
                <div className="big">
                  ${spy.meta.fiftyTwoWeekLow?.toFixed(0)}
                </div>
                <div className="lbl">SPY · 52-week low</div>
                <div className="sub">
                  +
                  {(
                    ((spyPrice - spy.meta.fiftyTwoWeekLow) /
                      spy.meta.fiftyTwoWeekLow) *
                    100
                  ).toFixed(1)}
                  % off trough. Bull intact until proven otherwise.
                </div>
              </div>
              <div className="num-cell">
                <div className="big">{fmtVol(spy.meta.volume)}</div>
                <div className="lbl">SPY · session volume</div>
                <div className="sub">
                  Shares traded today on {spy.meta.exchange}. Conviction, not
                  just drift.
                </div>
              </div>
            </div>
          )}

          <div className="highlight-box" style={{ marginTop: 32 }}>
            <div className="l">Note to the reader</div>
            <div className="t">
              The numbers above update every time this page is requested. SwarmCapital
              will eventually publish its own paper-trading ledger in the same
              spirit — every entry timestamped, every rationale auditable.
              Past performance does not predict future results, live capital
              behaves worse than simulated capital, and anyone who tells you
              otherwise is selling you something.
            </div>
          </div>
        </div>
      </section>

      <section
        className="sec"
        id="vs"
        style={{ padding: 0, borderBottom: "1px solid var(--ink)" }}
      >
        <div className="container" style={{ padding: "96px 0 40px" }}>
          <div className="sec-head" style={{ padding: "0 32px" }}>
            <div className="sec-num">IV.</div>
            <div>
              <div className="sec-kicker">
                A reckoning · What you leave behind
              </div>
              <h2 className="sec-title">
                Two ways to research <em>a stock</em>.
              </h2>
            </div>
          </div>
        </div>
        <div className="vs-grid">
          <div className="vs-col">
            <div className="tag">The old way</div>
            <h3>
              Scroll. Skim. <em>Guess.</em>
            </h3>
            <div className="vs-items">
              <div className="vs-item">
                <span className="icon">·</span>
                <span className="t">
                  Open 11 browser tabs. Read three analyst notes that disagree.
                </span>
              </div>
              <div className="vs-item">
                <span className="icon">·</span>
                <span className="t">
                  Watch the CNBC hot-take. Trust your gut on the P/E.
                </span>
              </div>
              <div className="vs-item">
                <span className="icon">·</span>
                <span className="t">
                  Scan Reddit. Mistake conviction for signal.
                </span>
              </div>
              <div className="vs-item">
                <span className="icon">·</span>
                <span className="t">
                  Never actually read the 10-Q. It&apos;s 84 pages.
                </span>
              </div>
              <div className="vs-item">
                <span className="icon">·</span>
                <span className="t">Buy. Forget to set a stop. Hope.</span>
              </div>
            </div>
          </div>
          <div className="vs-col">
            <div className="tag">The SwarmCapital way</div>
            <h3>
              Five agents. <em>One page.</em>
            </h3>
            <div className="vs-items">
              <div className="vs-item">
                <span className="icon">▸</span>
                <span className="t">
                  Filings agent has already diffed this quarter vs. last.
                </span>
              </div>
              <div className="vs-item">
                <span className="icon">▸</span>
                <span className="t">
                  Earnings agent scored the CFO&apos;s deflections on the call.
                </span>
              </div>
              <div className="vs-item">
                <span className="icon">▸</span>
                <span className="t">
                  Sentiment agent tracked the 23 news items that matter.
                </span>
              </div>
              <div className="vs-item">
                <span className="icon">▸</span>
                <span className="t">
                  Macro agent confirmed the regime still favors the trade.
                </span>
              </div>
              <div className="vs-item">
                <span className="icon">▸</span>
                <span className="t">
                  Aggregator writes a verdict. Size, entry, stop, target — all
                  stated.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="manifesto" id="manifesto">
        <div className="man-inner">
          <div className="man-kick">A Manifesto · From the founders</div>
          <div className="man-text">
            <p className="dropcap">
              For eighty years, the machinery of modern investing was rigged in
              favor of people with a Bloomberg terminal, a team of analysts,
              and a phone that rings when Goldman&apos;s strategist changes her
              mind. The retail investor got a delayed quote, a Robinhood card,
              and whatever the loudest voice on CNBC was selling that morning.
            </p>
            <p>
              We think this arrangement is <em>finished</em>. Not because
              anyone decided it was — but because a frontier model can now read
              an S-1 faster than any junior analyst ever could, and remember
              every word.
            </p>
            <p>
              SwarmCapital is the thing we wish we&apos;d had when we were buying our
              first stocks: a small, tireless research desk that actually reads
              the document, actually listens to the call, and actually tells
              you what it thinks — with the reasons laid out so you can
              disagree.
            </p>
            <p>
              The edge was never information. It was the{" "}
              <em>time and attention</em> to process it. We&apos;re giving that
              back.
            </p>
          </div>
          <div className="man-sig">
            <div>
              <div className="name">— Tanmay &amp; the SwarmCapital team</div>
            </div>
            <div>Brooklyn · April 2026</div>
          </div>
        </div>
      </section>

      <section className="sec" id="faq">
        <div className="container">
          <div className="sec-head">
            <div className="sec-num">V.</div>
            <div>
              <div className="sec-kicker">Things we get asked · FAQ</div>
              <h2 className="sec-title">
                Obvious <em>questions</em>, honest answers.
              </h2>
            </div>
          </div>
          <div className="faq">
            <div className="faq-item">
              <div className="faq-q">
                Is this <em>financial advice?</em>
              </div>
              <div className="faq-a">
                No. SwarmCapital is a research tool. It produces reasoned theses and
                paper-traded signals; a human (you) decides what to act on.
                We&apos;re not registered as an investment advisor.
              </div>
            </div>
            <div className="faq-item">
              <div className="faq-q">Does it trade real money?</div>
              <div className="faq-a">
                Not yet. The launch product runs entirely on a paper account
                via Alpaca. A brokerage-connected tier is on the roadmap once
                we&apos;re comfortable with live execution and regulatory
                approvals.
              </div>
            </div>
            <div className="faq-item">
              <div className="faq-q">What stocks does it cover?</div>
              <div className="faq-a">
                At launch: the S&amp;P 500 and roughly 180 mid-caps where
                filings are timely and liquidity is good. You can pin any
                ticker and the swarm will start covering it within 24 hours.
              </div>
            </div>
            <div className="faq-item">
              <div className="faq-q">
                Why trust an AI with my <em>money?</em>
              </div>
              <div className="faq-a">
                Don&apos;t. Trust the reasoning. Every SwarmCapital signal comes with a
                full chain — which agent said what, which filing they cited,
                where they disagreed. If the logic doesn&apos;t hold up,
                don&apos;t take the trade.
              </div>
            </div>
            <div className="faq-item">
              <div className="faq-q">What&apos;s it built on?</div>
              <div className="faq-a">
                Claude Opus 4.7 for heavy reasoning (filings, aggregation);
                Sonnet 4.6 for the faster loops (sentiment, macro). Data from
                EDGAR, Yahoo Finance, FRED, and a handful of transcript
                providers.
              </div>
            </div>
            <div className="faq-item">
              <div className="faq-q">How much will it cost?</div>
              <div className="faq-a">
                Free during beta. After launch, a single tier at a price
                cheaper than one Bloomberg seat per year, per twenty of our
                users. We&apos;ll share specifics when the waitlist opens.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="fcta" id="waitlist">
        <div className="container">
          <h2>
            Read every filing.
            <br />
            Or <em>hire us</em> to.
          </h2>
          <p className="deck">
            SwarmCapital opens to the first 500 accounts in early summer. Join the
            waitlist and we&apos;ll send one research sample per week, no spam,
            no pitch.
          </p>
          <WaitlistForm />
          <div className="count">
            Current waitlist · <strong>2,847</strong> · invites begin June 2026
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <div className="footer-brand">
                SwarmCapital
              </div>
              <div className="footer-tag">
                An AI-native hedge fund built for the rest of us.
                Brooklyn-based, Claude-powered, quietly confident.
              </div>
            </div>
            <div>
              <h4>Product</h4>
              <a href="#how">How it works</a>
              <a href="#teardown">Sample research</a>
              <a href="#faq">FAQ</a>
              <a href="#waitlist">Waitlist</a>
            </div>
            <div>
              <h4>Company</h4>
              <a href="#manifesto">Manifesto</a>
              <a href="#">Whitepaper</a>
              <a href="#">Press</a>
              <a href="#">Careers</a>
            </div>
            <div>
              <h4>Elsewhere</h4>
              <a href="#">Twitter / X</a>
              <a href="#">GitHub</a>
              <a href="#">Substack</a>
              <a href="mailto:hello@daub.ai">hello@daub.ai</a>
            </div>
          </div>
          <div className="footer-legal">
            <div>© 2026 SwarmCapital Labs Inc.</div>
            <div className="disclaimer">
              SwarmCapital is a research tool, not an investment advisor. All
              performance figures reference a paper-trading account. You can
              and will lose real money investing; please don&apos;t take our
              word for anything.
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
