"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  // On mount, read stored preference and apply
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    const initial = stored ?? "system";
    setTheme(initial);
    applyTheme(initial);

    // Listen for system preference changes when set to "system"
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if ((localStorage.getItem("theme") ?? "system") === "system") {
        applyTheme("system");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function cycle() {
    const order: Theme[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    localStorage.setItem("theme", next);
    applyTheme(next);
  }

  const labels: Record<Theme, string> = {
    light: "LIGHT",
    dark: "DARK",
    system: "AUTO",
  };

  return (
    <button
      onClick={cycle}
      className="text-[10px] font-mono px-2 py-1 uppercase tracking-wider transition-colors"
      style={{
        color: "var(--fg-muted)",
        border: "1px solid var(--border)",
      }}
      title={`Theme: ${theme}. Click to cycle.`}
    >
      {labels[theme]}
    </button>
  );
}
