/**
 * The order a dossier is read in: by when things happened, oldest first.
 * A verified moment sorts on its event date, a 383 article on its publication
 * date; on the same day the moment comes first. Undated entries go last.
 * Pure; returns a new array.
 *
 * @template {{ kind: string, eventDate?: string | null, publishedAt?: string | null }} E
 * @param {E[]} entries
 * @returns {E[]}
 */
export function orderTimeline(entries) {
  const key = (e) => {
    const raw = e.kind === "milestone" ? e.eventDate : e.publishedAt;
    const t = raw ? Date.parse(String(raw).length === 10 ? `${raw}T00:00:00Z` : String(raw)) : NaN;
    return Number.isFinite(t) ? t : Infinity;
  };
  return entries
    .map((e, i) => ({ e, i, k: key(e) }))
    .sort((a, b) => {
      const da = Math.floor(a.k / 86_400_000);
      const db = Math.floor(b.k / 86_400_000);
      if (da !== db || !Number.isFinite(a.k) || !Number.isFinite(b.k)) return a.k - b.k || a.i - b.i;
      if (a.e.kind !== b.e.kind) return a.e.kind === "milestone" ? -1 : 1;
      return a.k - b.k || a.i - b.i;
    })
    .map((x) => x.e);
}
