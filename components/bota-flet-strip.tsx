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

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StripCard } from "./bota-flet-card";
import type { ForeignCoverageItem } from "@/lib/tone-data";

export default function BotaFletStrip({ items }: { items: ForeignCoverageItem[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollByCard(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".bota-flet-strip-card");
    const step = (card?.offsetWidth ?? 220) + 14; // card width + the strip's own gap
    el.scrollBy({ left: direction * step, behavior: "smooth" });
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
      >
        <ChevronLeft size={18} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        aria-label="Artikujt e ardhshëm"
        className="bota-flet-strip-nav bota-flet-strip-nav-next"
        onClick={() => scrollByCard(1)}
      >
        <ChevronRight size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}
