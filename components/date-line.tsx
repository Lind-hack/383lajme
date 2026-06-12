"use client";

// Masthead date line. ISR pages (revalidate 3600) can serve a stale SSR
// date, so the client re-renders with the visitor's actual date on mount.

import { useEffect, useState } from "react";
import { formatDateSq } from "@/lib/date-sq";

type DateLineProps = {
  color?: string;
};

export default function DateLine({ color = "#6B6B6B" }: DateLineProps) {
  const [text, setText] = useState(() => formatDateSq());

  useEffect(() => {
    setText(formatDateSq());
  }, []);

  return (
    <span
      suppressHydrationWarning
      style={{
        fontSize: "12px",
        fontWeight: 600,
        letterSpacing: "0.06em",
        color,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}
