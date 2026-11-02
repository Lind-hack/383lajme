/**
 * Validating a drafted moment before anyone can see it.
 *
 * A reader takes a dated historical claim on trust — that is exactly why this
 * feature is worth having and exactly why it is dangerous. So nothing here asks
 * a model whether something is true. The model is handed a numbered list of
 * excerpts that were actually fetched, and may only point at them; every rule
 * below is deterministic code over that evidence.
 *
 * The rules, and the failure each one exists to prevent:
 *
 *   citations resolve          a fabricated source index
 *   two distinct publishers    one outlet repeating itself, or itself
 *   no encyclopaedia-only      a tertiary source standing in for reporting
 *   date is real and past      a confident invented date
 *   date agrees with sources   a real event moved to the wrong year
 *   every sentence is cited    one unsourced clause in a sourced paragraph
 *   every figure is in a quote  a plausible number nobody published
 *
 * That last rule is here for a specific reason: the March 2004 entry in the
 * hand-written data said twenty people were killed. Nineteen were. The number
 * was plausible, adjacent to the truth, and wrong — the exact shape of error a
 * language model produces and a reader has no way to catch.
 *
 * Pure. No network, no database. Everything it judges is passed in.
 */

/** Sources that cannot, alone, support a historical claim. */
export const TERTIARY_HOSTS = [
  "wikipedia.org",
  "wikiwand.com",
  "britannica.com",
  "dbpedia.org",
];

export const MIN_PUBLISHERS = 2;

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replaceAll("ë", "e")
    .replaceAll("ç", "c")
    .replace(/\s+/g, " ")
    .trim();

/** Host of a url, or null when it is not a url at all. */
export function hostOf(url) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function isTertiary(url) {
  const h = hostOf(url);
  return !!h && TERTIARY_HOSTS.some((t) => h === t || h.endsWith("." + t));
}

/**
 * Every figure a reader would take as fact.
 *
 * Bare integers, decimals and thousands-separated numbers, plus the Albanian
 * number words that carry casualty and quantity claims in this material. A
 * milestone may not assert any of them unless a fetched source says it too.
 */
/**
 * Number words in both languages, mapped to the digits they mean.
 *
 * A milestone is written in Albanian; the reporting that proves it is very
 * often in English. Comparing the words themselves would refuse every correctly
 * sourced draft, so both sides are reduced to digits first: "Dy ditë" and "Two
 * days" both become 2, and the rule keeps working across the translation
 * instead of being weakened to let it through.
 */
const NUMBER_WORDS = {
  nje: "1", njё: "1", one: "1",
  dy: "2", two: "2",
  tre: "3", tri: "3", three: "3",
  kater: "4", four: "4",
  pese: "5", five: "5",
  gjashte: "6", six: "6",
  shtate: "7", seven: "7",
  tete: "8", eight: "8",
  nente: "9", nine: "9",
  dhjete: "10", ten: "10",
  njembedhjete: "11", eleven: "11",
  dymbedhjete: "12", twelve: "12",
  trembedhjete: "13", thirteen: "13",
  katermbedhjete: "14", fourteen: "14",
  pesembedhjete: "15", fifteen: "15",
  gjashtembedhjete: "16", sixteen: "16",
  shtatembedhjete: "17", seventeen: "17",
  tetembedhjete: "18", eighteen: "18",
  nentembedhjete: "19", nineteen: "19",
  njezet: "20", twenty: "20",
  tridhjete: "30", thirty: "30",
  dyzet: "40", forty: "40",
  pesedhjete: "50", fifty: "50",
  gjashtedhjete: "60", sixty: "60",
  shtatedhjete: "70", seventy: "70",
  tetedhjete: "80", eighty: "80",
  nentedhjete: "90", ninety: "90",
  njeqind: "100", hundred: "100",
  mije: "1000", thousand: "1000",
  milion: "1000000", million: "1000000",
  miliard: "1000000000", billion: "1000000000",
};

