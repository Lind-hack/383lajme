/**
 * F1 sources, and the events in them that actually move a race market.
 *
 * The Tregu repricer moves a market only on articles 383 has itself published
 * and verified - headlines are discovery, never evidence. That rule is right
 * for a Kosovo news market and wrong for Formula 1, because 383 publishes F1
 * perhaps once a fortnight. So the odds could only ever react to a grid penalty
 * once OpenF1 published the grid sheet, which is hours after the paddock knew.
 *
 * This module is the narrow exception, and it stays narrow on purpose. It reads
 * a fixed list of motorsport publishers, and it is allowed to extract exactly
 * one class of thing: a structural fact about who is starting where. Not
 * opinion, not preview pieces, not "could", not a rumour of a penalty - a
 * decision that has been taken. Everything softer stays out, because the softer
 * it is the more a language model will invent it.
 *
 * Two independent publishers are required before an event is applied, which is
 * the same bar the dossier pipeline and the football repricer already hold. A
 * single publisher is returned as pending so a run can report what it saw
 * without acting on it.
 */

/** Vetted motorsport publishers. Host to display name; anything else is ignored. */
export const F1_PUBLISHERS = {
  "formula1.com": "Formula 1",
  "autosport.com": "Autosport",
  "motorsport.com": "Motorsport.com",
  "the-race.com": "The Race",
  "racefans.net": "RaceFans",
  "bbc.co.uk": "BBC Sport",
  "bbci.co.uk": "BBC Sport",
  "bbc.com": "BBC Sport",
  "skysports.com": "Sky Sports",
  "espn.com": "ESPN",
  "fia.com": "FIA",
};

export const F1_FEEDS = [
  "https://www.formula1.com/content/fom-website/en/latest/all.xml",
  "https://www.autosport.com/rss/f1/news/",
  "https://www.motorsport.com/rss/f1/news/",
  "https://the-race.com/category/formula-1/feed/",
  "https://www.racefans.net/feed/",
  "https://feeds.bbci.co.uk/sport/formula1/rss.xml",
];

const DEFAULT_MAX_AGE_MIN = 36 * 60;

function decodeEntities(text) {
  return String(text ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The publisher behind a url, or null when it is not one we accept. */
export function publisherOfUrl(url) {
  let host;
  try {
    host = new URL(String(url ?? "")).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  const match = Object.keys(F1_PUBLISHERS).find((known) => host === known || host.endsWith("." + known));
  return match ? F1_PUBLISHERS[match] : null;
}

/** Items out of one RSS/Atom document, allowlisted publishers only. */
export function parseF1Feed(xml, { now = Date.now(), maxAgeMin = DEFAULT_MAX_AGE_MIN } = {}) {
  const out = [];
  const blocks = String(xml ?? "").match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g) ?? [];
  for (const block of blocks) {
    const title = decodeEntities(block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const link =
      decodeEntities(block.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1] ?? "") ||
      decodeEntities(block.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "") ||
      decodeEntities(block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] ?? "");
    const summary = decodeEntities(
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] ??
        block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] ??
        ""
    );
    const dateRaw = block.match(/<(pubDate|updated|published)[^>]*>([\s\S]*?)<\/\1>/)?.[2] ?? "";
    const publisher = publisherOfUrl(link);
    if (!title || !publisher) continue;
    const ts = Date.parse(dateRaw);
    const ageMin = Number.isFinite(ts) ? Math.max(0, Math.round((now - ts) / 60000)) : null;
    if (ageMin !== null && ageMin > maxAgeMin) continue;
    out.push({
      title,
      url: link,
      publisher,
      summary: summary.slice(0, 400),
      ageMin,
      published_at: Number.isFinite(ts) ? new Date(ts).toISOString() : null,
    });
  }
  return out;
}

