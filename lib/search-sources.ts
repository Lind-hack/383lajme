import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getToneOutlets, getToneTopics } from "./tone-data";
import { KOSOVO_CITIES } from "./visit-v2-data";
import { NAV_CATEGORIES } from "./category-map";
import { extractPeople } from "./entities.mjs";

/**
 * Kërko — the one index behind the whole site.
 *
 * Server-only: this pulls from tone-data, which imports fs/promises. It is
 * assembled here rather than in the route so the route stays about HTTP.
 *
 * The point of indexing more than articles is that search then doubles as
 * navigation. Someone typing "Gjermani" wants the Germany tone panel, not
 * fourteen articles that mention Germany; someone typing "Prizren" wants the
 * city. Those destinations have no routes of their own, so they are addressed
 * by query parameter and the receiving page opens the matching panel.
 */

export type SearchKind =
  | "person"
  | "artikull"
  | "tema"
  | "vend"
  | "media"
  | "vizito"
  | "treg"
  | "kategori";

export interface SearchEntry {
  kind: SearchKind;
  title: string;
  /** Supporting text that may match but never outranks a title. */
  body?: string;
  href: string;
  /** The dim second line under the title in the overlay. */
  meta?: string;
  weight?: number;
}

/**
 * How far a destination outranks an article that matches equally well.
 *
 * A reader who types a country name has told you where they want to go. The
 * article that happens to share the word is the weaker answer, and without
 * these the bulk of the index would bury every navigational result.
 */
const WEIGHT: Record<SearchKind, number> = {
  // A person the reader named outranks everything: they told you the subject.
  person: 1.8,
  kategori: 1.6,
  tema: 1.5,
  vend: 1.4,
  vizito: 1.3,
  media: 1.15,
  treg: 1.1,
  artikull: 1,
};

/**
 * Articles held in memory for folded matching.
 *
 * Postgres `ilike` cannot fold Albanian diacritics — "kosove" would not match
 * "Kosovë" — and there is no Albanian text-search configuration to delegate to.
 * So matching happens in this process, which means the archive has to fit in
 * it. At the current rate this covers roughly three months of publishing; past
 * that the honest fix is a generated, unaccented column in Postgres and a query
 * per search, not a larger number here.
 */
const ARTICLE_LIMIT = 2000;

/** Rebuilt at most this often. Search runs per keystroke; the sources do not. */
const TTL_MS = 5 * 60 * 1000;

export interface ArticleRecord {
  slug: string;
  title: string;
  body: string;
  meta: string;
}

export interface SearchData {
  entries: SearchEntry[];
  /** Kept raw so entity matching can scan them by surface form. */
  articles: ArticleRecord[];
  /** People the corpus is about, derived rather than curated. */
  people: { name: string; aliases: string[]; mentions: number }[];
}

let cache: { at: number; data: SearchData } | null = null;

function newsClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function shortDate(value?: string | null): string {
  if (!value) return "";
  const MONTHS = [
    "jan", "shk", "mar", "pri", "maj", "qer",
    "korr", "gush", "sht", "tet", "nën", "dhj",
  ];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** The six live sections. Cheap, static, and the most navigational thing here. */
function categoryEntries(): SearchEntry[] {
  return NAV_CATEGORIES.map(({ label, slug }) => ({
    kind: "kategori" as const,
    title: label,
    href: `/kategori/${slug}`,
    meta: "Kategori",
    weight: WEIGHT.kategori,
  }));
}

/** Cities and the individual places inside them, both landing on /visit. */
function visitEntries(): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const city of KOSOVO_CITIES) {
    out.push({
      kind: "vizito",
      title: city.name,
      body: `${city.region} ${city.tagline}`,
      href: `/visit?qyteti=${encodeURIComponent(city.id)}`,
      meta: city.region,
      weight: WEIGHT.vizito,
    });
    for (const place of city.places) {
      out.push({
        kind: "vizito",
        title: place.name,
        body: `${place.category} ${place.description}`,
        // The place opens its city; /visit has no per-place view to link to.
        href: `/visit?qyteti=${encodeURIComponent(city.id)}`,
        meta: `${place.category} · ${city.name}`,
        weight: WEIGHT.vizito,
      });
    }
  }
  return out;
}