export function figuresIn(text) {
  const t = norm(text);
  const out = new Set();
  for (const m of t.matchAll(/\d[\d.,]*/g)) {
    // Thousands separators are noise, not meaning: 4,100 and 4100 are the
    // same claim and must not be treated as different figures.
    const cleaned = m[0].replace(/[.,]+$/, "").replace(/[.,](?=\d{3}\b)/g, "");
    if (cleaned.length) out.add(cleaned);
  }
  for (const [word, digits] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp("(^| )" + word + "( |$)").test(t)) out.add(digits);
  }
  return out;
}

/** Sentences, for the rule that each must rest on something. */
export function sentencesIn(text) {
  return String(text ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

function parseEventDate(value) {
  const s = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  if (d.toISOString().slice(0, 10) !== s) return null;
  return d;
}

// ── quotes ─────────────────────────────────────────────────────────────────

/** Typography a reader never notices is not a difference; a changed word is. */
const quoteNorm = (s) =>
  norm(s)
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();

export const MIN_QUOTE = 20;

/** Is `quote` written, word for word, in `text`? */
export function quoteIsIn(quote, text) {
  const q = quoteNorm(quote);
  if (q.length < MIN_QUOTE) return false;
  return quoteNorm(text).includes(q);
}

// ── dates ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  ["january", "jan", "janar"],
  ["february", "feb", "shkurt"],
  ["march", "mar", "mars"],
  ["april", "apr", "prill"],
  ["may", "maj"],
  ["june", "jun", "qershor"],
  ["july", "jul", "korrik"],
  ["august", "aug", "gusht"],
  ["september", "sept", "sep", "shtator"],
  ["october", "oct", "tetor"],
  ["november", "nov", "nentor"],
  ["december", "dec", "dhjetor"],
];
const SQ_MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];

/**
 * Does `text` state this date, at this precision? Day precision needs day and
 * month together with the year in the same text; month needs month and year;
 * year needs the year standing alone. "7 March" is not "17 March".
 */
export function dateInText(text, iso, precision = "day") {
  const t = quoteNorm(text);
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return false;
  const hasYear = new RegExp(`(^|[^0-9])${y}([^0-9]|$)`).test(t);
  if (precision === "year") return hasYear;
  // The year must be written with the month (and day), not anywhere in the
  // quote: "17 March 2005; the 2004 deal" is not 17 March 2004.
  const months = `(?:${MONTH_NAMES[m - 1].join("|")})\\.?`;
  const year = `,? (?:of )?${y}([^0-9]|$)`;
  if (precision === "month") return new RegExp(`(^|[^a-z])${months}${year}`).test(t);
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  if (norm(text).includes(`${y}-${mm}-${dd}`)) return true;
  if (new RegExp(`(^|[^0-9])0?${d}[./]0?${m}[./]${y}([^0-9]|$)`).test(t)) return true;
  const day = `0?${d}(?:st|nd|rd|th)?`;
  return (
    new RegExp(`(^|[^0-9])${day} (?:of )?${months}${year}`).test(t) ||
    new RegExp(`(^|[^a-z])${months},? ${day}${year}`).test(t)
  );
}

/** The date a reader sees, written from event_date alone: "15 shtator 2021", "nëntor 2008", "1999". */
export function displayDateSq(iso, precision = "day") {
  const [y, m, d] = String(iso).split("-").map(Number);
  if (precision === "year") return String(y);
  if (precision === "month") return `${SQ_MONTHS[m - 1]} ${y}`;
  return `${d} ${SQ_MONTHS[m - 1]} ${y}`;
}

/**
 * Judge one drafted milestone.
 *
 * `sources` is the list the model was shown: each entry needs a url, publisher
 * and the text that was actually fetched (`live: false` marks a copy read only
 * through an archive). Each of `raw.claims` is one sentence of the summary with
 * `quotes: [{ source, text }]` — sentences copied from the fetched pages.
 *
 * A claim stands only when quotes found verbatim on live pages of at least two
 * different publishers carry it, and every figure it asserts is inside those
 * quotes. The date, at its stated precision, has to be written in one of the
 * moment's quotes. Returns { ok: true, milestone, citations } or
 * { ok: false, reasons } with stable reason slugs.
 *
 * @param {any} raw
 * @param {{ sources?: Array<Record<string, any>>, now?: Date }} [opts]
 */
