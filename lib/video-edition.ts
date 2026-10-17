import { unstable_cache } from "next/cache";
import { getCategoryColor } from "@/lib/category-colors";

/**
 * 383's video edition: today's top stories as short clips, each voiced in
 * Albanian with the time of every word (scripts/video_edition.py on the VPS
 * writes it to the public storage file video-edition/index.json, every hour).
 * The edition is finite on purpose: seven clips, about three minutes, and
 * then the reader is caught up.
 */

export type EditionWord = [start: number, end: number, text: string];

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
  return url.replace(/\/(\d{3,4})px-([^/]+)$/, (m, w, name) => (Number(w) > 1280 ? `/1280px-${name}` : m)).replace(/\?utm_[^#]*$/, "");
}

function parseWords(v: unknown): EditionWord[] {
  if (!Array.isArray(v)) return [];
  const out: EditionWord[] = [];
  for (const w of v) {
    if (Array.isArray(w) && typeof w[0] === "number" && typeof w[1] === "number" && typeof w[2] === "string" && w[2]) {
      out.push([w[0], w[1], w[2]]);
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
  // The voices sit beside the index.
  const audioBase = indexUrl().replace(/index\.json$/, "");
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
  ["video-edition-v1"],
  { revalidate: 300 }
);

/** Today's edition, or null (none yet today, or storage unreachable). */
export async function getEdition(): Promise<Edition | null> {
  return parseEdition(await readEdition());
}
