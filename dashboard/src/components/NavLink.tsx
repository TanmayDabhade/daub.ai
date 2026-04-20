"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className="px-3 py-1.5 text-sm transition-colors"
      style={{
        color: active ? "var(--fg)" : "var(--fg-secondary)",
        borderBottom: active ? "1px solid var(--fg)" : "1px solid transparent",
      }}
    >
      {label}
    </Link>
  );
}