export function validateMilestoneDraft(raw, { sources = [], now = new Date() } = {}) {
  const reasons = [];
  const push = (r) => {
    if (!reasons.includes(r)) reasons.push(r);
  };
  const unsupported = new Set();

  const title = String(raw?.title ?? "").trim();
  const summary = String(raw?.summary ?? "").trim();
  if (title.length < 6) push("title_missing");
  if (summary.length < 40) push("summary_too_short");

  const publisherKey = (s) => norm(s?.publisher) || hostOf(s?.url) || "";
  const claims = Array.isArray(raw?.claims) ? raw.claims : [];
  if (!claims.length) push("no_citations");

  // ── each claim on its own quotes ──────────────────────────────────────────
  const quoteFor = new Map(); // source index → first verified quote
  const verified = []; // { text, source }
  const kept = []; // per claim, its verified quotes
  let anyQuoted = false;
  let anyPrimary = false;
  for (const c of claims) {
    const good = [];
    for (const q of Array.isArray(c?.quotes) ? c.quotes : []) {
      const i = q?.source;
      if (!Number.isInteger(i) || i < 0 || i >= sources.length) {
        push("citation_index_invalid");
        continue;
      }
      anyQuoted = true;
      const src = sources[i];
      // A tertiary source is a lead, never the evidence.
      if (isTertiary(src.url)) continue;
      anyPrimary = true;
      if (!quoteIsIn(q?.text, src.text)) {
        push("quote_not_in_source");
        continue;
      }
      // An archive copy proves the page once said this, not that it stands.
      if (src.live === false) continue;
      good.push({ text: String(q.text).trim(), source: i, url: src.url, publisher: src.publisher ?? hostOf(src.url) });
    }
    kept.push(good);
    const publishers = new Set(good.map((g) => publisherKey(sources[g.source])).filter(Boolean));
    if (publishers.size < MIN_PUBLISHERS) push("claim_needs_two_publishers");
    // A figure is checked against this claim's own quotes, never the pooled page.
    const quoted = figuresIn(good.map((g) => g.text).join(" "));
    for (const f of figuresIn(c?.sentence)) if (!quoted.has(f)) unsupported.add(f);
    for (const g of good) {
      verified.push(g);
      if (!quoteFor.has(g.source)) quoteFor.set(g.source, g.text);
    }
  }
  if (anyQuoted && !anyPrimary) push("tertiary_sources_only");

  // ── every sentence of the summary is one of the claims ────────────────────
  //
  // Matched by content, not by character: a model reproducing its own prose
  // drifts by a comma or a dash. A sentence it never pointed at still shares
  // almost nothing with any claim and is refused.
  const claimTexts = claims.map((c) => norm(c?.sentence));
  /** Index of the claim that carries this summary sentence, or -1. */
  const coveringClaim = (sentence) => {
    const s = norm(sentence);
    const words = new Set(s.split(" ").filter((w) => w.length > 3));
    for (let i = 0; i < claimTexts.length; i++) {
      const c = claimTexts[i];
      if (!c) continue;
      if (c.includes(s) || s.includes(c)) return i;
      if (!words.size) continue;
      const have = new Set(c.split(" ").filter((w) => w.length > 3));
      let hit = 0;
      for (const w of words) if (have.has(w)) hit += 1;
      if (hit / words.size >= 0.8) return i;
    }
    return -1;
  };
  for (const s of sentencesIn(summary)) {
    const i = coveringClaim(s);
    if (i < 0) {
      push("uncited_sentence");
      continue;
    }
    // A summary sentence's figures come from the quotes of the claim that
    // carries it — not from a number some other claim's source happens to say.
    const own = figuresIn(kept[i].map((g) => g.text).join(" "));
    for (const f of figuresIn(s)) if (!own.has(f)) unsupported.add(f);
  }

  // The title (and any fragment too short to be a sentence) may not carry a
  // figure no quote of this moment carries.
  const allQuoted = figuresIn(verified.map((g) => g.text).join(" "));
  for (const f of figuresIn(title + " " + summary)) if (!allQuoted.has(f)) unsupported.add(f);
  if (unsupported.size) push("figure_not_in_quotes");

  // ── the date, at the precision claimed ────────────────────────────────────
  const precision = ["day", "month", "year"].includes(raw?.date_precision) ? raw.date_precision : "day";
  const when = parseEventDate(raw?.event_date);
  if (!when) {
    push("event_date_invalid");
  } else {
    if (when.getTime() > now.getTime()) push("event_date_in_future");
    // Only the year used to be compared, so a real event could move by days or
    // months. The quotes have to say this day (or month, or year).
    if (!verified.some((g) => dateInText(g.text, raw.event_date, precision))) push("event_date_not_in_quotes");
  }

  if (reasons.length) {
    return { ok: /** @type {const} */ (false), reasons, unsupportedFigures: [...unsupported] };
  }

  // "Pse ka rëndësi" explains; it may not add a fact. A figure that neither the
  // moment nor its quotes carry drops the line rather than the moment.
  let why = String(raw?.why ?? "").trim() || null;
  if (why) {
    const known = figuresIn(title + " " + summary + " " + verified.map((g) => g.text).join(" "));
    if ([...figuresIn(why)].some((f) => !known.has(f))) why = null;
  }

  return {
    ok: /** @type {const} */ (true),
    milestone: {
      title,
      summary,
      why,
      tag: String(raw?.tag ?? "").trim() || null,
      event_date: raw.event_date,
      date_precision: precision,
      display_date: displayDateSq(raw.event_date, precision),
      dedupe_key: norm(title)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 120),
      claims: { sentences: claims.map((c, i) => ({ sentence: String(c?.sentence ?? ""), quotes: kept[i] })) },
    },
    citations: [...quoteFor.keys()].map((i) => {
      const s = sources[i];
      return {
        url: s.url,
        publisher: s.publisher ?? hostOf(s.url),
        source_title: s.title ?? null,
        // Where the text was read when the live url had died; null otherwise.
        archive_url: s.archive_url ?? null,
        source_date: s.published_date ?? null,
        // Only a quote found verbatim on the live page reaches this point.
        quote: quoteFor.get(i) ?? null,
      };
    }),
  };
}

