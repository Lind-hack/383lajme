import { NextResponse, type NextRequest } from "next/server";
import { getSearchIndex } from "@/lib/search-sources";
import { search, nearest, looksLikeQuestion } from "@/lib/search-match.mjs";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Kërko — one endpoint over the whole site.
 *
 * Public and unauthenticated by design: it returns only what is already
 * published. Matching happens in this process rather than in Postgres because
 * `ilike` cannot fold Albanian diacritics, and a reader typing "kosove" on a
 * phone keyboard has to find "Kosovë".
 */

/** Long enough to be a query, short enough that a slip does not hit the index. */
const MIN_QUERY = 2;
const MAX_QUERY = 120;

/**
 * Record a query that found nothing.
 *
 * The point is editorial, not analytics: a list of what readers asked for and
 * did not get is the clearest brief for what to publish next. Fire-and-forget —
 * a logging failure must never change what the reader sees.
 */
async function logMiss(query: string, suggestions: number) {
  const supabase = createAdminClient();
  if (!supabase) return;
  try {
    await supabase.from("search_queries").insert({
      query: query.slice(0, MAX_QUERY),
      suggestions,
    });
  } catch (error) {
    console.error("[kerko] could not log a zero-result query", error);
  }
}

export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY);

  if (raw.length < MIN_QUERY) {
    return NextResponse.json(
      { query: raw, groups: [], suggestions: [], isQuestion: false, tooShort: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const index = await getSearchIndex();
  const groups = search(index, raw, { perGroup: 4, total: 18 });
  const found = groups.reduce((n, g) => n + g.items.length, 0);

  // A miss never dead-ends: it offers the nearest destinations, and the
  // Pyet 383 route is surfaced by the client whether or not there are results.
  const suggestions = found === 0 ? nearest(index, raw, 5) : [];
  if (found === 0) {
    // Deliberately not awaited: the reader should not wait on a write that only
    // matters to the newsroom.
    void logMiss(raw, suggestions.length);
  }

  return NextResponse.json(
    {
      query: raw,
      groups,
      suggestions,
      isQuestion: looksLikeQuestion(raw),
      count: found,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
