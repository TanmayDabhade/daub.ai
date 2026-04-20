"use client";

/**
 * Generic tile wrapper for the dashboard grid.
 * Provides consistent border and background.
 */
export default function Tile({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        border: "1px solid var(--border)",
        background: "var(--bg-card)",
      }}
    >
      {children}
    </div>
  );
}
