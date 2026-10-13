// "Pikat kryesore": two or three short lines on a story's card in Për ty, taken
// word for word from the story itself — never written, so they can never say
// more than the newsroom did.
//
// Pure. Promises, held by the tests:
//
//   1. Every point is a whole sentence of the excerpt or the body, unchanged.
//      The excerpt's first line leads (it is the newsroom's own summary), then
//      one sentence from each paragraph down the story.
//   2. No point repeats the headline or another point.
//   3. A sentence that leans on one before it ("Ai tha…", "Por…") is left out
//      while there are others to take.
//   4. At most MAX_POINTS, each at most MAX_CHARS long (the excerpt's line, the
//      newsroom's own summary, up to LEAD_CHARS); fewer than two and there are
//      none, and the card shows its excerpt as before.

export const MAX_POINTS = 3;
export const MAX_CHARS = 140;
export const LEAD_CHARS = 180;
const MIN_CHARS = 35;
/** Only the top of the story: what follows is detail, not the news. */
const PARAGRAPHS = 8;

/** Openers that point back at a sentence the card would not show. */
const LEANS = /^(ai|ajo|ata|ato|ky|kjo|këta|këto|por|dhe|ndërsa|megjithatë|gjithashtu|po ashtu|kështu|prandaj|për më tepër|sipas tij|sipas saj)(?![\p{L}])/iu;

const words = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

/** How much of `a`'s words are in `b`. */
function overlap(a, b) {
  const wa = words(a);
  if (!wa.length) return 0;
  const wb = new Set(words(b));
  return wa.filter((w) => wb.has(w)).length / wa.length;
}

/** A paragraph cut into sentences; "nr. 4" and decimals stay whole. */
export function sentences(text) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  return clean
    .split(/(?<=[.!?…]["”»]?)\s+(?=["„“«]?[\p{Lu}])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {{ title?: string, excerpt?: string, paragraphs?: readonly string[] }} story
 * @returns {string[]}
 */
export function keyPoints(story) {
  const title = String(story?.title ?? "");
  const excerpt = String(story?.excerpt ?? "");
  const paragraphs = (Array.isArray(story?.paragraphs) ? story.paragraphs : [])
    .filter((p) => typeof p === "string")
    .slice(0, PARAGRAPHS);

  const fits = (s, max = MAX_CHARS) => s.length >= MIN_CHARS && s.length <= max && /[.!?…]["”»]?$/.test(s);
  const fresh = (s, taken) => overlap(s, title) < 0.7 && taken.every((t) => overlap(s, t) < 0.5 && overlap(t, s) < 0.5);

  const lead = sentences(excerpt).filter((s) => fits(s, LEAD_CHARS));
  const byParagraph = paragraphs.map((p) => sentences(p).filter((s) => fits(s)));
  const order = [
    ...lead.slice(0, 1),
    ...byParagraph.map((list) => list[0]).filter(Boolean),
    ...byParagraph.flatMap((list) => list.slice(1)),
    ...lead.slice(1).filter((s) => fits(s)),
  ];

  const taken = [];
  for (const strict of [true, false]) {
    for (const s of order) {
      if (taken.length >= MAX_POINTS) break;
      if (taken.includes(s) || (strict && LEANS.test(s)) || !fresh(s, taken)) continue;
      taken.push(s);
    }
  }
  // Back in the order the story tells them.
  taken.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return taken.length >= 2 ? taken : [];
}
