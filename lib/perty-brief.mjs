// "Çfarë duhet të dish sot" — Dardani's three lines at the top of Për ty.
//
// The reader's browser sends the slugs of the stories at the top of their own
// feed; nothing else about them. The server reads those articles and asks the
// model for three short lines, each tied to one of them. The rules that make it
// safe to show:
//
//   1. Only the given articles. The model sees nothing else and is told to use
//      nothing else.
//   2. Every line names the slug it came from, and a line whose slug was not
//      one of the inputs is dropped. A line that cannot be traced to a story is
//      not shown, however good it sounds.
//   3. Short. Each line is capped, so a model that rambles cannot fill the card.

export const MAX_SLUGS = 8;
export const MIN_SLUGS = 2;
export const MAX_LINES = 3;
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
  "Të jepen disa lajme. Shkruaj 3 rreshta të shkurtër që i thonë lexuesit çfarë duhet të dijë sot nga KËTO lajme.",
  "Rregulla:",
  "- Përdor VETËM faktet në lajmet e dhëna. Mos shto asgjë nga dija jote.",
  "- Çdo rresht i përket një lajmi të vetëm dhe shënon slug-un e tij.",
  "- Çdo rresht: një fjali, më pak se 22 fjalë, fakti kryesor, pa pikëpyetje, pa emoji.",
  "- Mos përsërit titullin fjalë për fjalë; thuaj çfarë ndodhi dhe pse ka rëndësi.",
  'Kthe JSON: {"lines":[{"slug":"...","text":"..."}]}',
].join("\n");

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
