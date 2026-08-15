"use client";

// One foreign article: what it looks like, what it says, and the words that
// decided its label.
//
// It was text-only until now, and read like a log line. The cache had been
// resolving og:images all along and the published file simply dropped the
// field; the blurb is new, written by Gemini in the pipeline. Together they
// turn a row into something worth stopping on.
//
// A client component only because a remote og:image fails often enough that
// the fallback has to be stateful — publishers move files, hotlink-protect,
// and 404. Everything else here is static markup, and /toni still renders it
// on the server first.

import { useState } from "react";
import { ExternalLink, Quote } from "lucide-react";
import { TONE_COLOR, formatArticleDate } from "@/lib/tone-scale";
import type { ToneArticle } from "@/lib/tone-data";

export const TONE_META: Record<string, { label: string; color: string }> = {
  positive: { label: "Pozitiv", color: TONE_COLOR.positive },
  neutral: { label: "Neutral", color: TONE_COLOR.neutral },
  negative: { label: "Kritik", color: TONE_COLOR.critical },
};

export type ToneCardArticle = ToneArticle & {
  outlet: string;
  country?: string;
  blurb?: string;
  imageUrl?: string | null;
  flag?: string;
};

export default function ToneArticleCard({ a }: { a: ToneCardArticle }) {
  const [imageFailed, setImageFailed] = useState(false);
  const meta = TONE_META[a.sentiment];
  const accent = meta?.color ?? TONE_COLOR.neutral;
  const date = formatArticleDate(a.date);
  const showImage = Boolean(a.imageUrl) && !imageFailed;

  return (
    <a
      className="tone-card"
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      // The accent drives the left rule, the evidence bar and the fallback
      // tint, so it is set once as a custom property rather than threaded
      // through three inline styles.
      style={{ ["--tone-accent" as string]: accent, borderLeftColor: accent }}
    >
      {/* Fixed aspect box so a missing or slow image never shifts the row.
          Only 39 of 87 cached articles have a resolved og:image, so the
          fallback is a normal state, not an edge case — it carries the
          country instead of pretending to be a photo. */}
      <div className="tone-card__media" aria-hidden>
        {showImage ? (
          <img src={a.imageUrl as string} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <span
            className="tone-card__flag"
            style={{ background: `linear-gradient(140deg, ${accent}22, ${accent}0A)` }}
          >
            {a.flag || "🌍"}
          </span>
        )}
      </div>

      <div className="tone-card__body">
        {/* No country here on purpose. The stored `country` is the FEED an
            article was found in, not the outlet's home — Google serves a
            Bangladeshi paper into the US feed, and the card was captioning
            "Bangladesh Post · SHBA". The masthead is the honest identity. */}
        <div className="tone-card__meta">
          <span className="tone-card__outlet">{a.outlet}</span>
          {date && <span>{date}</span>}
          <span className="tone-card__badge" style={{ color: accent }}>
            {meta?.label ?? "—"}
          </span>
        </div>

        {/* Albanian first. The original headline is German or Turkish and
            sits underneath for anyone who wants to check the rendering. */}
        <h5 className="tone-card__title">{a.albanianTitle || a.title}</h5>

        {/* The hook: one line saying what the story is actually about. */}
        {a.blurb && <p className="tone-card__blurb">{a.blurb}</p>}

        {a.albanianTitle && a.albanianTitle !== a.title && (
          <p className="tone-card__original">{a.title}</p>
        )}

        {/* The outlet's own words that decided a non-neutral call. The
            classifier has always had to produce this span to justify one —
            showing it turns the label from something the reader has to trust
            into something they can check. */}
        {a.evidence && a.sentiment !== "neutral" && (
          <p className="tone-card__evidence">
            «{a.evidence}»
          </p>
        )}

        {a.reason && (
          <p className="tone-card__reason">
            {a.isQuote && (
              <Quote size={13} strokeWidth={2} aria-label="Citim" style={{ flexShrink: 0, marginTop: "2px" }} />
            )}
            <span>
              {a.isQuote && a.speaker ? `Citim i ${a.speaker}. ` : ""}
              {a.reason}
            </span>
          </p>
        )}

        <span className="tone-card__cta">
          Lexo te {a.outlet} <ExternalLink size={12} strokeWidth={2.2} />
        </span>
      </div>
    </a>
  );
}
