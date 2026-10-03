"use client";

// The cover of the reader's own paper, laid out like a newsstand front page:
//
//   NR. 12 · E SHTUNË, 3 TETOR                       [Ndaje] [Rregullo]
//                     Kurieri i Lindit
//   ───────── LAJMET QË ZGJODHE TI · 7 LAJME · 2 MIN ─────────
//   K │                                               │
//   U │          the day's biggest story for          │
//   R │          this reader, as art                  │
//   T │                                               │
//   I │                                               │
//   headline, opening lines                     Lexo →
//   ║│║║│║ 383ks.com · Për ty                    Nr. 12
//
// The giant word is why this story leads this reader's paper — the person,
// town or topic they follow ("KURTI") — set with the art showing through its
// letters. The art is the story's clay illustration when the newsroom has one,
// otherwise its photo. Shared with the public snapshot (/gazeta), which passes
// `readOnly`: no buttons, no reasons.

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Share2, SlidersHorizontal } from "lucide-react";
import { coverWord } from "@/lib/per-ty-paper.mjs";
import type { FeedArticle } from "../per-ty-feed";

const WEEKDAYS = ["e diel", "e hënë", "e martë", "e mërkurë", "e enjte", "e premte", "e shtunë"];
const MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];

/**
 * "e martë, 30 shtator", by the Kosovo calendar. Spelled out rather than left to
 * Intl's "sq" locale, which some browsers ship without and fall back to English.
 */
export function dateline(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Belgrade", weekday: "short", day: "numeric", month: "numeric" })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return `${WEEKDAYS[weekday] ?? ""}, ${parts.day} ${MONTHS[Number(parts.month) - 1] ?? ""}`;
}

/** A decorative barcode: bars from the date and issue, so every day's differs. */
function Barcode({ seed }: { seed: string }) {
  let h = 2166136261;
  const bars: number[] = [];
  for (let i = 0; i < 34; i++) {
    h = Math.imul(h ^ (seed.charCodeAt(i % seed.length) + i), 16777619) >>> 0;
    bars.push(1 + (h % 3));
  }
  let x = 0;
  return (
    <svg className="perty-cover-barcode" viewBox="0 0 120 34" preserveAspectRatio="none" aria-hidden="true">
      {bars.map((w, i) => {
        const rect = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={34} /> : null;
        x += w + 1;
        return rect;
      })}
    </svg>
  );
}

export default function Cover({
  title,
  onRename,
  issue,
  date,
  count,
  minutes,
  lead,
  leadKey,
  readOnly = false,
  onShare,
  onCustomize,
}: {
  /** "Kurieri i Lindit" */
  title: string;
  onRename?: () => void;
  issue: number;
  /** Already formatted: "e shtunë, 3 tetor". */
  date: string;
  count: number;
  minutes?: number;
  lead: FeedArticle & { coverArt?: string | null };
  leadKey?: string;
  readOnly?: boolean;
  onShare?: (() => void) | null;
  onCustomize?: () => void;
}) {
  const art = lead.coverArt || lead.imageUrl || null;
  const word = coverWord(lead, leadKey);
  const clay = Boolean(lead.coverArt);
  return (
    <header className="perty-cover" data-has-art={art ? "" : undefined} data-print style={{ "--i": 0 } as React.CSSProperties}>
      <div className="perty-cover-strip">
        <span className="perty-cover-folio">
          {issue > 0 && <b>Nr. {issue}</b>}
          <span>{date}</span>
        </span>
        {!readOnly && (
          <span className="perty-cover-actions">
            {onShare && (
              <button type="button" className="perty-mast-btn perty-mast-btn--share" onClick={onShare}>
                <Share2 size={16} strokeWidth={2.4} aria-hidden="true" />
                <span>Ndaje</span>
              </button>
            )}
            {onCustomize && (
              <button type="button" className="perty-mast-btn" onClick={onCustomize} aria-label="Rregullo gazetën">
                <SlidersHorizontal size={16} strokeWidth={2.4} aria-hidden="true" />
                <span>Rregullo</span>
              </button>
            )}
          </span>
        )}
      </div>

      {readOnly || !onRename ? (
        <h1 className="perty-cover-title">{title}</h1>
      ) : (
        <h1 className="perty-cover-title">
          <button type="button" onClick={onRename} aria-label={`${title}. Ndrysho emrin`}>
            {title}
          </button>
        </h1>
      )}
      <p className="perty-cover-tagline">
        <span>Lajmet që zgjodhe ti</span>
        <span>
          {count} {count === 1 ? "lajm" : "lajme"}
          {minutes ? ` · ${minutes} min` : ""}
        </span>
      </p>

      <Link href={`/article/${lead.slug}`} className="perty-cover-hero">
        <span className="perty-cover-word" aria-hidden="true">
          {word.length > 0 &&
            (word.length > 7 ? [word.slice(0, Math.ceil(word.length / 2)), word.slice(Math.ceil(word.length / 2))] : [word]).map(
              (part, i) => (
                <span
                  key={i}
                  style={
                    {
                      "--len": Math.max(part.length, 3),
                      ...(art ? { backgroundImage: `url("${art.replace(/"/g, "%22")}")` } : {}),
                    } as React.CSSProperties
                  }
                >
                  {part}
                </span>
              )
            )}
        </span>
        {art && (
          <span className="perty-cover-art">
            <Image src={art} alt="" fill priority sizes="(max-width: 640px) 62vw, 560px" style={{ objectFit: "cover" }} />
            {clay && <small className="perty-cover-ai">Ilustrim me AI</small>}
          </span>
        )}
        <span className="perty-cover-story">
          <strong>{lead.title}</strong>
          {lead.excerpt && <span>{lead.excerpt}</span>}
          <em>
            Lexo lajmin <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
          </em>
        </span>
      </Link>

      <div className="perty-cover-foot">
        <Barcode seed={`${date}|${issue}|${lead.slug}`} />
        <span>383ks.com · Për ty</span>
        {issue > 0 && <span>Nr. {issue}</span>}
      </div>
    </header>
  );
}
