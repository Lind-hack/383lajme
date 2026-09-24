"use client";

// The moving half of the breaking bar: the newest headlines, one at a time.
//
// It turns over every 5 seconds — a headline is one line, and the six of them
// cycle in half a minute — and it never moves under the reader: hovering or
// focusing the bar holds the current story, and pressing an arrow restarts the
// clock rather than letting it jump a second later. Readers who ask the system
// for reduced motion get the arrows only.
//
// "Live" is decided on the reader's clock, after mount. The page is cached for
// up to an hour, so a freshness flag baked into the server HTML could keep
// pulsing over a story that went quiet fifty minutes ago.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import TimeAgo from "@/components/time-ago";
import { getCategoryColor } from "@/lib/category-colors";

export type LatestItem = {
  slug: string;
  title: string;
  category: string;
  publishedAt: string;
};

/** A story counts as just-in for this long. Past it the dot stops pulsing. */
const FRESH_MS = 45 * 60 * 1000;

/** How long each headline stays before the next one. */
const ROTATE_MS = 5_000;

export default function LatestStepper({ items }: { items: LatestItem[] }) {
  const [index, setIndex] = useState(0);
  const [fresh, setFresh] = useState(false);
  const [held, setHeld] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  // Screen readers hear a new headline only when the reader asked for it; an
  // announcement every few seconds would talk over whatever they are reading.
  const [steered, setSteered] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Keyed on index, so a manual step restarts the full interval.
  useEffect(() => {
    if (held || reduceMotion || items.length < 2) return;
    const t = window.setTimeout(
      () => setIndex((i) => (i + 1) % items.length),
      ROTATE_MS
    );
    return () => window.clearTimeout(t);
  }, [index, held, reduceMotion, items.length]);

  useEffect(() => {
    const newest = Date.parse(items[0]?.publishedAt ?? "");
    setFresh(Number.isFinite(newest) && Date.now() - newest < FRESH_MS);
  }, [items]);

  if (items.length === 0) {
    return (
      <>
        <span className="home-breaking-tag">
          <i aria-hidden="true" />
          <span className="home-breaking-tag-text">Lajmi i fundit</span>
        </span>
        <span className="home-breaking-text">Sot: kryesoret për të gjithë</span>
      </>
    );
  }

  const item = items[index] ?? items[0];
  const count = items.length;
  const step = (delta: number) => {
    setSteered(true);
    setIndex((i) => (i + delta + count) % count);
  };

  return (
    <span
      className="home-breaking-rotator"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
    >
      <span className="home-breaking-tag" data-fresh={fresh ? "true" : undefined}>
        <i aria-hidden="true" />
        <span className="home-breaking-tag-text">
          {index === 0 ? "Lajmi i fundit" : "Më herët"}
        </span>
      </span>

      <span className="home-breaking-story" aria-live={steered ? "polite" : "off"}>
        <Link
          key={item.slug}
          href={`/article/${item.slug}`}
          className="home-breaking-text"
        >
          {item.title}
        </Link>
        <span className="home-breaking-meta">
          <b style={{ color: getCategoryColor(item.category) }}>{item.category}</b>
          <TimeAgo iso={item.publishedAt} />
        </span>
      </span>

      {count > 1 && (
        <span className="home-breaking-nav">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Lajmi më i ri"
            disabled={index === 0}
          >
            <ChevronLeft size={16} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <span className="home-breaking-count" aria-hidden="true">
            {index + 1}/{count}
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label={
              index === count - 1 ? "Kthehu te lajmi i fundit" : "Lajmi më i vjetër"
            }
          >
            <ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </span>
      )}
    </span>
  );
}
