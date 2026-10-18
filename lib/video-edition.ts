import { unstable_cache } from "next/cache";
import { getCategoryColor } from "@/lib/category-colors";

/**
 * 383's video edition: today's top stories as short clips, each voiced in
 * Albanian with the time of every word (scripts/video_edition.py on the VPS
 * writes it to the public storage file video-edition/index.json, every hour).
 * The edition is finite on purpose: seven clips, about three minutes, and
 * then the reader is caught up.
 */

/** A word as it is said; `pause` is 1 where the script has a comma or a stop after it. */
export type EditionWord = [start: number, end: number, text: string, pause?: number];

/** What is on screen from `at` seconds until the next beat. */
export type EditionBeat =
  | { at: number; kind: "photo"; src: string; credit: string; move: "in" | "out" | "left" | "right" }
  | { at: number; kind: "fact"; value: string; label: string }
  | { at: number; kind: "quote"; text: string; who: string }
  | { at: number; kind: "map"; src: string; label: string; credit: string }
  /** Moving picture: in a rendered clip it is in the video itself (youtube "" when it came from elsewhere); in an older clip, YouTube's player. */
  | { at: number; kind: "video"; youtube: string; channel: string; start: number; credit: string }
  | { at: number; kind: "plain" };

export type EditionClip = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  /** The section's colour. */
  color: string;
  publishedAt: string;
  /** The story's own photo (sized for a phone), or "". */
  image: string;
  imageCreator: string;
  imageLicense: string;
  imageSourcePage: string;
  /** What the voice says. */
  script: string;
  /** The voice, or "" when it could not be made (the words are shown alone). */
  audio: string;
  /** Seconds. */
  duration: number;
  words: EditionWord[];
  /** The pictures, changing every few seconds; [] for a clip made before beats (the story's photo alone). */
  beats: EditionBeat[];
  /** The finished clip as a video (voice, music, sound, pictures and words in one file), or null:
   * then the voice plays over the beats drawn in the page. hd is 1080x1920, sd 720x1280; thumb
   * (540x960, the clip's strongest picture with its cover line) is what the row shows, "" if none. */
  video: { hd: string; sd: string; poster: string; thumb: string } | null;
  /** What people in Kosovo/Albania searched today that this story is about ("" if not trending). */
  trend: string;
};

export type Edition = {
  /** Kosovo's date, YYYY-MM-DD. */
  date: string;
  updatedAt: string;
  clips: EditionClip[];
};

/** An edition older than this is not today's: the row hides rather than show yesterday as news. */
const STALE_MS = 20 * 60 * 60 * 1000;

function storageBase() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://supabase.383ks.com").replace(/\/$/, "");
}

