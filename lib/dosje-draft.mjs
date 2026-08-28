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

/**
 * Judge one drafted milestone.
 *
 * `sources` is the list the model was shown: each entry needs a url, publisher
 * and the text that was actually fetched. `raw.claims` maps a sentence to the
 * source indexes supporting it.
 *
 * Returns { ok: true, milestone, citations } or { ok: false, reasons }. The
 * reasons are stable strings so the workflow log and the review queue can key
 * on them rather than parse prose.
 */
/**
 * @param {any} raw
 * @param {{ sources?: Array<Record<string, any>>, now?: Date }} [opts]
 */
export function validateMilestoneDraft(raw, { sources = [], now = new Date() } = {}) {
  const reasons = [];
  const push = (r) => {
    if (!reasons.includes(r)) reasons.push(r);
  };

  const title = String(raw?.title ?? "").trim();
  const summary = String(raw?.summary ?? "").trim();
  if (title.length < 6) push("title_missing");
  if (summary.length < 40) push("summary_too_short");

  // ── the sources the model was allowed to point at ─────────────────────────
  const claims = Array.isArray(raw?.claims) ? raw.claims : [];
  const used = new Set();
  for (const c of claims) {
    for (const i of c?.source_indexes ?? []) {
      if (!Number.isInteger(i) || i < 0 || i >= sources.length) {
        push("citation_index_invalid");
        continue;
      }
      used.add(i);
    }
  }
  if (!used.size) push("no_citations");

  const cited = [...used].map((i) => sources[i]).filter(Boolean);

  // A tertiary source is a lead, never the evidence.
  const primary = cited.filter((s) => !isTertiary(s.url));
  if (cited.length && !primary.length) push("tertiary_sources_only");

  const publishers = new Set(
    primary.map((s) => norm(s.publisher) || hostOf(s.url) || "").filter(Boolean)
  );
  if (publishers.size < MIN_PUBLISHERS) push("insufficient_publishers");

  // ── the date ──────────────────────────────────────────────────────────────
  const when = parseEventDate(raw?.event_date);
  if (!when) {
    push("event_date_invalid");
  } else {
    if (when.getTime() > now.getTime()) push("event_date_in_future");
    // A real event reported by nobody in its own year is a date error, and a
    // date error is the failure a reader is least equipped to notice.
    const year = when.toISOString().slice(0, 4);
    const anySourceAgrees =
      !primary.length ||
      primary.some(
        (s) =>
          String(s.published_date ?? "").startsWith(year) ||
          String(s.text ?? "").includes(year)
      );
    if (!anySourceAgrees) push("event_date_unsupported");
  }

  // ── every sentence rests on something ─────────────────────────────────────
  const claimed = new Set(claims.map((c) => norm(c?.sentence)));
  for (const s of sentencesIn(summary)) {
    if (!claimed.has(norm(s))) {
      push("uncited_sentence");
      break;
    }
  }

  // ── every figure was actually published somewhere ─────────────────────────
  const corpus = norm(primary.map((s) => (s.text ?? "") + " " + (s.title ?? "")).join(" "));
  const corpusFigures = figuresIn(corpus);
  const asserted = figuresIn(title + " " + summary);
  const unsupported = [...asserted].filter((f) => !corpusFigures.has(f));
  if (unsupported.length) push("figure_not_in_sources");

  if (reasons.length) return { ok: /** @type {const} */ (false), reasons, unsupportedFigures: unsupported };

  return {
    ok: /** @type {const} */ (true),
    milestone: {
      title,
      summary,
      why: String(raw?.why ?? "").trim() || null,
      tag: String(raw?.tag ?? "").trim() || null,
      event_date: raw.event_date,
      date_precision: ["day", "month", "year"].includes(raw?.date_precision)
        ? raw.date_precision
        : "day",
      display_date: String(raw?.display_date ?? raw.event_date),
      dedupe_key: norm(title)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 120),
      claims: { sentences: claims },
    },
    citations: cited.map((s) => ({
      url: s.url,
      publisher: s.publisher ?? hostOf(s.url),
      source_title: s.title ?? null,
      source_date: s.published_date ?? null,
      quote: s.quote ?? null,
    })),
  };
}