/**
 * Re-check a stored moment after its text was edited by hand.
 *
 * Its quotes were matched against the live pages when it was published, and
 * they are stored with url and publisher on each claim. So the same rules can
 * run again without fetching anything: the edited title, summary, why and date
 * are judged against exactly the words the sources were found to say. An edit
 * that keeps the facts passes; one that changes a figure or the date does not.
 *
 * @param {any} row a dosje_milestones row (title, summary, why, event_date, date_precision, claims)
 * @param {Date} [now]
 */
export function revalidateStored(row, now = new Date()) {
  const sentences = Array.isArray(row?.claims?.sentences) ? row.claims.sentences : [];
  const urls = [];
  const texts = new Map();
  for (const c of sentences) {
    for (const q of c?.quotes ?? []) {
      if (!q?.url) continue;
      if (!texts.has(q.url)) {
        urls.push(q.url);
        texts.set(q.url, { publisher: q.publisher ?? null, parts: [] });
      }
      texts.get(q.url).parts.push(String(q.text ?? ""));
    }
  }
  const sources = urls.map((url) => ({ url, publisher: texts.get(url).publisher, text: texts.get(url).parts.join(" … ") }));
  const claims = sentences.map((c) => ({
    sentence: c?.sentence,
    quotes: (c?.quotes ?? []).filter((q) => q?.url).map((q) => ({ source: urls.indexOf(q.url), text: q.text })),
  }));
  return validateMilestoneDraft(
    {
      title: row?.title,
      summary: row?.summary,
      why: row?.why,
      tag: row?.tag,
      event_date: row?.event_date,
      date_precision: row?.date_precision,
      claims,
    },
    { sources, now }
  );
}
