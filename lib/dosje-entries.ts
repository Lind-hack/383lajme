import { getDosje, listDosjeTopics, type DosjeCitation } from "@/lib/dosje-server";
import { TOPICS, topicBySlug, timelineFor } from "@/lib/topics.mjs";
import type { DosjeEntry } from "@/components/dosje-section";

/**
 * One dossier, from the database when it has been approved and from the
 * hand-written file until then.
 *
 * The two sources are not equivalent and the difference is the point. A
 * milestone out of the database has been through the pipeline: its citations
 * were fetched, two distinct publishers answered 200, and a person approved it.
 * A milestone out of lib/topics.mjs was written from memory in a chat session
 * and has never been checked against anything.
 *
 * So the fallback is not a mirror, it is a temporary state that ends topic by
 * topic as each one is approved. Mixing the two inside a single dossier would
 * be worse than either: a reader cannot tell which line is sourced, and an
 * unsourced line beside a cited one borrows its authority. A dossier therefore
 * comes wholly from one place or wholly from the other.
 */

/**
 * A topic as the matcher needs it: identity plus the vocabulary it scores on.
 * Loosely typed on the vocabulary fields because lib/topics.mjs is untyped and
 * carries more per topic than the database has columns for.
 */
export type DosjeTopicMatcher = Record<string, unknown> & DosjeTopicRef;

/** One dossier's identity for routing and listing, from either half. */
export interface DosjeTopicRef {
  slug: string;
  title: string;
  blurb: string;
  /** True when this dossier's history came out of the database, not the file. */
  approved: boolean;
}

export interface DosjeResult {
  title: string;
  blurb: string;
  entries: DosjeEntry[];
  /** True when this dossier's history is sourced. Drives the citation UI. */
  sourced: boolean;
  /**
   * Approved explainers. Empty until they have been vetted and approved, which
   * is correct: an unreviewed video is more persuasive than an unreviewed
   * sentence and a reader cannot skim it for the error.
   */
  videos: { id: string; channel: string; title: string }[];
}

type Article = {
  slug: string;
  title: string;
  excerpt?: string;
  category?: string;
  source?: string | null;
  publishedAt?: string;
  imageUrl?: string | null;
};

/** Citations travel with the entry so the reader can check a claim in place. */
export interface SourcedEntry extends DosjeEntry {
  citations?: DosjeCitation[];
}

/**
 * The archive half of a timeline: this dossier's own recent coverage, which is
 * the same in both modes because those are articles 383 actually published.
 */
function archiveEntries(
  slug: string,
  articles: Article[],
  currentSlug: string | undefined,
  currentArticle: Article | null | undefined,
  universe: DosjeTopicMatcher[]
): DosjeEntry[] {
  return (
    timelineFor(slug, articles, currentSlug, currentArticle, universe) as DosjeEntry[]
  ).filter((e) => e.kind === "article");
}

export async function dosjeFor(
  slug: string,
  articles: Article[],
  currentSlug?: string,
  currentArticle?: Article | null
): Promise<DosjeResult | null> {
  const [live, universe] = await Promise.all([getDosje(slug), dosjeUniverse()]);

  // An approved topic wins even with no milestones yet. It used to need at
  // least one, which sent a dossier that had been through review back to the
  // hand-written file — the exact mixing this module exists to prevent, and on
  // the half that had actually been checked. An approved dossier with no
  // moments is a thin page; an approved dossier showing unsourced history is a
  // wrong one.
  if (live?.topic) {
    const milestones: SourcedEntry[] = live.milestones.map((m) => ({
      kind: "milestone" as const,
      id: `db:${m.id}`,
      // The gutter shows the year; the line under it shows how the date was
      // actually written, which is not always a full one.
      year: String(m.event_date ?? "").slice(0, 4),
      date: m.display_date,
      tag: m.tag ?? undefined,
      title: m.title,
      summary: m.summary,
      why: m.why ?? undefined,
      imageUrl: m.image?.url ?? null,
      imageCredit: m.image?.credit ?? null,
      imageSlug: null,
      citations: m.citations ?? [],
      lastVerifiedAt: m.last_verified_at ?? null,
    }));

    return {
      title: live.topic.title,
      blurb: live.topic.blurb,
      entries: [...milestones, ...archiveEntries(slug, articles, currentSlug, currentArticle, universe)],
      sourced: true,
      videos: (live.videos ?? []).map((v) => ({
        id: (String(v.url).match(/[?&]v=([^&]+)/) || [])[1] ?? "",
        channel: v.credit ?? "",
        title: "",
      })).filter((v) => v.id),
    };
  }

  // Not approved yet. The file still renders, and says nothing about sources
  // because it has none to show.
  const topic = topicBySlug(slug);
  if (!topic) return null;

  return {
    title: topic.title,
    blurb: topic.blurb,
    entries: timelineFor(slug, articles, currentSlug, currentArticle, universe) as DosjeEntry[],
    sourced: false,
    // The hand-written list, minus what the vetting pass has already refused.
    videos: topic.videos ?? [],
  };
}

