"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/mock-data";

/**
 * Relative timestamp that is correct under ISR.
 *
 * Every page that renders one of these is cached (`revalidate` 3600 on the home
 * and category pages, 7200 on articles), so the string baked into the server HTML
 * can be up to two hours stale by the time a visitor sees it. React finds the text
 * mismatch on hydration, logs "server rendered text didn't match the client", and
 * throws away the surrounding subtree to regenerate it.
 *
 * `suppressHydrationWarning` stops the warning and the subtree discard. The
 * post-mount state change is the other half and is not optional: it recomputes
 * against the visitor's own clock, which is what corrects the stale cached value.
 * Suppressing without recomputing would be worse than the bug it fixes, because it
 * would freeze the stale text permanently.
 *
 * Renders a <time> element so the exact instant stays machine-readable regardless
 * of what the relative label says.
 */
export default function TimeAgo({
  iso,
  format = timeAgo,
  className,
  style,
}: {
  iso: string;
  /** Defaults to the shared `timeAgo`. Tregu screens pass their own Albanian
   *  phrasing ("para 5 min"), so they get the hydration fix without a copy change. */
  format?: (iso: string) => string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [, recompute] = useState(0);
  useEffect(() => {
    recompute((n) => n + 1);
  }, []);

  return (
    <time dateTime={iso} suppressHydrationWarning className={className} style={style}>
      {format(iso)}
    </time>
  );
}
