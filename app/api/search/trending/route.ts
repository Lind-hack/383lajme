import { NextResponse } from "next/server";
import { getSearchData } from "@/lib/search-sources";
import { CURATED, mentions, nameForms } from "@/lib/entities.mjs";
import { fold } from "@/lib/search-match.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * What the search overlay offers before the reader types: who the last two
 * days of stories are about, most-covered first.
 *
 * Candidates are subjects search already knows — the curated people and
 * organisations, and the people the archive keeps returning to — scored over
 * recent stories, a headline counting double. Extracting names from the recent
 * stories alone was tried first and returned "Aston Villan" (a declension)
 * and "Këngëtari Harry Styles" (a job title glued to a name): a chip has to
 * be a name the search behind it actually resolves.
 */
const WINDOW_MS = 48 * 60 * 60 * 1000;
const LIMIT = 6;
/** A derived person must recur across the archive before they can trend. */
const MIN_ARCHIVE_MENTIONS = 8;
/** Below this, "trending" would be one passing mention. */
const MIN_SCORE = 3;

type Candidate = { name: string; forms: string[] };

export async function GET() {
  const { articles, people } = await getSearchData();
  const since = Date.now() - WINDOW_MS;
  const recent = (articles ?? []).filter((a) => {
    const t = Date.parse(a?.publishedAt ?? "");
    return Number.isFinite(t) && t >= since;
  });

  const candidates: Candidate[] = [];
  const named = new Set<string>();
  const add = (name: string, forms: string[]) => {
    const key = fold(name);
    if (!key || named.has(key) || forms.length === 0) return;
    named.add(key);
    candidates.push({ name, forms });
  };
  for (const e of CURATED) if (e?.kind !== "teme") add(e.name, nameForms(e));
  for (const p of people ?? []) {
    if ((p?.mentions ?? 0) < MIN_ARCHIVE_MENTIONS) continue;
    add(p.name, [p.name]);
  }

  const trending = candidates
    .map((c) => {
      let score = 0;
      for (const a of recent) {
        if (mentions({ title: a.title }, c.forms)) score += 2;
        else if (mentions({ body: a.body }, c.forms)) score += 1;
      }
      return { name: c.name, score };
    })
    .filter((c) => c.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, LIMIT)
    .map((c) => ({ title: c.name, href: `/kerko?entitet=${encodeURIComponent(c.name)}` }));

  return NextResponse.json(
    { trending },
    // Shared by every reader and only as fresh as the index (5 minutes).
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
