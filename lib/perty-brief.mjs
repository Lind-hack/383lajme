// "Sot në 30 sekonda" — the day's recap at the top of Për ty: one line for every
// story in the reader's edition, on one screen.
//
// The reader's browser sends the slugs of its edition; nothing else about them.
// The server reads those articles and asks the model for one short line per
// story. The rules that make it safe to show:
//
//   1. Only the given articles. The model sees nothing else and is told to use
//      nothing else.
//   2. Every line names the slug it came from, and a line whose slug was not
//      one of the inputs is dropped. A line that cannot be traced to a story is
//      not shown, however good it sounds.
//   3. Short. Each line is capped, so a model that rambles cannot fill the card.
//   4. Whole. A story the model left out (or every story, while it is still
//      writing or when it is down) is recapped by its own summary, so the recap
//      always covers the whole edition and never says more than the stories do
//      (recapRows).

export const MAX_SLUGS = 8;
export const MIN_SLUGS = 2;
export const MAX_LINES = MAX_SLUGS;
const MAX_LINE_CHARS = 180;
const SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/i;

/** The slugs a caller sent (untrusted): valid, once each, at most MAX_SLUGS. */
export function validSlugs(raw) {
  const out = [];
  for (const slug of Array.isArray(raw) ? raw : []) {
    if (typeof slug === "string" && SLUG.test(slug) && !out.includes(slug)) out.push(slug);
    if (out.length >= MAX_SLUGS) break;
  }
  return out;
}

/** One cache entry per set of stories, whatever order they arrived in. */
export function briefKey(slugs) {
  return [...slugs].sort().join("|");
}

export const BRIEF_SYSTEM = [
  "Je Dardani, redaktori i 383. Shkruan shqip standard, qartë dhe pa zhargon.",
  "Të jepen lajmet e sotme të lexuesit. Shkruaj NJË rresht të shkurtër për ÇDO lajm, që i thotë lexuesit çfarë duhet të dijë sot.",
  "Rregulla:",
  "- Përdor VETËM faktet në lajmet e dhëna. Mos shto asgjë nga dija jote.",
  "- Çdo rresht i përket një lajmi të vetëm dhe shënon slug-un e tij.",
  "- Çdo rresht: një fjali, më pak se 22 fjalë, fakti kryesor, pa pikëpyetje, pa emoji.",
  "- Mos përsërit titullin fjalë për fjalë; thuaj çfarë ndodhi dhe pse ka rëndësi.",
  'Kthe JSON: {"lines":[{"slug":"...","text":"..."}]}',
].join("\n");

/** The first sentence of a story's own summary, bounded: the recap line nobody had to write. */
export function firstSentence(text) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const end = clean.search(/[.!?…](\s|$)/);
  const one = end >= 0 ? clean.slice(0, end + 1) : clean;
  return one.length > MAX_LINE_CHARS ? `${one.slice(0, MAX_LINE_CHARS - 1).replace(/\s+\S*$/, "")}…` : one;
}

/**
 * The recap: every story of the edition, in its order, with Dardani's line
 * when he wrote one for it and its own first sentence (or its title) when not.
 *
 * @param {readonly { slug: string, title: string, excerpt?: string | null }[]} stories
 * @param {readonly { slug: string, text: string }[] | null | undefined} lines
 * @returns {{ slug: string, text: string, byDardani: boolean }[]}
 */
export function recapRows(stories, lines) {
  const said = new Map((Array.isArray(lines) ? lines : []).map((l) => [l?.slug, l?.text]));
  return (Array.isArray(stories) ? stories : [])
    .filter((s) => s?.slug)
    .slice(0, MAX_SLUGS)
    .map((s) => {
      const own = typeof said.get(s.slug) === "string" ? said.get(s.slug) : "";
      return own ? { slug: s.slug, text: own, byDardani: true } : { slug: s.slug, text: firstSentence(s.excerpt) || String(s.title ?? ""), byDardani: false };
    });
}

/** The user message: the articles, each under its slug. */
export function buildBriefPrompt(articles) {
  return articles
    .map((a) => {
      const body = String(a?.body ?? "").replace(/\s+/g, " ").slice(0, 700);
      return [`slug: ${a.slug}`, `titulli: ${a.title}`, `përmbledhja: ${a.excerpt ?? ""}`, body && `teksti: ${body}`]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");
}

/**
 * Keep only lines that cite an article that was given, once per article,
 * trimmed and bounded.
 *
 * @param {unknown} raw          the model's parsed JSON
 * @param {readonly string[]} allowed  the slugs that were sent to it
 * @returns {{ slug: string, text: string }[]}
 */
export function cleanBrief(raw, allowed) {
  const ok = new Set(allowed);
  const lines = Array.isArray(raw?.lines) ? raw.lines : [];
  const out = [];
  for (const line of lines) {
    const slug = typeof line?.slug === "string" ? line.slug.trim() : "";
    let text = typeof line?.text === "string" ? line.text.replace(/\s+/g, " ").trim() : "";
    if (!ok.has(slug) || text.length < 12 || out.some((l) => l.slug === slug)) continue;
    if (text.length > MAX_LINE_CHARS) text = `${text.slice(0, MAX_LINE_CHARS - 1).replace(/\s+\S*$/, "")}…`;
    out.push({ slug, text });
    if (out.length >= MAX_LINES) break;
  }
  return out;
}