/**
 * Every dossier that has a page, from both halves of the feature.
 *
 * The database and lib/topics.mjs had drifted: migration 0064 added twelve
 * subjects the newsroom actually publishes, but every public surface resolved a
 * slug through topicBySlug() against the six topics hard-coded in the file. So
 * approving one of the twelve in /admin/dosje produced a 404 — the dossier was
 * live, sourced and unreachable.
 *
 * The union is the fix rather than replacing one with the other. The database is
 * authoritative for which subjects exist and is the only half that can grow
 * without a deploy; the file still carries the five dossiers that have not been
 * approved yet and would otherwise vanish from the site. Approved rows win on
 * title and blurb, because those have been through review.
 *
 * Ordered by title so the chip rail and the index read the same way. Returns the
 * file's topics alone when the database cannot be reached, which is the same
 * failure posture as getDosje: a dossier must never take a page down with it.
 */
export async function listAllDosjeTopics(): Promise<DosjeTopicRef[]> {
  return (await dosjeUniverse()).map(({ slug, title, blurb, approved }) => ({
    slug,
    title,
    blurb,
    approved,
  }));
}

/**
 * The set of subjects an article competes across, with the vocabulary each one
 * matches on.
 *
 * matchTopic awards a story to its single best topic, so the answer depends on
 * who else was in the room. Every public surface asked that question against
 * the six topics in lib/topics.mjs while the automation job asked it against
 * all eighteen in the database — two different answers to the same question,
 * and the reader got the narrower one.
 *
 * Where both halves know a subject the file wins on vocabulary, exactly as
 * app/api/automation/dosje/subjects does: matchGroups and context are hand-cut
 * there and have no column in the database. A subject that exists only in the
 * database brings its own anchors and no groups, which scoreTopic reads as a
 * group of one per anchor — which is why 0064 stores those anchors as phrases.
 */
export async function dosjeUniverse(): Promise<DosjeTopicMatcher[]> {
  const fileTopics = TOPICS as Array<Record<string, unknown> & { slug: string; title: string; blurb: string }>;
  const byFileSlug = new Map(fileTopics.map((t) => [t.slug, t]));

  const bySlug = new Map<string, DosjeTopicMatcher>();
  for (const t of fileTopics) {
    bySlug.set(t.slug, { ...t, slug: t.slug, title: t.title, blurb: t.blurb, approved: false });
  }

  for (const row of await listDosjeTopics()) {
    const canonical = byFileSlug.get(row.slug);
    bySlug.set(row.slug, {
      ...(canonical ?? {}),
      slug: row.slug,
      // Approved rows have been through review, so their wording wins.
      title: row.title,
      blurb: row.blurb,
      anchors: (canonical?.anchors as string[] | undefined) ?? row.anchors ?? [],
      signals: (canonical?.signals as string[] | undefined) ?? row.signals ?? [],
      excludes: (canonical?.excludes as string[] | undefined) ?? row.excludes ?? [],
      matchGroups: (canonical?.matchGroups as unknown[] | undefined) ?? [],
      context: (canonical?.context as string[] | undefined) ?? [],
      approved: true,
    });
  }

  return [...bySlug.values()].sort((a, b) => a.title.localeCompare(b.title, "sq"));
}

/**
 * One dossier's identity, from whichever half knows about it. Null when neither
 * does, which is the only case that should still 404.
 */
export async function dosjeTopicRef(slug: string): Promise<DosjeTopicRef | null> {
  return (await listAllDosjeTopics()).find((t) => t.slug === slug) ?? null;
}
