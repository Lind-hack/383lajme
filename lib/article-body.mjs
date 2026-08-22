/**
 * Article bodies, as paragraphs.
 *
 * The store holds two shapes. Older pieces are plain text with blank lines
 * between paragraphs; everything the current pipeline writes is HTML —
 * `<p>…</p><p>…</p>`. The page split on "\n\n" and rendered the result as
 * text, which is correct for the first shape and, for the second, printed the
 * markup to the reader: every article opened with a literal `<p>` and ran the
 * whole piece together as one block. Measured 2026-08-22: 21 of the 21 most
 * recent articles were affected, so this was every article on the site.
 *
 * Tags are stripped rather than rendered. Bodies are assembled from scraped
 * sources, and handing scraped markup to dangerouslySetInnerHTML would trade a
 * formatting bug for an injection one. Paragraph breaks are the only structure
 * these pieces actually carry, and that survives the strip.
 */

const BLOCK_END = /<\/(?:p|div|h[1-6]|li|blockquote)>|<br\s*\/?>/gi;

const ENTITIES = [
  [/&nbsp;/gi, " "],
  [/&amp;/gi, "&"],
  [/&quot;/gi, '"'],
  [/&#0*39;|&apos;/gi, "'"],
  [/&lt;/gi, "<"],
  [/&gt;/gi, ">"],
  [/&hellip;/gi, "…"],
  [/&mdash;/gi, "—"],
  [/&ndash;/gi, "–"],
];

/** Is this body markup rather than plain text? */
export function looksLikeHtml(body) {
  return /<\/?(?:p|div|br|h[1-6]|ul|ol|li|blockquote)\b/i.test(String(body ?? ""));
}

function decode(value) {
  let out = String(value ?? "");
  for (const [pattern, replacement] of ENTITIES) out = out.replace(pattern, replacement);
  return out;
}

/** The body as clean paragraphs, whichever shape it was stored in. */
export function toParagraphs(body) {
  const raw = String(body ?? "");
  if (!raw.trim()) return [];

  const pieces = looksLikeHtml(raw)
    ? raw.split(BLOCK_END)
    : raw.split(/\n{2,}/);

  return pieces
    .map((piece) =>
      decode(piece.replace(/<[^>]*>/g, " "))
        // Collapse whatever the tag strip left behind, including the newlines
        // an HTML body carries between its own tags.
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

/** Reading time in minutes, counting words rather than markup. */
export function readingMinutes(body, wordsPerMinute = 200) {
  const words = toParagraphs(body).join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}
