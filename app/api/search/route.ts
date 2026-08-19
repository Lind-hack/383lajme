import { NextResponse, type NextRequest } from "next/server";
import { getSearchData } from "@/lib/search-sources";
import { search, nearest, looksLikeQuestion } from "@/lib/search-match.mjs";
import { resolveEntity, surfaceForms, mentions } from "@/lib/entities.mjs";
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

/** The overlay shows a handful; the results page asks for everything. */
const OVERLAY_ARTICLES = 4;
const PAGE_ARTICLES = 60;

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
  const params = request.nextUrl.searchParams;
  const raw = (params.get("q") ?? params.get("entitet") ?? "").trim().slice(0, MAX_QUERY);
  // The results page asks for the full set; the overlay wants a preview.
  const full = params.get("full") === "1";

  if (raw.length < MIN_QUERY) {
    return NextResponse.json(
      { query: raw, groups: [], suggestions: [], isQuestion: false, tooShort: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const { entries, articles, people } = await getSearchData();

  /**
   * Who or what the query names, if anything.
   *
   * This is the difference between finding an article by the word it happens
   * to contain and finding it by the person it is about: "Edi", "Rama" and
   * "kryeministri i Shqipërisë" are three ways of asking the same question,
   * and only one of them appears in the text.
   */
  const entity = resolveEntity(raw, people);
  let entityArticles: { title: string; href: string; meta?: string }[] = [];

  if (entity) {
    const forms = surfaceForms(entity);
    entityArticles = articles
      .filter((a) => mentions(a, forms))
      .slice(0, full ? PAGE_ARTICLES : OVERLAY_ARTICLES)
      .map((a) => ({ title: a.title, href: `/article/${a.slug}`, meta: a.meta }));
  }

  const rawGroups = search(entries, raw, {
    perGroup: full ? 40 : 4,
    total: full ? 200 : 18,
  });

  // The entity block already answered "about this person". Repeating those
  // articles underneath, and repeating the person as a link to the page the
  // reader is already looking at, is the same answer three times.
  const shown = new Set(entityArticles.map((a) => a.href));
  const groups = rawGroups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i: { href: string; kind: string; title: string }) =>
          !shown.has(i.href) && !(entity && i.kind === "person" && i.title === entity.name),
      ),
    }))
    .filter((g) => g.items.length > 0);

  const found = groups.reduce((n, g) => n + g.items.length, 0) + entityArticles.length;

  const suggestions = found === 0 ? nearest(entries, raw, 5) : [];
  if (found === 0) void logMiss(raw, suggestions.length);

  return NextResponse.json(
    {
      query: raw,
      // The subject the reader named, with the pieces about them. Sent
      // separately from `groups` because it is a different claim: these are
      // articles about this person, not articles containing this string.
      entity: entity
        ? {
            name: entity.name,
            kind: entity.kind,
            role: entity.role ?? null,
            href: `/kerko?entitet=${encodeURIComponent(entity.name)}`,
            articles: entityArticles,
            // Whether more exist than were returned, so the overlay can offer
            // the page rather than implying this is all of it.
            total: articles.filter((a) => mentions(a, surfaceForms(entity))).length,
          }
        : null,
      groups,
      suggestions,
      isQuestion: looksLikeQuestion(raw),
      count: found,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
