// "Shkurt": two or three sentences under every story in Për ty, in Dardani's
// voice, so a reader knows what happened without opening the article.
//
// Written once per story, never per reader, once a day: in the SUMMARY_HOUR
// (06:00 Kosovo time, done before the 07:00 morning push) lib/story-summary-server.ts
// works through every story of the week that has no summary yet, a batch per
// two-minute heartbeat, and keeps the results in one small index.json in a
// public bucket. Every reader's page reads the same index. Each reader's seven
// are put together on their own device, so the server summarises every story
// that could be in anyone's edition, not one list per reader.
//
// Pure. The promises that make a model's words safe to show, held by the tests:
//
//   1. Only what the story says. A number in the summary must be in the story;
//      so must every name (by its stem, so Albanian endings still match:
//      "Kurtit" is "Kurti"). A summary that fails is not shown: the story's
//      own first sentences stand in for it, marked as such.
//   2. Short and whole: two or three sentences, at most MAX_WORDS words.
//   3. No dashes. A dash between clauses is the mark of machine-written text;
//      it becomes a comma (noDashes), and the model is told not to use one.

export const SUMMARY_BUCKET = "perty-summaries";
export const INDEX_PATH = "index.json";
/** Bumped when the prompt or checks change: an older index's summaries are dropped and written again. */
export const INDEX_VERSION = 2;
/** Stories summarised per heartbeat run, in one model call. */
export const PER_RUN = 6;
/** The Kosovo hour the day's summaries are written in: before the 07:00 push. */
export const SUMMARY_HOUR = 6;
/** Only stories this fresh are summarised; Për ty looks back a week. */
export const FRESH_MS = 7 * 24 * 60 * 60 * 1000;
/** Summaries older than this drop out of the index. */
const KEEP_MS = 9 * 24 * 60 * 60 * 1000;
const MAX_ITEMS = 700;

export const MIN_WORDS = 14;
export const MAX_WORDS = 70;
const MAX_SENTENCES = 3;
const SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/i;

export const SUMMARY_SYSTEM = [
  "Je Dardani, redaktori i 383. I flet lexuesit si një mik që i ka lexuar lajmet para tij: ngrohtë, qartë, shqip standard.",
  "Për çdo lajm shkruaj 2 fjali të shkurtra (3 vetëm kur lajmi ka shumë fakte): çfarë ndodhi, kush e bëri dhe faktet kryesore.",
  "Rregulla:",
  "- Përdor VETËM faktet e lajmit. Asnjë numër, emër apo datë që nuk është në tekst.",
  "- Kush bëri çfarë duhet të jetë saktësisht si në lajm: mos e bëj pjesëmarrësin vepruesin.",
  "- Asnjë koment, vlerësim apo përfundim yti. Mos shkruaj fjali si 'Ky hap synon…', 'Kjo tregon…', 'Për lexuesit…', 'Kjo do të…'. Pse ka rëndësi e thua vetëm nëse lajmi vetë e thotë.",
  "- Lexuesi duhet ta kuptojë lajmin pa e hapur artikullin.",
  "- Mos përsërit titullin fjalë për fjalë.",
  "- Mos përdor viza (— – -) për të ndarë fjalitë. Përdor pikë ose presje.",
  "- Pa pikëpyetje retorike, pa emoji, pa thonjëza të gjata.",
  "- Gjithsej më pak se 60 fjalë për lajm.",
  'Kthe JSON: {"summaries":[{"slug":"...","text":"..."}]}',
].join("\n");