async function toneEntries(): Promise<SearchEntry[]> {
  const out: SearchEntry[] = [];

  const outlets = await getToneOutlets().catch(() => null);
  if (outlets?.countries) {
    for (const [country, data] of Object.entries(outlets.countries)) {
      const n = data?.summary?.n ?? 0;
      out.push({
        kind: "vend",
        title: country,
        href: `/toni?vendi=${encodeURIComponent(country)}`,
        meta: n ? `${n} artikuj të analizuar` : "Toni i mediave",
        weight: WEIGHT.vend,
      });
      for (const outlet of data?.outlets ?? []) {
        if (!outlet?.name) continue;
        out.push({
          kind: "media",
          title: outlet.name,
          href: `/toni?vendi=${encodeURIComponent(country)}`,
          meta: `${country} · ${outlet.articleCount} artikuj`,
          weight: WEIGHT.media,
        });
      }
    }
  }

  const topics = await getToneTopics().catch(() => null);
  for (const topic of topics ?? []) {
    if (!topic?.label) continue;
    out.push({
      kind: "tema",
      title: topic.label,
      body: topic.summary ?? "",
      href: `/toni?tema=${encodeURIComponent(topic.label)}`,
      meta: `${topic.count} artikuj${topic.countries?.length ? ` · ${topic.countries.length} vende` : ""}`,
      weight: WEIGHT.tema,
    });
  }

  return out;
}

async function supabaseEntries(): Promise<{ entries: SearchEntry[]; articles: ArticleRecord[] }> {
  const supabase = newsClient();
  if (!supabase) return { entries: [], articles: [] };
  const out: SearchEntry[] = [];
  const records: ArticleRecord[] = [];

  const [articles, markets] = await Promise.all([
    supabase
      .from("news_articles")
      .select("slug, title, excerpt, category, source, published_at")
      .order("published_at", { ascending: false })
      .limit(ARTICLE_LIMIT),
    supabase.from("markets").select("slug, question, category, status").limit(500),
  ]);

  for (const a of articles.data ?? []) {
    if (!a?.slug || !a?.title) continue;
    const meta = [a.category, a.source, shortDate(a.published_at)].filter(Boolean).join(" · ");
    out.push({
      kind: "artikull",
      title: a.title,
      body: a.excerpt ?? "",
      href: `/article/${a.slug}`,
      meta,
      weight: WEIGHT.artikull,
    });
    records.push({ slug: a.slug, title: a.title, body: a.excerpt ?? "", meta });
  }

  for (const m of markets.data ?? []) {
    if (!m?.slug || !m?.question) continue;
    out.push({
      kind: "treg",
      title: m.question,
      href: `/tregu/${m.slug}`,
      meta: [m.category, m.status === "open" ? "i hapur" : m.status]
        .filter(Boolean)
        .join(" · "),
      weight: WEIGHT.treg,
    });
  }

  return { entries: out, articles: records };
}

/**
 * The whole index, cached briefly.
 *
 * Every source is allowed to fail on its own: a tone file that has not been
 * written yet, or Supabase being unreachable, must cost that section of the
 * results rather than the entire search.
 */
export async function getSearchData(): Promise<SearchData> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.data;

  const [tone, remote] = await Promise.all([
    toneEntries().catch((error) => {
      console.error("[kerko] tone sources unavailable", error);
      return [] as SearchEntry[];
    }),
    supabaseEntries().catch((error) => {
      console.error("[kerko] supabase sources unavailable", error);
      return { entries: [] as SearchEntry[], articles: [] as ArticleRecord[] };
    }),
  ]);

  // Derived from the corpus rather than curated, so a name the news started
  // using yesterday is searchable today without anyone adding it to a list.
  const people = extractPeople(remote.articles, { minMentions: 2 });

  const entries = [
    ...categoryEntries(),
    ...visitEntries(),
    ...tone,
    ...remote.entries,
    ...people.map((p) => ({
      kind: "person" as const,
      title: p.name,
      href: `/kerko?entitet=${encodeURIComponent(p.name)}`,
      meta: `${p.mentions} përmendje`,
      weight: WEIGHT.person,
    })),
  ];

  const data = { entries, articles: remote.articles, people };
  cache = { at: now, data };
  return data;
}

/** Just the ranked entries, for callers that do not need the raw corpus. */
export async function getSearchIndex(): Promise<SearchEntry[]> {
  return (await getSearchData()).entries;
}
