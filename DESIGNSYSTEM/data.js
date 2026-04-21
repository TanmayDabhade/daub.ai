window.DAUB_DATA = (function(){
  const tickers = [
    { t:"NVDA",  n:"NVIDIA CORP",     sect:"tech", px:892.30, chg:+18.44, chgp:+2.11 },
    { t:"AAPL",  n:"APPLE INC",       sect:"tech", px:195.80, chg:-2.40,  chgp:-1.21 },
    { t:"MSFT",  n:"MICROSOFT CORP",  sect:"tech", px:438.12, chg:+3.66,  chgp:+0.84 },
    { t:"GOOGL", n:"ALPHABET INC-A",  sect:"tech", px:182.45, chg:+1.12,  chgp:+0.62 },
    { t:"META",  n:"META PLATFORMS",  sect:"tech", px:624.30, chg:-5.60,  chgp:-0.89 },
    { t:"AMZN",  n:"AMAZON.COM INC",  sect:"tech", px:231.08, chg:+2.90,  chgp:+1.27 },
    { t:"TSLA",  n:"TESLA INC",       sect:"tech", px:348.55, chg:-12.30, chgp:-3.41 },
    { t:"JPM",   n:"JPMORGAN CHASE",  sect:"fin",  px:221.50, chg:+2.45,  chgp:+1.12 },
    { t:"GS",    n:"GOLDMAN SACHS",   sect:"fin",  px:612.80, chg:+8.10,  chgp:+1.34 },
    { t:"BAC",   n:"BANK OF AMERICA", sect:"fin",  px:47.22,  chg:-0.18,  chgp:-0.38 },
    { t:"V",     n:"VISA INC-A",      sect:"fin",  px:308.95, chg:+1.20,  chgp:+0.39 },
    { t:"UNH",   n:"UNITEDHEALTH GRP",sect:"hlth", px:571.25, chg:+4.05,  chgp:+0.71 },
    { t:"JNJ",   n:"JOHNSON & JOHNSON",sect:"hlth",px:162.18, chg:-0.42,  chgp:-0.26 },
    { t:"LLY",   n:"ELI LILLY & CO",  sect:"hlth", px:828.40, chg:+12.60, chgp:+1.54 },
    { t:"CAT",   n:"CATERPILLAR INC", sect:"indu", px:389.75, chg:+2.10,  chgp:+0.54 },
    { t:"XOM",   n:"EXXON MOBIL CORP",sect:"ener", px:115.20, chg:-1.28,  chgp:-1.10 },
    { t:"CVX",   n:"CHEVRON CORP",    sect:"ener", px:158.60, chg:-2.10,  chgp:-1.31 },
    { t:"LMT",   n:"LOCKHEED MARTIN", sect:"def",  px:495.80, chg:+3.20,  chgp:+0.65 },
    { t:"WMT",   n:"WALMART INC",     sect:"cons", px:88.42,  chg:+0.46,  chgp:+0.52 },
    { t:"COST",  n:"COSTCO WHOLESALE",sect:"cons", px:921.30, chg:-4.20,  chgp:-0.45 },
  ];
  const positions = [
    { t:"NVDA", qty:15, side:"LONG",  avg:875.50, px:892.30, mv:13384.50, upnl:+252, upnlp:+1.92, thesis:"Datacenter capex surge; 10-Q shows 122% YoY revenue growth.", conf:0.87, held:"12d" },
    { t:"AAPL", qty:30, side:"LONG",  avg:198.20, px:195.80, mv:5874.00,  upnl:-72,  upnlp:-1.21, thesis:"Services margin expansion offset by iPhone weakness in China.", conf:0.62, held:"31d" },
    { t:"JPM",  qty:20, side:"LONG",  avg:215.00, px:221.50, mv:4430.00,  upnl:+130, upnlp:+3.02, thesis:"NII up, credit provisions normalizing post-cycle.", conf:0.78, held:"22d" },
    { t:"XOM",  qty:25, side:"SHORT", avg:118.40, px:115.20, mv:2880.00,  upnl:+80,  upnlp:+2.70, thesis:"Crude demand softening, OPEC+ spare capacity overhang.", conf:0.71, held:"8d" },
    { t:"LLY",  qty:8,  side:"LONG",  avg:812.00, px:828.40, mv:6627.20,  upnl:+131, upnlp:+2.02, thesis:"GLP-1 franchise; Zepbound label expansion; Q3 raise.", conf:0.91, held:"45d" },
    { t:"TSLA", qty:12, side:"SHORT", avg:362.00, px:348.55, mv:4182.60,  upnl:+161, upnlp:+3.71, thesis:"Delivery miss risk; robotaxi priced in; margin compression.", conf:0.68, held:"5d" },
    { t:"GS",   qty:6,  side:"LONG",  avg:598.40, px:612.80, mv:3676.80,  upnl:+86,  upnlp:+2.41, thesis:"IB fee recovery, prime brokerage strength, buyback pace.", conf:0.74, held:"18d" },
  ];
  const signals = [
    { t:"AVGO", dir:"LONG",  score:+0.82, conf:0.88, action:"OPEN", sect:"tech", pct:0.040, why:"Networking silicon leadership; hyperscaler capex visibility through 2027.", conflicts:0, age:"4m",  agents:["FILING","SENT","MACRO"] },
    { t:"PLTR", dir:"LONG",  score:+0.71, conf:0.79, action:"ADD",  sect:"tech", pct:0.025, why:"Commercial AIP bookings accelerating; gov-sector moat compounding.", conflicts:1, age:"11m", agents:["FILING","SENT"] },
    { t:"META", dir:"SHORT", score:-0.64, conf:0.74, action:"OPEN", sect:"tech", pct:0.030, why:"Reality Labs burn; ad pricing softness Q3; regulatory tail risk.", conflicts:2, age:"1h",  agents:["SENT","EARN"] },
    { t:"CAT",  dir:"LONG",  score:+0.58, conf:0.71, action:"OPEN", sect:"indu", pct:0.020, why:"Mining fleet refresh cycle; backlog +14% QoQ; pricing discipline.", conflicts:0, age:"23m", agents:["FILING","MACRO"] },
    { t:"PFE",  dir:"SHORT", score:-0.51, conf:0.69, action:"OPEN", sect:"hlth", pct:0.015, why:"Patent cliff 2026-28; oncology pipeline derisking slower than guided.", conflicts:1, age:"2h",  agents:["FILING","SENT"] },
    { t:"COST", dir:"LONG",  score:+0.44, conf:0.72, action:"HOLD", sect:"cons", pct:0.018, why:"Membership renewal 93%; traffic +5.2% comps; pricing power intact.", conflicts:0, age:"3h",  agents:["EARN","SENT"] },
    { t:"CVX",  dir:"SHORT", score:-0.38, conf:0.66, action:"ADD",  sect:"ener", pct:0.012, why:"Refining margin compression; Hess deal synergies back-loaded.", conflicts:0, age:"5h",  agents:["FILING","MACRO"] },
  ];
  const agentStream = [
    { ts:"14:32:08", ag:"FILING", tk:"NVDA", sig:"+", msg:"10-Q filed — data center $30.8B (+122% YoY), GM 75.5%, inventory +41% QoQ signals supply confidence", conf:0.92 },
    { ts:"14:31:44", ag:"SENT",   tk:"META", sig:"-", msg:"11 news items — Reality Labs Q3 loss widened to $4.5B, FTC probe expands into Threads data use", conf:0.78 },
    { ts:"14:31:12", ag:"MACRO",  tk:"*",    sig:"~", msg:"Regime TRANSITIONING. Fed minutes dovish on 2026 path; 2s/10s un-inverts; risk-on tilt forming", conf:0.71 },
    { ts:"14:30:55", ag:"FILING", tk:"PLTR", sig:"+", msg:"10-Q diff — commercial rev +54% YoY; AIP customer count 143 (+31 QoQ); NDR 118%", conf:0.85 },
    { ts:"14:30:22", ag:"SENT",   tk:"TSLA", sig:"-", msg:"9 items — delivery estimates cut by 3 sell-side shops; robotaxi launch pushed to 2H26", conf:0.74 },
    { ts:"14:29:58", ag:"AGGR",   tk:"AVGO", sig:"+", msg:"Composite +0.82 conf 0.88 — FILING/SENT/MACRO aligned LONG; size 4.0% cleared risk checks", conf:0.88 },
    { ts:"14:29:31", ag:"FILING", tk:"LLY",  sig:"+", msg:"8-K — Zepbound label expanded for sleep apnea comorbid obesity; TAM +$8-12B peak", conf:0.89 },
    { ts:"14:29:04", ag:"RISK",   tk:"*",    sig:"~", msg:"Tech exposure 47% — approaching 50% soft cap; new long adds gated to ≤1.5% notional", conf:1.00 },
    { ts:"14:28:40", ag:"SENT",   tk:"XOM",  sig:"-", msg:"OPEC+ Q1 quota chatter softening; 14 items bearish skew; sentiment -0.48", conf:0.66 },
    { ts:"14:28:11", ag:"EARN",   tk:"COST", sig:"+", msg:"Transcript — CFO confirms membership fee hike considered; dodge-detect 0/7 tariff Qs", conf:0.81 },
    { ts:"14:27:48", ag:"FILING", tk:"GS",   sig:"+", msg:"10-Q — IB fees +42% YoY; equities trading at cycle high; VaR 2% QoQ higher", conf:0.77 },
    { ts:"14:26:52", ag:"AGGR",   tk:"META", sig:"-", msg:"Conflict: SENT -0.6 vs EARN +0.2. Resolution: SENT weighted higher (recency)", conf:0.74 },
  ];
  const chartPts = Array.from({length:90},(_,i) => Math.round(100000 + i*110 + Math.sin(i/7)*3200 + Math.sin(i/3.3+0.7)*1400 + (i===34?-1800:0) + (i===58?2100:0)));
  const news = [
    { ts:"14:32", src:"REUT", tk:"NVDA", h:"Nvidia books 'several billion' in Saudi AI chip orders; Humain deal widens" },
    { ts:"14:28", src:"BBG",  tk:"META", h:"Meta FTC probe expands to Threads data practices, sources say" },
    { ts:"14:21", src:"DJ",   tk:"LLY",  h:"Eli Lilly Zepbound wins expanded label for sleep apnea in obese adults" },
    { ts:"14:14", src:"FT",   tk:"XOM",  h:"OPEC+ signals possible Q1 output hold as Brent slides below $72" },
    { ts:"14:08", src:"REUT", tk:"TSLA", h:"Wells Fargo cuts Tesla Q4 delivery estimate on China softness" },
    { ts:"13:54", src:"BBG",  tk:"JPM",  h:"JPMorgan Dimon says consumer resilient, commercial real estate 'uneven'" },
    { ts:"13:40", src:"CNBC", tk:"PLTR", h:"Palantir AIP rollout expands to 143 commercial customers, up from 112" },
    { ts:"13:22", src:"FT",   tk:"GS",   h:"Goldman Solomon sees IPO window reopening into early 2026" },
  ];
  const earnings = [
    { date:"TUE 04/21", tk:"NVDA", time:"AMC", eps:5.89, rev:"41.2B",  wh:"HIGH" },
    { date:"WED 04/22", tk:"MSFT", time:"AMC", eps:3.42, rev:"69.8B",  wh:"HIGH" },
    { date:"WED 04/22", tk:"META", time:"AMC", eps:5.21, rev:"44.9B",  wh:"MED" },
    { date:"THU 04/23", tk:"AAPL", time:"AMC", eps:2.38, rev:"124.3B", wh:"HIGH" },
    { date:"THU 04/23", tk:"AMZN", time:"AMC", eps:1.49, rev:"186.4B", wh:"MED" },
    { date:"FRI 04/24", tk:"XOM",  time:"BMO", eps:1.82, rev:"88.1B",  wh:"MED" },
  ];
  const agentPerf = [
    { ag:"FILING", n:847,  hit:0.71, sharpe:1.82, pnl:+12840, avgConf:0.78, model:"opus-4.6" },
    { ag:"EARN",   n:312,  hit:0.68, sharpe:1.54, pnl:+6210,  avgConf:0.74, model:"opus-4.6" },
    { ag:"SENT",   n:1920, hit:0.59, sharpe:0.88, pnl:+3180,  avgConf:0.64, model:"sonnet-4.6" },
    { ag:"MACRO",  n:94,   hit:0.64, sharpe:1.21, pnl:+2040,  avgConf:0.71, model:"sonnet-4.6" },
    { ag:"AGGR",   n:486,  hit:0.73, sharpe:2.04, pnl:+18420, avgConf:0.81, model:"opus-4.6" },
  ];
  return { tickers, positions, signals, agentStream, chartPts, news, earnings, agentPerf,
    meta: { portVal:186742.50, cash:84230, dailyPnl:+2840.30, dailyPnlPct:+1.55,
      sharpe:1.82, drawdown:-2.8, winRate:0.67, openPos:7, longExp:0.58, shortExp:0.12,
      beta:0.72, vol:14.2, regime:"TRANSITIONING", regimeConf:0.71 } };
})();
