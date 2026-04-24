"use client";
import { useEffect, useState } from "react";

export function LiveDate({ initial }: { initial: string }) {
  const [s, setS] = useState(initial);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setS(
        d.toLocaleDateString("en-US", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      );
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  return <span className="date">{s}</span>;
}

export function LiveETClock({ initial }: { initial: string }) {
  const [s, setS] = useState(initial);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setS(
        d.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "America/New_York",
        }) + " ET",
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <>{s}</>;
}
