"use client";

// What a country's press actually said, shown on the map itself.
//
// Tapping a country used to only recolour it and move a highlight, which is a
// dead end on a phone: the answer lived in a list far below the fold. This
// puts the two biggest stories under the reader's thumb, where the tap
// happened.

import { X, ArrowRight } from "lucide-react";
import { TONE_INK, toneFill, toneLabel, formatArticleDate } from "@/lib/tone-scale";
import type { ToneCardArticle } from "./tone-article-card";

export interface ToneMapSheetProps {
  country: string;
  flag: string;
  index: number | null;
  /** Scored articles behind the index, and how many were unreadable. */
  n: number;
  confident: boolean;
  articles: ToneCardArticle[];
  onClose: () => void;
  /** "See everything for this country" — opens the full drill-down below. */
  onExpand?: () => void;
}

export default function ToneMapSheet({
  country,
  flag,
  index,
  n,
  confident,
  articles,
  onClose,
  onExpand,
}: ToneMapSheetProps) {
  return (
    <div className="tone-sheet" role="dialog" aria-label={`Lajmet nga ${country}`}>
      <div className="tone-sheet__head">
        <span className="tone-sheet__flag" aria-hidden>{flag || "🌍"}</span>
        <div className="tone-sheet__id">
          <strong>{country}</strong>
          <span>
            {index ?? "—"} · {toneLabel(index).toLowerCase()} · {n} artikuj
            {!confident && " · mbulim i pjesshëm"}
          </span>
        </div>
        <span aria-hidden className="tone-sheet__swatch" style={{ background: toneFill(index) }} />
        <button type="button" onClick={onClose} aria-label="Mbyll" className="tone-sheet__close">
          <X size={15} strokeWidth={2.4} />
        </button>
      </div>

      {articles.length === 0 ? (
        <p className="tone-sheet__empty">Ende nuk ka artikuj të ruajtur për këtë vend.</p>
      ) : (
        <div className="tone-sheet__list">
          {articles.slice(0, 2).map((a, i) => (
            <a
              key={`${a.url}-${i}`}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="tone-sheet__item"
            >
              {a.imageUrl ? (
                <img src={a.imageUrl} alt="" loading="lazy" />
              ) : (
                <span className="tone-sheet__thumb" aria-hidden>{flag || "🌍"}</span>
              )}
              <span className="tone-sheet__text">
                <strong>{a.albanianTitle || a.title}</strong>
                {a.blurb && <span className="tone-sheet__blurb">{a.blurb}</span>}
                <span className="tone-sheet__outlet">{a.outlet}
                  {formatArticleDate(a.date) ? ` · ${formatArticleDate(a.date)}` : ""}
                </span>
              </span>
            </a>
          ))}
        </div>
      )}

      {onExpand && articles.length > 0 && (
        <button type="button" onClick={onExpand} className="tone-sheet__more">
          Të gjitha nga {country} <ArrowRight size={13} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}

/** Shared by the inline map and the fullscreen one. */
export const TONE_SHEET_INK = TONE_INK;
