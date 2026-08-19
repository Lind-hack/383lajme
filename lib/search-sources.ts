import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getToneOutlets, getToneTopics } from "./tone-data";
import { KOSOVO_CITIES } from "./visit-v2-data";
import { NAV_CATEGORIES } from "./category-map";
import { extractPeople, deriveEntity } from "./entities.mjs";
import { getToneHistory } from "./tone-data";

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
  // Below an article on purpose: a market that shares a word with the query
  // is a weaker answer than a piece of reporting about it.
  treg: 0.85,
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

/** What a country result carries beyond its name. */
export interface CountryFacts {
  index: number | null;
  /** Change against the most recent comparable history row, or null when there
   *  is none. Rows of different stanceVersion are not comparable. */
  delta: number | null;
  articles: number;
  /** A few of that country's own pieces about Kosovo. */
  foreign: { title: string; url: string; outlet: string; sentiment: string }[];
}

export interface SearchData {
  entries: SearchEntry[];
  /** Countries, topics and cities as searchable subjects, alongside people. */
  subjects: ReturnType<typeof deriveEntity>[];
  /** Keyed by country name, for the composite country result. */
  countryFacts: Record<string, CountryFacts>;
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

/**
 * Countries, outlets and topics — and, for a country, the facts its result
 * card shows: where the tone index stands, which way it moved, and a few of
 * that country's own pieces about Kosovo.
 */
async function toneEntries(): Promise<{
  entries: SearchEntry[];
  subjects: ReturnType<typeof deriveEntity>[];
  countryFacts: Record<string, CountryFacts>;
}> {
  const entries: SearchEntry[] = [];
  const subjects: ReturnType<typeof deriveEntity>[] = [];
  const countryFacts: Record<string, CountryFacts> = {};

  const [outlets, history] = await Promise.all([
    getToneOutlets().catch(() => null),
    getToneHistory().catch(() => [] as Awaited<ReturnType<typeof getToneHistory>>),
  ]);

  if (outlets?.countries) {
    for (const [country, data] of Object.entries(outlets.countries)) {
      const summary = data?.summary;
      const n = summary?.n ?? 0;
      const index = summary?.index ?? null;

      entries.push({
        kind: "vend",
        title: country,
        href: `/toni?vendi=${encodeURIComponent(country)}`,
        meta: n ? `${n} artikuj të analizuar` : "Toni i mediave",
        weight: WEIGHT.vend,
      });

      subjects.push(
        deriveEntity({
          name: country,
          kind: "vend",
          role: index === null ? "Toni i mediave" : `Indeksi i tonit ${index}`,
          href: `/kerko?entitet=${encodeURIComponent(country)}`,
        }),
      );

      countryFacts[country] = {
        index,
        delta: countryDelta(history, country, index),
        articles: n,
        // The whole point of /toni is what the world writes about Kosovo, so
        // this country's outlets are already exactly that corpus.
        foreign: (data?.outlets ?? [])
          .flatMap((outlet) =>
            (outlet?.articles ?? []).map((a) => ({
              title: a.albanianTitle || a.title,
              url: a.url,
              outlet: outlet.name,
              sentiment: a.sentiment,
            })),
          )
          .slice(0, 3),
      };

      for (const outlet of data?.outlets ?? []) {
        if (!outlet?.name) continue;
        entries.push({
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
    const meta = `${topic.count} artikuj${topic.countries?.length ? ` · ${topic.countries.length} vende` : ""}`;
    entries.push({
      kind: "tema",
      title: topic.label,
      body: topic.summary ?? "",
      href: `/toni?tema=${encodeURIComponent(topic.label)}`,
      meta,
      weight: WEIGHT.tema,
    });
    subjects.push(
      deriveEntity({
        name: topic.label,
        kind: "teme",
        role: meta,
        href: `/kerko?entitet=${encodeURIComponent(topic.label)}`,
      }),
    );
  }

  return { entries, subjects, countryFacts };
}

/**
 * How far a country's tone has moved since the last comparable reading.
 *
 * "Comparable" is doing real work. tone-data states that rows of different
 * stanceVersion measure different things and must not be subtracted from one
 * another — version 1 asked whether the news was good or bad, version 2 asks
 * whether the outlet's own voice is hostile. Differencing across that boundary
 * would invent a swing that never happened, so a country with no earlier row
 * of the same version simply has no arrow.
 */
function countryDelta(
  history: { countries?: Record<string, { index: number | null }>; stanceVersion?: number }[],
  country: string,
  current: number | null,
): number | null {
  if (current === null || !history?.length) return null;

  const latest = history[history.length - 1];
  const version = latest?.stanceVersion ?? 1;

  for (let i = history.length - 2; i >= 0; i--) {
    const row = history[i];
    if ((row?.stanceVersion ?? 1) !== version) break;
    const previous = row?.countries?.[country]?.index;
    if (typeof previous === "number") return Math.round(current - previous);
  }
  return null;
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
      return { entries: [] as SearchEntry[], subjects: [], countryFacts: {} };
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
    ...tone.entries,
    ...remote.entries,
    ...people.map((p) => ({
      kind: "person" as const,
      title: p.name,
      href: `/kerko?entitet=${encodeURIComponent(p.name)}`,
      meta: `${p.mentions} përmendje`,
      weight: WEIGHT.person,
    })),
  ];

  // Cities are subjects too: "Prizren" should list what has been written
  // about Prizren, not only open the visit page.
  const citySubjects = KOSOVO_CITIES.map((city) =>
    deriveEntity({
      name: city.name,
      kind: "qytet",
      role: city.region,
      href: `/kerko?entitet=${encodeURIComponent(city.name)}`,
    }),
  );

  const subjects = [
    ...tone.subjects,
    ...citySubjects,
    ...people.map((p) => deriveEntity({ name: p.name, kind: "person", role: `${p.mentions} përmendje` })),
  ];

  const data = {
    entries,
    subjects,
    countryFacts: tone.countryFacts,
    articles: remote.articles,
    people,
  };
  cache = { at: now, data };
  return data;
}

/** Just the ranked entries, for callers that do not need the raw corpus. */
export async function getSearchIndex(): Promise<SearchEntry[]> {
  return (await getSearchData()).entries;
}
