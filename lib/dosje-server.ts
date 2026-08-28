import { createClient } from "@supabase/supabase-js";

/**
 * Reading an approved dossier.
 *
 * The timeline used to be a 700-line literal in lib/topics.mjs, written by hand
 * with two citations across forty-two claims. It now lives in Supabase, where a
 * milestone cannot be published without two citations that were actually
 * fetched — enforced by a trigger in migration 0051, not by this file.
 *
 * Nothing here filters for approval. The `dosje_topic` function and the row
 * level security behind it already do, so a mistake in this module cannot leak
 * a draft: the rows are not visible to the key it holds.
 *
 * Named -server following pyet-server.ts and tregu-automation-server.ts: this
 * module reads with a Supabase client and must not be pulled into a client
 * bundle.
 *
 * This is deliberately NOT yet wired into the pages. Until 0051 and 0052 have
 * been applied the tables do not exist, and the article rail still renders from
 * lib/topics.mjs. Swapping the read path before the data is there would empty
 * the dossier for readers rather than for reviewers.
 */

export interface DosjeCitation {
  url: string;
  publisher: string;
  title: string | null;
  date: string | null;
}

export interface DosjeImage {
  url: string;
  credit: string | null;
  sourceUrl: string | null;
  license: string | null;
}

export interface DosjeMilestone {
  id: string;
  event_date: string;
  date_precision: "day" | "month" | "year";
  display_date: string;
  tag: string | null;
  title: string;
  summary: string;
  why: string | null;
  citations: DosjeCitation[];
  image: DosjeImage | null;
}

export interface DosjeTopic {
  slug: string;
  title: string;
  blurb: string;
}

export interface Dosje {
  topic: DosjeTopic;
  milestones: DosjeMilestone[];
  videos: { url: string; credit: string | null }[];
}

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * One approved dossier, or null.
 *
 * Every failure — no credentials, tables not yet migrated, a network error —
 * returns null rather than throwing. A dossier is context beside an article; it
 * must never be able to take the article down with it.
 */
export async function getDosje(slug: string): Promise<Dosje | null> {
  const supabase = anonClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.rpc("dosje_topic", { p_slug: slug });
    if (error || !data) return null;

    const payload = data as {
      topic: DosjeTopic | null;
      milestones: DosjeMilestone[] | null;
      videos: { url: string; credit: string | null }[] | null;
    };
    if (!payload.topic) return null;

    return {
      topic: payload.topic,
      // Optional-chained throughout: these rows are written by a drafting job
      // and read long after, so the shape on disk may predate the shape here.
      milestones: (payload.milestones ?? []).map((m) => ({
        ...m,
        citations: m?.citations ?? [],
        image: m?.image ?? null,
      })),
      videos: payload.videos ?? [],
    };
  } catch {
    return null;
  }
}

/**
 * The dossiers a reader can browse. Approved topics only, because RLS says so.
 */
export async function listDosjeTopics(): Promise<DosjeTopic[]> {
  const supabase = anonClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("dosje_topics")
      .select("slug, title, blurb")
      .order("title");
    if (error || !data) return [];
    return data as DosjeTopic[];
  } catch {
    return [];
  }
}

/**
 * Whether the dossier tables are live yet. The pages use this to decide between
 * the database and the legacy literal, so the switchover is a data event rather
 * than a deploy.
 */
export async function dosjeIsLive(): Promise<boolean> {
  const supabase = anonClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("dosje_topics").select("slug").limit(1);
    return !error;
  } catch {
    return false;
  }
}
