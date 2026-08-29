import { getDosje, type DosjeCitation } from "@/lib/dosje-server";
import { topicBySlug, timelineFor } from "@/lib/topics.mjs";
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
  currentSlug?: string
): DosjeEntry[] {
  return (timelineFor(slug, articles, currentSlug) as DosjeEntry[]).filter(
    (e) => e.kind === "article"
  );
}

export async function dosjeFor(
  slug: string,
  articles: Article[],
  currentSlug?: string
): Promise<DosjeResult | null> {
  const live = await getDosje(slug);

  if (live?.topic && live.milestones.length) {
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
    }));

    return {
      title: live.topic.title,
      blurb: live.topic.blurb,
      entries: [...milestones, ...archiveEntries(slug, articles, currentSlug)],
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
    entries: timelineFor(slug, articles, currentSlug) as DosjeEntry[],
    sourced: false,
    // The hand-written list, minus what the vetting pass has already refused.
    videos: topic.videos ?? [],
  };
}
