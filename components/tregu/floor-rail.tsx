"use client";

import Link from "next/link";
import { fmtNum } from "@/lib/format";
import { getCategoryColor } from "@/lib/category-colors";
import { normalizeCategory } from "@/lib/category-map";
import type { MiniMarket } from "./market-mini-card";

// Small flame for the hottest books — drawn inline like the rest of the
// tregu glyphs (Sparkline, CoinFace); the project carries no icon library.
function Flame({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M6 0.6c.3 2-1 2.9-1.9 4C3.2 5.7 2.6 6.8 2.6 8a3.4 3.4 0 0 0 6.8 0c0-.6-.2-1.3-.5-1.9-.5.9-1.2 1.2-1.2 1.2.5-1.7-.2-4.6-1.7-6.7Z" />
    </svg>
  );
}

function hoursLeft(iso?: string): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return null;
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m`;
}

/* Some upstreams answer "no picture" with a picture.
   formula1.com serves d_driver_fallback_image.png — a blank grey silhouette —
   for any driver it has no portrait for. It is a real image that loads fine, so
   a truthy-URL check accepts it and the row renders an empty square, which is
   worse than the category disc it displaced. Reject the known placeholders by
   name and let the next source win. */
function usableImage(url?: string | null): string | null {
  if (!url) return null;
  return /d_driver_fallback_image|driver_fallback|placeholder|\/fallback\./i.test(url) ? null : url;
}

/**
 * A face for a row.
 *
 * Every row used to be a rank, a sentence and a percentage — three columns of
 * text, so the eye had nothing to catch on and the panel read as a footnote.
 * A picture per row is what makes a ranked list feel like somewhere to click.
 * Four sources, first hit wins: a competitor's badge, a driver's portrait, the
 * article image the market was written from, and failing all three the market's
 * initial on its category colour — never a blank, because a hole in the column
 * is worse than a plain disc.
 */
function RailThumb({ market }: { market: MiniMarket }) {
  const outcomes = market.sportOutcomes ?? [];
  const src =
    usableImage(outcomes.find((o) => usableImage(o.headshot_url))?.headshot_url) ||
    usableImage(outcomes.find((o) => usableImage(o.logo))?.logo) ||
    usableImage(market.marketMedia?.src) ||
    null;

  if (src) {
    return (
      // Decorative: the question beside it is the link's accessible name.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="tregu-hot-thumb"
        src={src}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }

  const tint = getCategoryColor(normalizeCategory(market.category));
  return (
    <span
      className="tregu-hot-thumb tregu-hot-thumb-fallback"
      aria-hidden
      style={{ background: `color-mix(in srgb, ${tint} 16%, #fff)`, color: tint }}
    >
      {(market.question ?? "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

// The right-hand rail beside the flagship carousel: ranked hot topics and the
// nearest deadlines. The promo tile that used to close this column has become
// the trader leaderboard, which sits under the flagship card instead.
export default function FloorRail({ markets }: { markets: MiniMarket[] }) {
  /* Open books only, in both panels.
     MiniMarket carried no status until now, so the rail could not tell a
     settled market from a live one and ranked purely on volume — which a
     resolved market wins by definition, having had its whole life to collect
     it. That is how a finished race sat at #2 showing 100%: not a ranking bug
     but a missing field. */
  const live = markets.filter((m) => m.status === "open");

  const hot = [...live].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 5);

  const closing = [...live]
    .filter((m) => hoursLeft(m.closesAt) !== null)
    .sort((a, b) => new Date(a.closesAt!).getTime() - new Date(b.closesAt!).getTime())
    .slice(0, 3);


  return (
    <aside className="tregu-rail" aria-label="Paneli i tregut">
      {hot.length > 0 && (
        <section className="tregu-glass tregu-rail-panel tregu-edge" data-rail="hot">
          <h3 className="tregu-rail-title">
            <span className="tregu-rail-flame"><Flame /></span>
            Temat e nxehta
          </h3>
          {hot.map((m, i) => {
            const values = Object.values(m.outcomeProbabilities ?? {}).filter(Number.isFinite);
            const pct = Math.round(Math.max(0, Math.min(1, values.length ? Math.max(...values) : m.prob)) * 100);
            return (
              <Link key={m.slug} href={`/tregu/${m.slug}`} className="tregu-hot-row" data-thumbed>
                <span className="tregu-hot-rank">{i + 1}</span>
                <RailThumb market={m} />
                <span className="tregu-hot-q">{m.question}</span>
                <span className="tregu-hot-pct">{pct}%</span>
                <span className="tregu-hot-meta">
                  {fmtNum(m.volume ?? 0)} 383C
                  {i === 0 && (
                    <span className="tregu-rail-flame"><Flame size={10} /></span>
                  )}
                </span>
              </Link>
            );
          })}
        </section>
      )}

      {closing.length > 0 && (
        <section className="tregu-glass tregu-rail-panel tregu-edge" data-rail="closing">
          <h3 className="tregu-rail-title">Mbyllen së shpejti</h3>
          {closing.map((m) => {
            const pct = Math.round(Math.max(0, Math.min(1, m.prob)) * 100);
            return (
              <Link key={m.slug} href={`/tregu/${m.slug}`} className="tregu-hot-row" data-thumbed>
                <span className="tregu-hot-rank tregu-hot-clock">{hoursLeft(m.closesAt)}</span>
                <RailThumb market={m} />
                <span className="tregu-hot-q">{m.question}</span>
                <span className="tregu-hot-pct">{pct}%</span>
              </Link>
            );
          })}
        </section>
      )}

    </aside>
  );
}
