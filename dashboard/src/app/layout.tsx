import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Daub — Research Workbench",
  description: "AI-Native Quantitative Research Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable} h-full`}>
      <head>
        <style>{`
          :root {
            --font-sans: var(--font-inter), system-ui, -apple-system, sans-serif;
            --font-mono: var(--font-plex-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
            --sans: var(--font-inter), system-ui, -apple-system, sans-serif;
            --mono: var(--font-plex-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
          }
        `}</style>
      </head>
      <body
        style={{
          margin: 0,
          background: "var(--bg)",
          color: "var(--fg)",
          display: "flex",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        <Sidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <TopBar />
          <main style={{ flex: 1, overflow: "auto" }}>
            <div style={{ padding: "22px 28px" }}>{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