/** Dashes between words become commas; a dash at the start of a line goes. */
export function noDashes(text) {
  return String(text ?? "")
    .replace(/^\s*[-–—]+\s*/gm, "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/,\s*([.,!?;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const wordsOf = (s) => String(s ?? "").trim().split(/\s+/).filter(Boolean);

/** Numbers written in digits, normalised: "2.500" and "2,500" and "2500" are one. */
function numbersIn(text) {
  const out = new Set();
  for (const m of String(text ?? "").matchAll(/\d[\d.,]*\d|\d/g)) {
    out.add(m[0].replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", "."));
  }
  return out;
}

const stem = (w) => w.toLowerCase().normalize("NFC").slice(0, 5);

/** The stems of every word in the story. */
function stemsIn(text) {
  return new Set(
    String(text ?? "")
      .normalize("NFC")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3)
      .map(stem)
  );
}

/**
 * Names in the summary: capitalised words that do not open a sentence. A word
 * opening a sentence may be an ordinary word ("Qeveria", "Sot"), so it is not
 * held to the story's text.
 */
function namesIn(text) {
  const names = [];
  for (const sentence of String(text ?? "").split(/(?<=[.!?…])\s+/)) {
    const words = sentence.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    words.slice(1).forEach((w) => {
      if (w.length >= 3 && /^\p{Lu}/u.test(w)) names.push(w);
    });
  }
  return names;
}

/**
 * A sentence of the model's own commentary rather than the story's facts:
 * "Ky hap synon…", "Kjo tregon…", "Për lexuesit…". Models close with one even
 * when told not to, and it is where they invent; it is dropped.
 */
const COMMENTARY = /^(ky hap|ky lajm|ky vendim|ky program|ky dialog|kjo tregon|kjo do të|kjo është një|kjo nënvizon|kjo thekson|kjo ndikon|kjo sjell|kjo mund|për lexuesit|për ty|në përgjithësi|si përfundim|me fjalë të tjera)(?![\p{L}])/iu;

/** The sentences of a text. */
function sentencesOf(text) {
  return String(text ?? "")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * A summary fit to show for this story, or null.
 *
 * @param {string} raw
 * @param {{ title?: string, excerpt?: string | null, body?: string | null }} article
 */
export function checkSummary(raw, article) {
  const text = sentencesOf(noDashes(String(raw ?? "").replace(/\s+/g, " ")))
    .filter((sentence) => !COMMENTARY.test(sentence))
    .join(" ");
  const count = wordsOf(text).length;
  if (count < MIN_WORDS || count > MAX_WORDS) return null;
  if (sentencesOf(text).length > MAX_SENTENCES) return null;
  if (/\?|[\u{1F300}-\u{1FAFF}]/u.test(text)) return null;
  const source = `${article?.title ?? ""} ${article?.excerpt ?? ""} ${article?.body ?? ""}`;
  const numbers = numbersIn(source);
  for (const n of numbersIn(text)) if (!numbers.has(n)) return null;
  const stems = stemsIn(source);
  for (const name of namesIn(text)) if (!stems.has(stem(name))) return null;
  return /[.!…]$/.test(text) ? text : `${text}.`;
}

/** The user message: the stories, each under its slug. */
export function buildSummaryPrompt(articles) {
  return articles
    .map((a) => {
      const body = String(a?.body ?? "").replace(/\s+/g, " ").slice(0, 1600);
      return [`slug: ${a.slug}`, `titulli: ${a.title}`, `përmbledhja: ${a.excerpt ?? ""}`, body && `teksti: ${body}`]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");
}

/**
 * The model's answer, checked: slug → summary, only for stories that were
 * given and only where the summary passes checkSummary.
 *
 * @param {unknown} raw  the model's parsed JSON
 * @param {readonly { slug: string, title?: string, excerpt?: string | null, body?: string | null }[]} articles
 * @returns {Map<string, string>}
 */
export function cleanSummaries(raw, articles) {
  const bySlug = new Map((articles ?? []).map((a) => [a.slug, a]));
  const out = new Map();
  for (const item of Array.isArray(raw?.summaries) ? raw.summaries : []) {
    const slug = typeof item?.slug === "string" ? item.slug.trim() : "";
    const article = bySlug.get(slug);
    if (!article || out.has(slug)) continue;
    const text = checkSummary(item?.text, article);
    if (text) out.set(slug, text);
  }
  return out;
}

/** A sentence sharing this much of its telling words with one already taken only restates it. */
const ECHO = 0.35;
/** A sentence that is mostly the headline again tells the reader nothing new. */
const TITLE_ECHO = 0.6;

/** How much of `a`'s telling words (by stem) are already in `b`. */
function overlap(a, b) {
  const telling = (s) => [...stemsIn(s)].filter((w) => w.length >= 4);
  const wa = telling(a);
  if (!wa.length) return 0;
  const wb = new Set(telling(b));
  return wa.filter((w) => wb.has(w)).length / wa.length;
}

/**
 * The story's own words when the model's are not usable: its first two
 * sentences that are not the headline, from the excerpt and then the body.
 * The body often opens by restating the excerpt; a sentence that mostly
 * repeats one already taken is passed over for the next.
 */
export function ownSummary(article) {
  const bare = (s) => String(s ?? "").trim().replace(/[.!…:]+$/, "").toLowerCase();
  const title = bare(article?.title);
  const picked = [];
  for (const s of [...sentencesOf(article?.excerpt), ...sentencesOf(String(article?.body ?? "").slice(0, 1500))]) {
    const clean = noDashes(s);
    if (wordsOf(clean).length < 5 || bare(clean) === title || overlap(clean, article?.title) >= TITLE_ECHO) continue;
    if (picked.some((p) => overlap(clean, p) >= ECHO)) continue;
    picked.push(clean);
    if (picked.length === 2 || wordsOf(picked.join(" ")).length >= 45) break;
  }
  return picked.join(" ");
}

// ── The index ───────────────────────────────────────────────────────────────

/** Anything at all in, a valid index out. */
export function normalizeIndex(raw) {
  const items = {};
  const src = raw && typeof raw === "object" && raw.items && typeof raw.items === "object" ? raw.items : {};
  for (const [slug, item] of Object.entries(src)) {
    if (!SLUG.test(slug) || typeof item?.t !== "string" || !item.t.trim()) continue;
    if (!Number.isFinite(Date.parse(item?.at ?? ""))) continue;
    items[slug] = { t: item.t, at: item.at, by: item.by === "own" ? "own" : "dardani" };
  }
  const last = typeof raw?.last === "string" && Number.isFinite(Date.parse(raw.last)) ? raw.last : null;
  // Written under an older prompt: start over, so every summary meets today's rules.
  if (raw?.v !== INDEX_VERSION) return { v: INDEX_VERSION, last: null, items: {} };
  return { v: INDEX_VERSION, last, items };
}

/** Whether summaries are written now: only in the SUMMARY_HOUR, Kosovo time. */
export function isSummaryHour(now = Date.now()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", hour: "numeric", hourCycle: "h23" }).format(new Date(now))
  );
  return hour === SUMMARY_HOUR;
}

/**
 * Stories to summarise this run: fresh, not yet in the index, newest first.
 *
 * @template {{ slug?: string, title?: string, publishedAt?: string }} A
 * @param {readonly A[]} recent
 * @param {ReturnType<typeof normalizeIndex>} index
 * @returns {A[]}
 */
export function pickStories(recent, index, { now = Date.now(), max = PER_RUN } = {}) {
  return [...(recent ?? [])]
    .filter((a) => a?.slug && SLUG.test(a.slug) && a.title && !index.items[a.slug])
    .filter((a) => {
      const t = Date.parse(a.publishedAt ?? "");
      return Number.isFinite(t) && now - t <= FRESH_MS;
    })
    .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""))
    .slice(0, max);
}

/**
 * The index with this run's summaries added, the run stamped, old entries
 * dropped and the size bounded (newest kept).
 *
 * @param {ReturnType<typeof normalizeIndex>} index
 * @param {readonly { slug: string, text: string, by: "dardani" | "own" }[]} made
 */
export function withSummaries(index, made, now = Date.now()) {
  const at = new Date(now).toISOString();
  const items = { ...index.items };
  for (const m of made ?? []) {
    if (m?.slug && SLUG.test(m.slug) && typeof m.text === "string" && m.text.trim()) {
      items[m.slug] = { t: m.text.trim(), at, by: m.by === "own" ? "own" : "dardani" };
    }
  }
  const kept = Object.entries(items)
    .filter(([, item]) => now - Date.parse(item.at) <= KEEP_MS)
    .sort((a, b) => Date.parse(b[1].at) - Date.parse(a[1].at))
    .slice(0, MAX_ITEMS);
  return { v: INDEX_VERSION, last: at, items: Object.fromEntries(kept) };
}

/** slug → { text, byDardani } for the pages. */
export function summaryMap(raw) {
  const index = normalizeIndex(raw);
  const out = {};
  for (const [slug, item] of Object.entries(index.items)) out[slug] = { text: item.t, byDardani: item.by === "dardani" };
  return out;
}
