// The "Video" rows' feed: the newest uploads of the official channels
// (lib/video-channels.ts), refreshed every fifteen minutes.
//
// Free and keyless: every YouTube channel publishes an RSS feed of its latest
// fifteen uploads. Each video is checked with YouTube's oEmbed endpoint
// (a video whose owner turned embedding off answers 401/404 there), its title
// is put into Albanian once per refresh (lib/site-translation-provider, the
// site's own translator; the original stays if that fails), and a video that
// is also a 383 story's clip links to the story.
//
// Server code only (it reads the database). The whole feed is one cached value, so a page render never
// waits on 44 feeds.

import { unstable_cache } from "next/cache";
import { VIDEO_CHANNELS, type VideoChannel } from "./video-channels";
import { getVideoArticles } from "./db";
import { youtubeIdOf } from "./video-clip";
import { videoKey } from "./video-key.mjs";
import { translateSiteTexts } from "./site-translation-provider.mjs";
import type { NavCategory } from "./category-map";

export type FeedVideo = {
  /** Where its reactions and comments live (lib/video-key). */
  key: string;
  videoId: string;
  title: string;
  channel: string;
  category: NavCategory;
  publishedAt: string;
  /** A YouTube Short: shot upright. */
  short: boolean;
  /** The 383 story this is the clip of, if any. */
  storySlug: string | null;
};

/** How far back a channel's uploads count. */
const MAX_AGE_MS = 7 * 86_400_000;
/** At most this many from one channel, so one busy club cannot fill the row. */
const PER_CHANNEL = 3;
/** The whole feed. */
const MAX_VIDEOS = 48;

const HEADERS = { "User-Agent": "383NewsVideo/1.0 (https://383ks.com)" };

function decode(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

/** A channel's uploads from its RSS feed, newest first. */
async function channelUploads(channel: VideoChannel, now: number): Promise<FeedVideo[]> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const out: FeedVideo[] = [];
    for (const entry of xml.split("<entry>").slice(1)) {
      const id = entry.match(/<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/)?.[1];
      const title = entry.match(/<title>([^<]*)<\/title>/)?.[1];
      const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
      const key = id ? videoKey(id) : null;
      if (!id || !key || !title || !published) continue;
      const at = Date.parse(published);
      if (!Number.isFinite(at) || now - at > MAX_AGE_MS) continue;
      out.push({
        key,
        videoId: id,
        title: decode(title).trim(),
        channel: channel.name,
        category: channel.category,
        publishedAt: new Date(at).toISOString(),
        short: /\/shorts\//.test(entry.match(/<link rel="alternate" href="([^"]+)"/)?.[1] ?? ""),
        storySlug: null,
      });
      if (out.length >= PER_CHANNEL) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** False only when YouTube says the video cannot be embedded at all. */
async function embeddable(id: string) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`,
      { headers: HEADERS, signal: AbortSignal.timeout(6000), cache: "no-store" }
    );
    return res.ok;
  } catch {
    // An unreachable check is not a "no".
    return true;
  }
}

/**
 * One title in Albanian, remembered for a month: each refresh translates only
 * the titles it has not seen, which keeps well inside the free translator's
 * rate limit. A failure throws, and a thrown value is not cached, so that
 * title is simply tried again at the next refresh.
 */
const titleInAlbanian = unstable_cache(
  async (title: string) => {
    const [out] = await translateSiteTexts([title], "sq", { signal: AbortSignal.timeout(15000) });
    if (typeof out !== "string" || !out.trim()) throw new Error("no translation");
    return out.trim();
  },
  ["video-title-sq-v1"],
  { revalidate: 30 * 86_400 }
);

/** Titles in Albanian, in order; the originals where the translator fails. */
async function inAlbanian(titles: string[]) {
  const out: string[] = [];
  const until = Date.now() + 45_000;
  let warned = false;
  // One after another: the free tier throttles parallel calls.
  for (const title of titles) {
    if (Date.now() > until) {
      out.push(title);
      continue;
    }
    try {
      out.push(await titleInAlbanian(title));
    } catch (error) {
      if (!warned) console.warn("[video-feed] title translation failed; keeping originals where it fails", error);
      warned = true;
      out.push(title);
    }
  }
  return out;
}

async function buildFeed(): Promise<FeedVideo[]> {
  const now = Date.now();
  const [lists, stories] = await Promise.all([
    Promise.all(VIDEO_CHANNELS.map((c) => channelUploads(c, now))),
    getVideoArticles({ sinceDays: 14, limit: 60 }).catch(() => []),
  ]);
  const candidates = lists
    .flat()
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, MAX_VIDEOS + 12);
  const ok = await Promise.all(candidates.map((v) => embeddable(v.videoId)));
  const videos = candidates.filter((_, i) => ok[i]).slice(0, MAX_VIDEOS);

  const storyOf = new Map<string, string>();
  for (const a of stories) {
    const id = youtubeIdOf(a.videoClipUrl);
    if (id && !storyOf.has(id)) storyOf.set(id, a.slug);
  }
  const titles = await inAlbanian(videos.map((v) => v.title));
  return videos.map((v, i) => ({ ...v, title: titles[i] ?? v.title, storySlug: storyOf.get(v.videoId) ?? null }));
}

const cachedFeed = unstable_cache(buildFeed, ["video-feed-v1"], { revalidate: 900, tags: ["video-feed"] });

/** The newest official videos, newest first; [] when every feed is unreachable. */
export async function getVideoFeed(): Promise<FeedVideo[]> {
  try {
    return await cachedFeed();
  } catch (error) {
    console.error("[video-feed] unavailable", error);
    return [];
  }
}

/** One section's videos from the feed. */
export async function getSectionVideos(category: string): Promise<FeedVideo[]> {
  return (await getVideoFeed()).filter((v) => v.category === category);
}

/**
 * True for a video key ("video-…", lib/video-key) whose video is in the feed
 * now — what reactions and comments accept besides a story's slug.
 */
export async function isKnownVideoKey(key: unknown): Promise<boolean> {
  if (typeof key !== "string" || !key.startsWith("video-")) return false;
  return (await getVideoFeed()).some((v) => v.key === key);
}

/** The order the homepage row takes sections in, one video each per round. */
const HOME_ORDER: NavCategory[] = ["Kosovë", "Shqipëri", "Botë", "Sport", "Teknologji", "Ekonomi", "Showbiz"];

/**
 * The homepage row: newest first within each section, the sections taken in
 * turn, so the busiest channels (football posts most) cannot fill it alone.
 */
export function mixForHome(feed: FeedVideo[]): FeedVideo[] {
  const queues = HOME_ORDER.map((c) => feed.filter((v) => v.category === c));
  const out: FeedVideo[] = [];
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) out.push(q.shift() as FeedVideo);
  return out;
}