/** Every allowlisted headline across the feeds. One dead feed never fails the run. */
export async function fetchF1Headlines({
  now = Date.now(),
  maxAgeMin = DEFAULT_MAX_AGE_MIN,
  feeds = F1_FEEDS,
  fetchImpl = fetch,
  timeoutMs = 8000,
} = {}) {
  const seen = new Set();
  const headlines = [];
  const failures = [];
  for (const feed of feeds) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetchImpl(feed, { signal: controller.signal, headers: { "User-Agent": "383-f1-odds/1.0" } });
      clearTimeout(timer);
      if (!response.ok) {
        failures.push({ feed, status: response.status });
        continue;
      }
      for (const item of parseF1Feed(await response.text(), { now, maxAgeMin })) {
        const dedupe = item.url || item.title;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        headlines.push(item);
      }
    } catch (error) {
      failures.push({ feed, error: String(error instanceof Error ? error.message : error) });
    }
  }
  headlines.sort((a, b) => (a.ageMin ?? 1e9) - (b.ageMin ?? 1e9));
  return { headlines, failures, publishers: [...new Set(headlines.map((item) => item.publisher))] };
}

/**
 * Only three shapes of fact are allowed through, because only these three are
 * unambiguous enough to read out of a headline without inventing the rest of
 * the sentence.
 */
export const STRUCTURAL_EVENTS = ["grid_penalty", "withdrawal", "disqualification"];

const SYSTEM = [
  "You extract verified Formula 1 grid facts for a prediction market. Read ONLY the numbered articles given.",
  "Return a fact ONLY when the article states a decision that HAS been taken about a named driver for the UPCOMING race.",
  "Never return a fact for something described as possible, expected, under investigation, rumoured, or a risk.",
  "event must be one of: grid_penalty, withdrawal, disqualification.",
  "grid_penalty requires an explicit number of grid places in the text; if no number is stated, do not return the event.",
  "Use the exact three-letter driver code from the roster you are given. Never invent a code.",
  "cited must list the indices of every article that states the fact.",
  'Return ONLY JSON: {"events":[{"driver":"ABC","event":"grid_penalty","places":10,"reason":"short reason","cited":[0,3]}]}',
].join(" ");

/**
 * Headlines in, applicable penalties out - in the exact shape
 * buildF1RaceWinnerOpeningModel takes as its penalties argument.
 *
 * applied holds the events two independent publishers agree on. pending holds
 * single-publisher events, reported so a run can say what it saw without moving
 * a price on one outlet's word.
 */
export async function extractF1Penalties({ headlines = [], roster = [], now = new Date(), llm, minPublishers = 2 } = {}) {
  const codes = new Set(
    roster.map((driver) => String(driver?.key ?? driver?.driver_code ?? "").toUpperCase()).filter(Boolean)
  );
  if (!headlines.length || !codes.size || typeof llm !== "function") {
    return {
      applied: {},
      pending: [],
      considered: headlines.length,
      reason: !headlines.length ? "no_headlines" : !codes.size ? "no_roster" : "no_llm",
    };
  }

  const numbered = headlines.slice(0, 40);
  const user = [
    "Current UTC time: " + new Date(now).toISOString(),
    "Driver codes in this race: " + [...codes].join(", "),
    "",
    "Articles:",
    ...numbered.map((item, index) => "[" + index + "] (" + item.publisher + ") " + item.title + (item.summary ? " - " + item.summary : "")),
  ].join("\n");

  let parsed;
  try {
    parsed = await llm(SYSTEM, user);
  } catch (error) {
    return {
      applied: {},
      pending: [],
      considered: numbered.length,
      reason: "llm_failed",
      error: String(error instanceof Error ? error.message : error),
    };
  }

  const applied = {};
  const pending = [];
  for (const event of Array.isArray(parsed?.events) ? parsed.events : []) {
    const driver = String(event?.driver ?? "").toUpperCase().trim();
    const kind = String(event?.event ?? "").trim();
    if (!codes.has(driver) || !STRUCTURAL_EVENTS.includes(kind)) continue;

    const cited = (Array.isArray(event?.cited) ? event.cited : []).map((index) => numbered[Number(index)]).filter(Boolean);
    const publishers = [...new Set(cited.map((item) => item.publisher))];
    const places = Number(event?.places);
    // A grid penalty without a stated number of places is not a fact we can price.
    if (kind === "grid_penalty" && (!Number.isFinite(places) || places <= 0)) continue;

    const record = {
      driver,
      event: kind,
      ...(kind === "grid_penalty" ? { grid_penalty_places: Math.min(30, Math.round(places)) } : { status: "out" }),
      reason: String(event?.reason ?? kind).slice(0, 160),
      source: cited[0]?.url ?? null,
      publishers,
      cited_urls: cited.map((item) => item.url).filter(Boolean),
    };

    if (publishers.length >= minPublishers) {
      applied[driver] = record;
    } else {
      pending.push({ ...record, held_because: "one_publisher" });
    }
  }

  return { applied, pending, considered: numbered.length, reason: null };
}