function indexUrl() {
  return process.env.VIDEO_EDITION_URL || `${storageBase()}/storage/v1/object/public/video-edition/index.json`;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Commons serves standard thumbnail widths; 1280 fills an upright phone screen. */
function sized(url: string) {
  return url.replace(/\?utm_[^#]*$/, "").replace(/\/(\d{3,4})px-([^/]+)$/, (m, w, name) => (Number(w) > 1280 ? `/1280px-${name}` : m));
}

const MOVES = new Set(["in", "out", "left", "right"]);

/** Each beat checked: pictures only over https, footage only as a YouTube id (or, in a rendered clip, already in the video). */
function parseBeats(v: unknown, duration: number, rendered: boolean): EditionBeat[] {
  if (!Array.isArray(v)) return [];
  const out: EditionBeat[] = [];
  for (const b of v as Record<string, unknown>[]) {
    const at = typeof b?.at === "number" && b.at >= 0 && b.at < duration ? b.at : -1;
    if (at < 0 || (out.length && at <= out[out.length - 1].at)) continue;
    const src = str(b?.src);
    if (b?.kind === "photo" && /^https:\/\//.test(src)) {
      out.push({ at, kind: "photo", src: sized(src), credit: str(b?.credit).slice(0, 120), move: (MOVES.has(str(b?.move)) ? str(b?.move) : "in") as "in" });
    } else if (b?.kind === "fact" && str(b?.value) && str(b?.label)) {
      out.push({ at, kind: "fact", value: str(b?.value).slice(0, 18), label: str(b?.label).slice(0, 80) });
    } else if (b?.kind === "quote" && str(b?.text) && str(b?.who)) {
      out.push({ at, kind: "quote", text: str(b?.text).slice(0, 180), who: str(b?.who).slice(0, 60) });
    } else if (b?.kind === "map" && /^https:\/\//.test(src)) {
      out.push({ at, kind: "map", src, label: str(b?.label).slice(0, 40), credit: str(b?.credit).slice(0, 40) });
    } else if (b?.kind === "video" && (/^[A-Za-z0-9_-]{11}$/.test(str(b?.youtube)) || (rendered && str(b?.credit)))) {
      const youtube = /^[A-Za-z0-9_-]{11}$/.test(str(b?.youtube)) ? str(b?.youtube) : "";
      const channel = str(b?.channel).slice(0, 80);
      out.push({ at, kind: "video", youtube, channel, start: typeof b?.start === "number" ? Math.max(0, Math.floor(b.start)) : 0, credit: str(b?.credit).slice(0, 120) || (channel ? `Video: ${channel} · YouTube` : "") });
    } else if (b?.kind === "plain") {
      out.push({ at, kind: "plain" });
    }
  }
  return out[0]?.at === 0 ? out : [];
}

/** A rendered clip's files, only from our own storage. */
function parseVideo(v: unknown, base: string): EditionClip["video"] {
  const o = v as Record<string, unknown> | null;
  const hd = str(o?.hd);
  const sd = str(o?.sd);
  const poster = str(o?.poster);
  const thumb = str(o?.thumb);
  if (![hd, sd, poster].every((u) => u.startsWith(base))) return null;
  return { hd, sd, poster, thumb: thumb.startsWith(base) ? thumb : "" };
}

function parseWords(v: unknown): EditionWord[] {
  if (!Array.isArray(v)) return [];
  const out: EditionWord[] = [];
  for (const w of v) {
    if (Array.isArray(w) && typeof w[0] === "number" && typeof w[1] === "number" && typeof w[2] === "string" && w[2]) {
      out.push([w[0], w[1], w[2], w[3] === 1 ? 1 : 0]);
    }
  }
  return out;
}

/** The stored file as an edition, every field checked: it is written elsewhere and may predate this code. */
export function parseEdition(raw: unknown, now = Date.now()): Edition | null {
  const data = raw as Record<string, unknown> | null;
  if (!data || typeof data !== "object" || !Array.isArray(data?.clips)) return null;
  const updatedAt = str(data?.updatedAt);
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t) || now - t > STALE_MS) return null;
  // The voices and the videos sit beside the index.
  const audioBase = indexUrl().replace(/[^/]+$/, "");
  const clips: EditionClip[] = [];
  for (const c of data.clips as Record<string, unknown>[]) {
    const slug = str(c?.slug);
    const title = str(c?.title);
    if (!/^[a-z0-9-]{3,160}$/.test(slug) || !title) continue;
    const audio = str(c?.audio);
    const image = str(c?.image);
    const category = str(c?.category);
    const duration = typeof c?.duration === "number" && c.duration > 0 ? Math.min(c.duration, 180) : 0;
    if (!duration) continue;
    const video = parseVideo(c?.video, audioBase);
    clips.push({
      slug,
      title,
      excerpt: str(c?.excerpt),
      category,
      color: getCategoryColor(category),
      publishedAt: str(c?.publishedAt),
      image: /^https:\/\//.test(image) ? sized(image) : "",
      imageCreator: str(c?.imageCreator).slice(0, 80),
      imageLicense: str(c?.imageLicense).slice(0, 40),
      imageSourcePage: /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(str(c?.imageSourcePage)) ? str(c?.imageSourcePage) : "",
      script: str(c?.script),
      // Only our own storage plays here.
      audio: audio.startsWith(audioBase) ? audio : "",
      duration,
      words: parseWords(c?.words),
      beats: parseBeats(c?.beats, duration, Boolean(video)),
      video,
      trend: str(c?.trend).slice(0, 60),
    });
  }
  return clips.length ? { date: str(data?.date), updatedAt, clips } : null;
}

const readEdition = unstable_cache(
  async (): Promise<unknown> => {
    try {
      const res = await fetch(indexUrl(), { signal: AbortSignal.timeout(6000), cache: "no-store" });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  },
  ["video-edition-v3"],
  { revalidate: 300 }
);

/** Today's edition, or null (none yet today, or storage unreachable). */
export async function getEdition(): Promise<Edition | null> {
  return parseEdition(await readEdition());
}
