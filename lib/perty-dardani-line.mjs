// The one thing Dardani says under the masthead of the reader's paper, when
// he has something true to say. Two kinds, in this order:
//
//   1. Absence: "Mungove 3 ditë." — the reader skipped at least two days. The
//      edition below is already the best of what they missed.
//   2. A follow-up: "E ke lexuar «…». Sot ka vazhdim:" — a story in today's
//      edition is about the same person or town as one they read before, and
//      is newer than it.
//
// Nothing is said when neither is true: a line every day for its own sake is
// noise, and the point is that he noticed.

import { articleKeys } from "./per-ty-rank.mjs";
import { visitDates } from "./reader-ledger.mjs";

const DAY = 86400_000;
const dayStart = (date) => Date.parse(`${date}T00:00:00Z`);

/**
 * Whole days the reader skipped before `today` ("YYYY-MM-DD", Kosovo), and the
 * day they were last here. Null for a first visit, or a gap under two days.
 */
export function absence(ledger, today) {
  const before = visitDates(ledger).filter((d) => d < today);
  const last = before.at(-1);
  if (!last) return null;
  const missed = Math.round((dayStart(today) - dayStart(last)) / DAY) - 1;
  return missed >= 2 ? { missed, last } : null;
}

const specific = (article) => articleKeys(article).filter((k) => k.startsWith("person:") || k.startsWith("city:"));

/**
 * The first story of the edition, not yet read, that follows one the reader
 * did read: same person or town, published after it. `pool` holds the stories
 * the reader may have read (with their text, for matching).
 *
 * @template {{ slug: string, title: string, excerpt?: string, category?: string, city?: string, publishedAt?: string }} A
 * @param {readonly { article: A }[]} edition
 * @param {readonly A[]} pool
 * @param {ReadonlySet<string>} read
 * @returns {{ before: A, after: A } | null}
 */
export function followUp(edition, pool, read) {
  const readStories = (pool ?? [])
    .filter((a) => read.has(a.slug))
    .map((a) => ({ article: a, keys: specific(a), at: Date.parse(a.publishedAt ?? "") }))
    .filter((r) => r.keys.length > 0 && Number.isFinite(r.at))
    .sort((a, b) => b.at - a.at);
  if (readStories.length === 0) return null;

  for (const { article } of edition ?? []) {
    if (read.has(article.slug)) continue;
    const keys = specific(article);
    const at = Date.parse(article.publishedAt ?? "");
    if (keys.length === 0 || !Number.isFinite(at)) continue;
    const before = readStories.find((r) => r.at < at && r.keys.some((k) => keys.includes(k)));
    if (before) return { before: before.article, after: article };
  }
  return null;
}
