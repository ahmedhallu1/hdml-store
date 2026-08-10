"use client";

import { useEffect, useState } from "react";

/**
 * Live clock for the operating timezone.
 *
 * Renders nothing on the server and stays empty until mounted: the server's
 * clock and the visitor's differ by whatever the request took, which is a
 * guaranteed hydration mismatch. An empty first paint costs nothing here
 * because the label beside it already carries the timezone.
 */
export function LocalClock({ timeZone, className }: { timeZone: string; className?: string }) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const format = () => {
      try {
        setTime(
          new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone,
          }).format(new Date()),
        );
      } catch {
        // An unknown IANA zone must not take the footer down.
        setTime(null);
      }
    };
    format();
    const id = window.setInterval(format, 30_000);
    return () => window.clearInterval(id);
  }, [timeZone]);

  if (!time) return null;

  return (
    <span className={className}>
      <span
        aria-hidden="true"
        className="mr-1.5 inline-block size-1.5 rounded-full bg-settled-400 align-middle"
      />
      {time}
    </span>
  );
}
