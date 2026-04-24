"use client";
import { useEffect, useState } from "react";

type Ev = {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source?: string;
  ag: string;
  sig: "+" | "-" | "~";
  tk: string;
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "--:--:--";
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "America/New_York",
  });
}

export default function LiveStream({ initial }: { initial: Ev[] }) {
  const [events, setEvents] = useState<Ev[]>(initial);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/news", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled && Array.isArray(j.items)) setEvents(j.items);
      } catch {}
    };
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!events.length) {
    return (
      <div className="stream">
        <div className="ev">
          <div className="ev-head">
            <span className="mono">--:--:--</span>
            <span className="ag">LOADING</span>
          </div>
          <div className="ev-msg">Fetching live headlines…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="stream">
      {events.slice(0, 10).map((e) => (
        <a
          key={e.link}
          className="ev"
          href={e.link}
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="ev-head">
            <span className="mono">{fmtTime(e.pubDate)}</span>
            <span className="ag">{e.ag}</span>
            <span className="tk">{e.tk}</span>
            <span
              className={
                e.sig === "+" ? "sig-up" : e.sig === "-" ? "sig-dn" : ""
              }
            >
              {e.sig}
            </span>
          </div>
          <div className="ev-msg">{e.title}</div>
        </a>
      ))}
    </div>
  );
}
