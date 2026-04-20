"use client";

import { useEffect, useState } from "react";
import type { Position } from "@/lib/types";

interface Article {
  title: string;
  author: string;
  published: string;
  url: string;
  tickers: string[];
  snippet: string;
}

const DEMO_ARTICLES: Article[] = [
  {
    title: "NVIDIA Reports Record Data Center Revenue, Beats Estimates",
    author: "Reuters",
    published: "2026-04-12T09:00:00.000Z",
    url: "#",
    tickers: ["NVDA"],
    snippet:
      "NVIDIA reported quarterly data center revenue of $18.4B, up 154% YoY...",
  },
  {
    title: "Fed Minutes Signal Patience on Rate Cuts",
    author: "Bloomberg",
    published: "2026-04-12T08:00:00.000Z",
    url: "#",
    tickers: [],
    snippet:
      "Federal Reserve officials indicated they are in no rush to lower rates...",
  },
  {
    title: "Apple Services Revenue Hits All-Time High",
    author: "CNBC",
    published: "2026-04-12T07:00:00.000Z",
    url: "#",
    tickers: ["AAPL"],
    snippet:
      "Apple's services segment posted record quarterly revenue of $23.1B...",
  },
  {
    title: "JPMorgan Raises Dividend, Announces $30B Buyback",
    author: "WSJ",
    published: "2026-04-12T06:00:00.000Z",
    url: "#",
    tickers: ["JPM"],
    snippet:
      "JPMorgan Chase announced a dividend increase and a new share repurchase program...",
  },
  {
    title: "Oil Prices Fall on Demand Concerns",
    author: "Reuters",
    published: "2026-04-12T05:00:00.000Z",
    url: "#",
    tickers: ["XOM", "CVX"],
    snippet:
      "Crude oil prices dropped 2% as economic data raised concerns about global demand...",
  },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function NewsTile({
  positions,
}: {
  positions: Position[];
}) {
  const [articles, setArticles] = useState<Article[]>(DEMO_ARTICLES);

  useEffect(() => {
    const tickers = positions.map((p) => p.ticker);
    if (!tickers.length) return;

    fetch(`/api/market?action=news&tickers=${tickers.join(",")}&limit=8`)
      .then((r) => r.json())
      .then((json) => {
        if (json.articles?.length) {
          setArticles(json.articles);
        }
      })
      .catch(() => {});
  }, [positions]);

  return (
    <div className="p-4 h-full flex flex-col">
      <h3
        className="text-[10px] uppercase tracking-wider font-medium mb-3"
        style={{ color: "var(--fg-muted)" }}
      >
        News
      </h3>
      <div className="flex-1 overflow-y-auto space-y-0">
        {articles.map((a, i) => (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-2.5 transition-colors"
            style={{
              borderBottom: "1px solid var(--border)",
              textDecoration: "none",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <p
                className="text-[12px] font-medium leading-snug"
                style={{ color: "var(--fg)" }}
              >
                {a.title}
              </p>
              <span
                className="text-[10px] font-mono shrink-0"
                style={{ color: "var(--fg-muted)" }}
              >
                {timeAgo(a.published)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-[10px]"
                style={{ color: "var(--fg-muted)" }}
              >
                {a.author}
              </span>
              {a.tickers.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="text-[9px] font-mono px-1 py-0.5"
                  style={{
                    color: "var(--fg-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
