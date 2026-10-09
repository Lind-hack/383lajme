"use client";

// The rest of the reader's edition under the cover: stories 2..n as numbered
// rows. Story one is the cover's (paper/cover), so it is never listed twice.
//
// Shared with the public snapshot (/gazeta), which passes `readOnly`: no
// reasons, no "E re" or "Lexuar", no progress — those describe the sharer's
// history, not the friend's.

import Link from "next/link";
import Image from "next/image";
import { Check } from "lucide-react";
import TimeAgo from "@/components/time-ago";
import { getCategoryColor } from "@/lib/category-colors";
import { isNewSince } from "@/lib/perty-visits.mjs";
import type { FeedArticle } from "../per-ty-feed";

/** What a row needs to know about this reader's history with the story. */
export type Seen = {
  since: string | null;
  read: ReadonlySet<string>;
  /** Opened since this page was last drawn: their tick pops in. */
  justRead: ReadonlySet<string>;
};

export type FrontItem = { article: FeedArticle; reason: string };

export const NO_HISTORY: Seen = { since: null, read: new Set(), justRead: new Set() };

/** "E re" for a story that arrived since the last visit, "Lexuar" once opened. */
export function Mark({ article, seen }: { article: FeedArticle; seen: Seen }) {
  if (seen.read.has(article.slug)) return <span className="perty-mark perty-mark--read">Lexuar</span>;
  if (isNewSince(article, seen.since)) return <span className="perty-mark perty-mark--new">E re</span>;
  return null;
}

export function Meta({ article, date = false }: { article: FeedArticle; date?: boolean }) {
  return (
    <span className="perty-item-meta">
      <b style={{ color: getCategoryColor(article.category) }}>{article.category}</b>
      <i aria-hidden="true">·</i>
      {date ? <span>{shortDate(article.publishedAt)}</span> : <TimeAgo iso={article.publishedAt} />}
    </span>
  );
}

const MONTHS = ["jan", "shk", "mar", "pri", "maj", "qer", "korr", "gush", "shta", "tet", "nën", "dhj"];

/** "12 shta" — for shelf stories older than this week, where "18 ditë më parë" reads stale. */
function shortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Belgrade", day: "numeric", month: "numeric" })
      .formatToParts(d)
      .map((p) => [p.type, p.value])
  );
  return `${parts.day} ${MONTHS[Number(parts.month) - 1] ?? ""}`;
}

export default function FrontPage({
  items,
  seen = NO_HISTORY,
  readOnly = false,
  printFrom = 0,
}: {
  items: readonly FrontItem[];
  seen?: Seen;
  readOnly?: boolean;
  /** Index of the first block for the "paper prints" stagger. */
  printFrom?: number;
}) {
  const [lead, ...rest] = items;
  if (!lead) return null;
  return (
    <>
      {rest.length > 0 && (
        <ol className="perty-ed-list" start={2}>
          {rest.map((item, i) => (
            <li key={item.article.slug} data-print style={{ "--i": printFrom + 1 + i } as React.CSSProperties}>
              <EditionRow item={item} n={i + 2} seen={seen} readOnly={readOnly} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/**
 * One numbered story. The number turns into a tick once it has been opened;
 * the row stays where it was. A picture only when the story has one — an
 * empty grey box is not a picture.
 */
function EditionRow({ item, n, seen, readOnly }: { item: FrontItem; n: number; seen: Seen; readOnly: boolean }) {
  const { article, reason } = item;
  const isRead = !readOnly && seen.read.has(article.slug);
  return (
    <Link
      href={`/article/${article.slug}`}
      className="perty-ed-row"
      data-read={isRead || undefined}
      data-just-read={(isRead && seen.justRead.has(article.slug)) || undefined}
    >
      <span className="perty-ed-n" aria-hidden="true">
        {isRead ? <Check size={15} strokeWidth={3} /> : n}
      </span>
      <span className="perty-ed-body">
        {!readOnly && (
          <span className="perty-ed-reason">
            {reason}
            <Mark article={article} seen={seen} />
          </span>
        )}
        <strong className="perty-ed-title">{article.title}</strong>
        {article.excerpt && <span className="perty-ed-excerpt">{article.excerpt}</span>}
        <Meta article={article} />
      </span>
      {article.imageUrl && (
        <span className="perty-ed-thumb">
          <Image
            src={article.imageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 80px, 120px"
            style={{ objectFit: "cover" }}
          />
        </span>
      )}
    </Link>
  );
}
