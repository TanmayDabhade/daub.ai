"use client";
import { useState } from "react";

export default function WaitlistForm() {
  const [done, setDone] = useState(false);
  return (
    <form
      className="wait-form"
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
      }}
    >
      <input type="email" placeholder="you@something.com" required disabled={done} />
      <button
        type="submit"
        style={done ? { background: "var(--good)" } : undefined}
      >
        {done ? "✓ on the list" : "Join →"}
      </button>
    </form>
  );
}
