// What Dardani remembers about one reader, and the questions he offers them.
//
// Device-only, like the rest of "Për ty": nothing here is sent anywhere. Two
// kinds of memory feed the suggestions:
//
//   1. What the reader follows and reads — their "Për ty" interests and the
//      learned reading affinity in lib/interests.mjs.
//   2. What they ask Dardani. Each question's people and cities are folded into
//      that same affinity (lib/interests.mjs recordRead), so asking about Vedat
//      Muriqi lifts Muriqi stories in "Për ty" as well as in the suggestions.
//      The questions themselves are kept too, last first, so the overlay can
//      offer "Pyete sërish" and never suggests one already asked.
//
// Suggestions are built from today's published articles, never generated: a
// suggestion that is not about an article in the archive would walk the reader
// straight into "Nuk kam artikull për këtë".

import { rankFeed, articleKeys } from "./per-ty-rank.mjs";
import { personById } from "./people.mjs";
import { cityById } from "./cities.mjs";

export const MEMORY_KEY = "383:dardani-memory";
const MEMORY_VERSION = 1;
const MAX_ASKED = 20;

/** @typedef {{ q: string, t: string }} Asked */
/** @typedef {{ v: number, asked: Asked[] }} Memory */
/** @typedef {{ label: string, question: string, reason?: string }} Suggestion */

/** @returns {Memory} */
function emptyMemory() {
  return { v: MEMORY_VERSION, asked: [] };
}

/** Coerce anything into a valid memory. Stored data is untrusted. */
export function normalizeMemory(raw) {
  if (!raw || typeof raw !== "object" || raw.v !== MEMORY_VERSION) return emptyMemory();
  const asked = [];
  for (const entry of Array.isArray(raw.asked) ? raw.asked : []) {
    const q = typeof entry?.q === "string" ? entry.q.trim().slice(0, 280) : "";
    const t = typeof entry?.t === "string" && Number.isFinite(Date.parse(entry.t)) ? entry.t : null;
    if (q && t && !asked.some((a) => a.q === q)) asked.push({ q, t });
  }
  return { v: MEMORY_VERSION, asked: asked.slice(0, MAX_ASKED) };
}

/** Remember one question, newest first. Returns a new memory. */
export function recordQuestion(memory, question, now = Date.now()) {
  const safe = normalizeMemory(memory);
  const q = String(question ?? "").trim().slice(0, 280);
  if (!q) return safe;
  const asked = [{ q, t: new Date(now).toISOString() }, ...safe.asked.filter((a) => a.q !== q)];
  return { v: MEMORY_VERSION, asked: asked.slice(0, MAX_ASKED) };
}

/** The people and cities a question names, as affinity keys ("person:…", "city:…"). */
export function questionKeys(question) {
  return articleKeys({ title: String(question ?? ""), excerpt: "" }).filter((k) => !k.startsWith("cat:"));
}

function shorten(title, max = 56) {
  const t = String(title ?? "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
}

/**
 * Starter questions for this reader, from today's articles.
 *
 * Ranked with the same rules as their "Për ty" feed (followed people first,
 * then cities, then categories, then what they read and ask about), so the
 * suggestions and the feed never disagree about what this reader cares about.
 * Returns [] when nothing personal matches — the caller then falls back to
 * the general openers.
 *
 * @param {readonly any[]} pool       recent articles: slug, title, excerpt, category, city, publishedAt
 * @param {unknown} interests         the reader's stored interests (untrusted)
 * @param {unknown} memory            the reader's stored Dardani memory (untrusted)
 * @returns {Suggestion[]}
 */
export function personalStarters(pool, interests, memory, limit = 3, now = Date.now()) {
  const asked = new Set(normalizeMemory(memory).asked.map((a) => a.q));
  const ranked = rankFeed(pool ?? [], interests, { now, limit: 30, topCount: 0 });
  const out = [];
  for (const { article, reason, kind } of ranked) {
    if (out.length >= limit) break;
    const title = String(article?.title ?? "").trim();
    if (title.length < 12) continue;
    let label = shorten(title);
    let question = `Pse ndodhi kjo: ${title}`;
    if (kind === "person") {
      const name = reason.replace(/^Sepse ndjek /, "");
      label = `${name}: ${shorten(title, 44)}`;
      question = `Çfarë ndodhi me ${name}? ${title}`;
    } else if (kind === "city") {
      label = `${reason}: ${shorten(title, 44)}`;
    }
    if (asked.has(question)) continue;
    out.push({ label, question, reason });
  }
  return out;
}

/**
 * Extra questions for one article, when it touches what the reader follows:
 * a person they follow is in it, or it is about their city. Offered first,
 * because they are the angle this reader is most likely to want.
 *
 * @param {{ title: string, excerpt?: string, category?: string, city?: string }} article
 * @param {unknown} interests
 * @returns {Suggestion[]}
 */
export function personalArticleQuestions(article, interests) {
  const safe = interests && typeof interests === "object" ? interests : {};
  const followedPeople = new Set(Array.isArray(safe.people) ? safe.people : []);
  const followedCities = new Set(Array.isArray(safe.cities) ? safe.cities : []);
  const out = [];
  for (const key of articleKeys(article)) {
    const [type, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
    if (type === "person" && followedPeople.has(id)) {
      const name = personById(id)?.name;
      if (name) {
        out.push({
          label: `Çfarë roli ka ${name} këtu?`,
          question: `Çfarë roli ka ${name} në këtë ngjarje?`,
          reason: `Sepse ndjek ${name}`,
        });
      }
    } else if (type === "city" && followedCities.has(id)) {
      const city = cityById(id);
      if (city) {
        out.push({
          label: `Çfarë do të thotë për ${city.name}?`,
          question: `Çfarë do të thotë kjo për ${city.name}?`,
          reason: city.from,
        });
      }
    }
  }
  return out.slice(0, 2);
}
