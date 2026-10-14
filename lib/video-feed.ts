// The "Video" rows' feed: official short-form videos 383's video editor
// approved (scripts/video_curation.py, on the VPS every two hours 07:00-23:00).
//
// The curation job takes the official channels' new YouTube Shorts (the
// channels the news pipeline trusts: governments, institutions, leagues,
// clubs, companies), has Agent Reach and a Hermes judge watch each one, and
// keeps only what is engaging, safe and posted by the rights holder, with an
// Albanian title. It publishes the approved list as a public JSON file in
// storage (video-picks/index.json); this reads it. A video that is also a 383
// story's clip links to the story.

import { unstable_cache } from "next/cache";
import { getVideoArticles } from "./db";
import { youtubeIdOf } from "./video-clip";
import { videoKey } from "./video-key.mjs";
import { NAV_CATEGORIES, type NavCategory } from "./category-map";

export type FeedVideo = {
  /** Where its reactions and comments live (lib/video-key). */
  key: string;
  videoId: string;
  /** The editor's Albanian title. */
  title: string;
  /** Why it is worth watching, one Albanian sentence. */
  why: string;
  channel: string;
  category: NavCategory;
  publishedAt: string;
  /** The editor's engagement score, 1-10. */
  score: number;
  /** The 383 story this is the clip of, if any. */
  storySlug: string | null;
};

const SECTIONS = new Set<string>(NAV_CATEGORIES.map((c) => c.label));

function picksUrl() {
  // VIDEO_PICKS_URL points a local preview at production's list.
  if (process.env.VIDEO_PICKS_URL) return process.env.VIDEO_PICKS_URL;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return base ? `${base}/storage/v1/object/public/video-picks/index.json` : "";
}

/** The approved list, validated field by field: it is data from another machine. */
function parsePicks(json: unknown): Omit<FeedVideo, "storySlug">[] {
  const rows = (json as { videos?: unknown })?.videos;
  if (!Array.isArray(rows)) return [];
  const out: Omit<FeedVideo, "storySlug">[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const id = typeof r?.id === "string" ? r.id : "";
    const key = videoKey(id);
    const title = typeof r?.title === "string" ? r.title.trim() : "";
    const section = typeof r?.section === "string" && SECTIONS.has(r.section) ? (r.section as NavCategory) : null;
    const publishedAt = typeof r?.publishedAt === "string" && Number.isFinite(Date.parse(r.publishedAt)) ? r.publishedAt : "";
    if (!key || !title || !section || !publishedAt) continue;
    out.push({
      key,
      videoId: id,
      title: title.slice(0, 120),
      why: typeof r?.why === "string" ? r.why.slice(0, 200) : "",
      channel: typeof r?.channel === "string" ? r.channel.slice(0, 60) : "",
      category: section,
      publishedAt,
      score: Number.isFinite(Number(r?.score)) ? Number(r.score) : 0,
    });
  }
  return out;
}

async function buildFeed(): Promise<FeedVideo[]> {
  const url = picksUrl();
  if (!url) return [];
  const [res, stories] = await Promise.all([
    fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) }).catch(() => null),
    getVideoArticles({ sinceDays: 14, limit: 60 }).catch(() => []),
  ]);
  if (!res?.ok) return [];
  const picks = parsePicks(await res.json().catch(() => null));
  const storyOf = new Map<string, string>();
  for (const a of stories) {
    const id = youtubeIdOf(a.videoClipUrl);
    if (id && !storyOf.has(id)) storyOf.set(id, a.slug);
  }
  return picks.map((p) => ({ ...p, storySlug: storyOf.get(p.videoId) ?? null }));
}

// Five minutes: the editor publishes every two hours, so a new pick shows
// within minutes of being approved.
const cachedFeed = unstable_cache(buildFeed, ["video-picks-v1"], { revalidate: 300, tags: ["video-feed"] });

/** The approved videos, best and newest first; [] before the first run or when storage is unreachable. */
export async function getVideoFeed(): Promise<FeedVideo[]> {
  try {
    return await cachedFeed();
  } catch (error) {
    console.error("[video-feed] unavailable", error);
    return [];
  }
}

/** One section's videos. */
export async function getSectionVideos(category: string): Promise<FeedVideo[]> {
  return (await getVideoFeed()).filter((v) => v.category === category);
}

/**
 * True for a video key ("video-…", lib/video-key) whose video is approved now —
 * what reactions and comments accept besides a story's slug.
 */
export async function isKnownVideoKey(key: unknown): Promise<boolean> {
  if (typeof key !== "string" || !key.startsWith("video-")) return false;
  return (await getVideoFeed()).some((v) => v.key === key);
}

/** The order the homepage row takes sections in, one video each per round. */
const HOME_ORDER: NavCategory[] = ["Kosovë", "Shqipëri", "Sport", "Botë", "Teknologji", "Ekonomi", "Showbiz"];

/**
 * The homepage row: best and newest first within each section, the sections
 * taken in turn, so the busiest channels (football posts most) cannot fill it.
 */
export function mixForHome(feed: FeedVideo[]): FeedVideo[] {
  const queues = HOME_ORDER.map((c) => feed.filter((v) => v.category === c));
  const out: FeedVideo[] = [];
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) out.push(q.shift() as FeedVideo);
  return out;
}
