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
  /** A viral clip from social media (the clip scout's), not a 383 story: whose it is and where it
   * was first posted. It has no article, so no reactions or comments; null for the edition's own. */
  source: { author: string; platform: string; link: string } | null;
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
      source: null,
    });
  }
  return clips.length ? { date: str(data?.date), updatedAt, clips } : null;
}

/** "Virale sot" before the first cuts: at most this many of the clip scout's single finds. */
const VIRAL_MAX = 8;
/** A find older than this has had its day. */
const VIRAL_MS = 24 * 60 * 60 * 1000;
const PLATFORMS: Record<string, string> = { tiktok: "TikTok", x: "X", instagram: "Instagram", youtube: "YouTube" };
const SOURCE_HOSTS = /^https:\/\/(www\.)?(tiktok\.com|x\.com|twitter\.com|instagram\.com|youtube\.com|youtu\.be)\//;

export function scoutBase() {
  return `${storageBase()}/storage/v1/object/public/clip-scout/`;
}

/** The scout's published finds (scripts/clip_scout.py writes clip-scout/published.json each run),
 * every field checked, without those the editor took down (removed.json, written by /api/virale/hiq). */
export function parseViral(raw: unknown, removed: unknown, now = Date.now()): EditionClip[] {
  const items = (raw as Record<string, unknown> | null)?.items;
  if (!Array.isArray(items)) return [];
  const gone = new Set(Array.isArray((removed as Record<string, unknown> | null)?.ids) ? ((removed as { ids: unknown[] }).ids.map(str)) : []);
  const base = scoutBase();
  const out: EditionClip[] = [];
  for (const c of items as Record<string, unknown>[]) {
    const id = str(c?.id);
    const file = str(c?.file);
    const thumb = str(c?.thumb);
    const link = str(c?.link);
    const title = str(c?.headline).slice(0, 140);
    const found = Date.parse(str(c?.found_at));
    const duration = typeof c?.duration === "number" && c.duration > 0 ? Math.min(c.duration, 180) : 0;
    if (!id || gone.has(id) || !title || !duration || !file.startsWith(base) || !SOURCE_HOSTS.test(link)) continue;
    if (!Number.isFinite(found) || now - found > VIRAL_MS) continue;
    const slug = `virale-${id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`.slice(0, 160);
    const poster = thumb.startsWith(base) ? thumb : "";
    out.push({
      slug,
      title,
      excerpt: str(c?.post_text).slice(0, 400),
      category: "Virale",
      color: "#FF4422",
      publishedAt: str(c?.created),
      image: "",
      imageCreator: "",
      imageLicense: "",
      imageSourcePage: "",
      script: str(c?.post_text) || title,
      audio: "",
      duration,
      words: [],
      beats: [],
      video: { hd: file, sd: file, poster, thumb: poster },
      trend: "",
      source: { author: str(c?.author).slice(0, 60), platform: PLATFORMS[str(c?.platform)] ?? "", link },
    });
    if (out.length === VIRAL_MAX) break;
  }
  return out;
}

/** "Virale sot" cuts (scripts/viral_cut.py through clip_scout.py, clip-scout/viral.json): the day's
 * stories re-cut into one video each, best first. */
const CUTS_MAX = 8;
const KINDS: Record<string, { label: string; color: string }> = {
  bbk: { label: "Big Brother", color: "#FF4422" },
  showbiz: { label: "Showbiz", color: "#E0457B" },
  sport: { label: "Sport", color: "#1E9E5A" },
  humor: { label: "Humor", color: "#E8A400" },
  lajme: { label: "Lajme", color: "#3A7BD5" },
};
const CUT_ID = /^cut:[0-9a-f]{16}$/;

export function parseCuts(raw: unknown, removed: unknown, now = Date.now()): EditionClip[] {
  const items = (raw as Record<string, unknown> | null)?.items;
  if (!Array.isArray(items)) return [];
  const gone = new Set(Array.isArray((removed as Record<string, unknown> | null)?.ids) ? ((removed as { ids: unknown[] }).ids.map(str)) : []);
  const base = scoutBase();
  const out: EditionClip[] = [];
  for (const c of items as Record<string, unknown>[]) {
    const id = str(c?.id);
    const file = str(c?.file);
    const sd = str(c?.sd);
    const thumb = str(c?.thumb);
    const title = str(c?.title).slice(0, 140);
    const made = Date.parse(str(c?.made_at));
    const duration = typeof c?.duration === "number" && c.duration > 0 ? Math.min(c.duration, 90) : 0;
    // Optional-chained: the file may predate a field.
    const sources = (Array.isArray(c?.sources) ? (c.sources as Record<string, unknown>[]) : [])
      .map((s) => ({ id: str(s?.id), author: str(s?.author).slice(0, 60), platform: PLATFORMS[str(s?.platform)] ?? "", link: str(s?.link) }))
      .filter((s) => SOURCE_HOSTS.test(s.link));
    if (!CUT_ID.test(id) || gone.has(id) || !title || !duration || !file.startsWith(base) || !sources.length) continue;
    if (sources.some((s) => gone.has(s.id))) continue;
    if (!Number.isFinite(made) || now - made > VIRAL_MS) continue;
    const kind = KINDS[str(c?.kind)] ?? KINDS.lajme;
    const poster = thumb.startsWith(base) ? thumb : "";
    out.push({
      slug: `virale-${id.replace(":", "-")}`,
      title,
      excerpt: str(c?.story).slice(0, 200),
      category: kind.label,
      color: kind.color,
      publishedAt: str(c?.made_at),
      image: "",
      imageCreator: "",
      imageLicense: "",
      imageSourcePage: "",
      script: title,
      audio: "",
      duration,
      words: [],
      beats: [],
      video: { hd: file, sd: sd.startsWith(base) ? sd : file, poster, thumb: poster },
      trend: "",
      source: { author: sources[0].author, platform: sources[0].platform, link: sources[0].link },
    });
    if (out.length === CUTS_MAX) break;
  }
  return out;
}

async function readJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const readEdition = unstable_cache(async (): Promise<unknown> => readJson(indexUrl()), ["video-edition-v3"], { revalidate: 300 });

/** Tagged so taking a find down (/api/virale/hiq) shows at once. The query keeps the storage CDN's copy from answering. */
export const VIRAL_TAG = "clip-scout";
const readViral = unstable_cache(
  async (): Promise<[unknown, unknown, unknown]> => {
    const v = Date.now();
    return Promise.all([
      readJson(`${scoutBase()}viral.json?v=${v}`),
      readJson(`${scoutBase()}published.json?v=${v}`),
      readJson(`${scoutBase()}removed.json?v=${v}`),
    ]);
  },
  ["clip-scout-v2"],
  { revalidate: 300, tags: [VIRAL_TAG] }
);

/** Today's edition (the day's stories), or null (none yet today, or storage unreachable). */
export async function getEdition(): Promise<Edition | null> {
  return parseEdition(await readEdition());
}

/** Kosovo's date, YYYY-MM-DD. */
function kosovoDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(now);
}

/** "Virale sot", the row beside the edition: today's cuts; until the first are made, the scout's
 * single finds as they were. Null with fewer than two. */
export async function getViral(): Promise<Edition | null> {
  const [viral, published, removed] = await readViral();
  const cuts = parseCuts(viral, removed);
  const clips = cuts.length >= 2 ? cuts : parseViral(published, removed);
  if (clips.length < 2) return null;
  const updatedAt = str((viral as Record<string, unknown> | null)?.updatedAt) || new Date().toISOString();
  return { date: kosovoDate(), updatedAt, clips };
}
