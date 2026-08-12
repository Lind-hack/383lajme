"use client";

// Wraps the horizontal scroll-snap strip with prev/next buttons. Split into
// its own client leaf (matches bota-flet-card.tsx's pattern) so bota-flet.tsx
// itself stays server-rendered — only the scroll-by-button behavior needs a
// ref and an event handler.
//
// The buttons only show on coarse/no-hover pointers (see the media query in
// globals.css) — a touch user has no way to tell this row is scrollable
// beyond trial-and-error swiping, a mouse user can already see the cursor
// change and has a trackpad/wheel besides.

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StripCard } from "./bota-flet-card";
import type { ForeignCoverageItem } from "@/lib/tone-data";

// Sub-pixel scroll positions (fractional zoom, some Android browsers) mean
// scrollLeft never lands on an exact 0 or max — a tolerance is required or
// the edge state flickers permanently "not quite there".
const EDGE_TOLERANCE = 2;

export default function BotaFletStrip({ items }: { items: ForeignCoverageItem[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(items.length <= 1);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    function updateEdges() {
      const { scrollLeft, scrollWidth, clientWidth } = el!;
      setAtStart(scrollLeft <= EDGE_TOLERANCE);
      setAtEnd(scrollLeft >= scrollWidth - clientWidth - EDGE_TOLERANCE);
    }

    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, [items.length]);

  function scrollByCard(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".bota-flet-strip-card");
    const step = (card?.offsetWidth ?? 220) + 14; // card width + the strip's own gap
    // Clamp to the real scrollable range instead of a bare scrollBy() — past
    // the last card, an unclamped scrollBy on a bouncy mobile browser can
    // overshoot into the container's padding and momentarily show empty
    // space before the browser's own elastic snap-back kicks in. Computing
    // and scrolling straight to the clamped target skips that state.
    const maxScroll = el.scrollWidth - el.clientWidth;
    const target = Math.max(0, Math.min(maxScroll, el.scrollLeft + direction * step));
    el.scrollTo({ left: target, behavior: "smooth" });
  }

  return (
    <div className="bota-flet-strip-wrap">
      <div className="bota-flet-strip" ref={scrollerRef}>
        {items.map((item) => (
          <StripCard key={item.url} item={item} />
        ))}
      </div>
      <button
        type="button"
        aria-label="Artikujt e mëparshëm"
        className="bota-flet-strip-nav bota-flet-strip-nav-prev"
        onClick={() => scrollByCard(-1)}
        disabled={atStart}
      >
        <ChevronLeft size={18} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        aria-label="Artikujt e ardhshëm"
        className="bota-flet-strip-nav bota-flet-strip-nav-next"
        onClick={() => scrollByCard(1)}
        disabled={atEnd}
      >
        <ChevronRight size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}
