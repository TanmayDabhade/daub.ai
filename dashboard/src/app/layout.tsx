import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import NavLink from "@/components/NavLink";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Swarm Capital",
  description: "AI-Native Hedge Fund Dashboard",
};

const navItems = [
  { href: "/", label: "Portfolio" },
  { href: "/agents", label: "Agents" },
  { href: "/signals", label: "Signals" },
  { href: "/trades", label: "Trades" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className="min-h-full flex flex-col"
        style={{ background: "var(--bg)", color: "var(--fg)" }}
      >
        {/* Top nav */}
        <nav
          className="shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-8">
              <h1
                className="text-sm font-bold tracking-[0.1em] uppercase"
                style={{ color: "var(--fg)" }}
              >
                Swarm Capital
              </h1>
              <div className="flex items-center gap-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <div
                className="text-[10px] font-mono px-2 py-1 uppercase tracking-wider"
                style={{
                  color: "var(--fg-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                Paper
              </div>
            </div>
          </div>
        </nav>

        {/* Main content — full width, no max-w cap */}
        <main className="flex-1 overflow-auto">
          <div className="px-6 py-6">{children}</div>
        </main>
      </body>
    </html>
  );
}
