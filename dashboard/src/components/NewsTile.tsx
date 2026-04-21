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
  source?: string;
}

const DEMO_ARTICLES: Article[] = [
  { title: "NVIDIA Reports Record Data Center Revenue, Beats Estimates", author: "Reuters",
    published: new Date(Date.now() - 12 * 60000).toISOString(), url: "#", tickers: ["NVDA"],
    snippet: "NVIDIA reported quarterly data center revenue of $18.4B, up 154% YoY..." },
  { title: "Fed Minutes Signal Patience on Rate Cuts", author: "Bloomberg",
    published: new Date(Date.now() - 48 * 60000).toISOString(), url: "#", tickers: [],
    snippet: "Federal Reserve officials indicated they are in no rush to lower rates..." },
  { title: "Apple Services Revenue Hits All-Time High", author: "CNBC",
    published: new Date(Date.now() - 90 * 60000).toISOString(), url: "#", tickers: ["AAPL"],
    snippet: "Apple's services segment posted record quarterly revenue of $23.1B..." },
  { title: "JPMorgan Raises Dividend, Announces $30B Buyback", author: "WSJ",
    published: new Date(Date.now() - 120 * 60000).toISOString(), url: "#", tickers: ["JPM"],
    snippet: "JPMorgan Chase announced a dividend increase and a new share repurchase program..." },
  { title: "Oil Prices Fall on Demand Concerns", author: "Reuters",
    published: new Date(Date.now() - 180 * 60000).toISOString(), url: "#", tickers: ["XOM", "CVX"],
    snippet: "Crude oil prices dropped 2% as economic data raised concerns about global demand..." },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function NewsTile({ positions }: { positions: Position[] }) {
  const [articles, setArticles] = useState<Article[]>(DEMO_ARTICLES);
  const [source, setSource] = useState<string>("demo");

  useEffect(() => {
    const tickers = positions.map((p) => p.ticker);
    const symbolParam = tickers.length ? `&symbols=${tickers.join(",")}` : "";
    fetch(`/api/news?limit=10${symbolParam}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.articles?.length) {
          setArticles(json.articles);
          setSource(json.source ?? "live");
        }
      })
      .catch(() => {});
  }, [positions]);

  return (
    <div style={{ padding: "10px 0" }}>
      <div className="card-head" style={{ padding: "10px 14px" }}>
        <h3>Headlines</h3>
        <span className="sub">tickers you hold</span>
        <span style={{ flex: 1 }} />
        {source !== "demo" && (
          <span className="chip" style={{ fontSize: 9 }}>{source}</span>
        )}
      </div>
      <div style={{ maxHeight: 320, overflow: "auto" }}>
        <table className="t">
          <tbody>
            {articles.map((a, i) => (
              <tr key={i}>
                <td className="mute mono" style={{ width: 34, fontSize: 10.5 }}>
                  {timeAgo(a.published)}
                </td>
                <td style={{ width: 44 }}>
                  <span className="pill" style={{ fontSize: 9 }}>
                    {(a.source ?? a.author ?? "").substring(0, 5).toUpperCase()}
                  </span>
                </td>
                <td>
                  {a.tickers.slice(0, 2).map((t) => (
                    <span key={t} className="tkr" style={{ marginRight: 4, fontSize: 11 }}>{t}</span>
                  ))}
                </td>
                <td style={{ whiteSpace: "normal", lineHeight: 1.45 }}>
                  <a href={a.url} target="_blank" rel="noopener noreferrer"
                     style={{ color: "inherit", textDecoration: "none" }}>
                    {a.title}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