/**
 * The softer half: pace, reliability, and what the paddock is saying.
 *
 * Practice times, a driver complaining about balance on the radio, an engineer
 * hedging in a press conference — none of it is a fact about the grid, and none
 * of it belongs anywhere near the structural release in 0068. It is also
 * genuinely informative, and a market that ignores it until qualifying is
 * slower than the people trading on it.
 *
 * So it gets its own narrow channel with three properties. The verdict is a
 * single bounded number per driver rather than free text. It feeds a factor
 * that can move a driver's raw value by at most a fifth either way, so it can
 * never outrank where they are starting from. And because these drivers are
 * never named as structural, every move it produces is still clamped by the
 * ordinary five-point cap on its way into the book.
 */
const SIGNAL_SYSTEM = [
  "You read Formula 1 practice and paddock coverage for a prediction market.",
  "For each driver clearly discussed, return how the coverage shifts their chance of winning the UPCOMING race.",
  "delta is a number from -1 to 1: -1 much worse than expected, 0 neutral, 1 much better than expected.",
  "Base it only on pace in practice, reliability, setup problems, damage, illness, or direct quotes from the driver or team.",
  "Do not use championship position, reputation, or past seasons. Do not report a driver the articles do not discuss.",
  "Use the exact three-letter driver code from the roster given. Never invent a code.",
  "cited must list the indices of every article supporting the judgement.",
  'Return ONLY JSON: {"signals":[{"driver":"ABC","delta":-0.4,"reason":"short reason","cited":[1,2]}]}',
].join(" ");

/**
 * Soft per-driver adjustments, in the shape buildF1RaceWinnerOpeningModel takes
 * as its `signals` argument. Same two-publisher bar as the structural path:
 * these are the most inventable claims on the page, so one outlet's framing is
 * never enough to move money.
 */
export async function extractF1Signals({ headlines = [], roster = [], now = new Date(), llm, minPublishers = 2 } = {}) {
  const codes = new Set(
    roster.map((driver) => String(driver?.key ?? driver?.driver_code ?? "").toUpperCase()).filter(Boolean)
  );
  if (!headlines.length || !codes.size || typeof llm !== "function") {
    return { applied: {}, pending: [], considered: headlines.length, reason: !headlines.length ? "no_headlines" : !codes.size ? "no_roster" : "no_llm" };
  }

  const numbered = headlines.slice(0, 40);
  const user = [
    "Current UTC time: " + new Date(now).toISOString(),
    "Driver codes in this race: " + [...codes].join(", "),
    "",
    "Articles:",
    ...numbered.map((item, index) => "[" + index + "] (" + item.publisher + ") " + item.title + (item.summary ? " - " + item.summary : "")),
  ].join("\n");

  let parsed;
  try {
    parsed = await llm(SIGNAL_SYSTEM, user);
  } catch (error) {
    return { applied: {}, pending: [], considered: numbered.length, reason: "llm_failed", error: String(error instanceof Error ? error.message : error) };
  }

  const applied = {};
  const pending = [];
  for (const signal of Array.isArray(parsed?.signals) ? parsed.signals : []) {
    const driver = String(signal?.driver ?? "").toUpperCase().trim();
    const raw = Number(signal?.delta);
    if (!codes.has(driver) || !Number.isFinite(raw)) continue;
    const delta = Math.max(-1, Math.min(1, raw));
    if (delta === 0) continue;

    const cited = (Array.isArray(signal?.cited) ? signal.cited : []).map((index) => numbered[Number(index)]).filter(Boolean);
    const publishers = [...new Set(cited.map((item) => item.publisher))];
    const record = {
      driver,
      delta,
      reason: String(signal?.reason ?? "").slice(0, 160),
      source: cited[0]?.url ?? null,
      publishers,
      cited_urls: cited.map((item) => item.url).filter(Boolean),
    };
    if (publishers.length >= minPublishers) applied[driver] = record;
    else pending.push({ ...record, held_because: "one_publisher" });
  }

  return { applied, pending, considered: numbered.length, reason: null };
}
