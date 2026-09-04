/**
 * Decode HTML entities in stored text.
 *
 * Citation titles arrive from scraped pages with their entities intact, so the
 * dossier review showed "Kosovo&#039;s" and "Kosovë&#x27;s" to the approver.
 * lib/live-news.ts has a decoder but it is private to that module and handles
 * only `&#39;`, not the zero-padded decimal or the hex form that this data
 * actually carries.
 *
 * Decoding is for display only. Nothing here re-enters HTML: React escapes it
 * again on render, so turning `&lt;` back into `<` cannot introduce markup.
 */
/**
 * A numeric entity that is out of Unicode range, or a surrogate half.
 *
 * String.fromCodePoint throws RangeError on anything above U+10FFFF, and this
 * runs inside a server component's render path over scraped citation titles --
 * so one malformed entity in one source title would 500 the whole dossier
 * timeline. Out-of-range entities are left as written instead.
 */
function codePoint(raw: number): string | null {
  if (!Number.isFinite(raw) || raw < 0 || raw > 0x10ffff) return null;
  if (raw >= 0xd800 && raw <= 0xdfff) return null;
  return String.fromCodePoint(raw);
}

export function decodeEntities(value: string): string {
  if (!value) return "";
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (whole, hex: string) =>
      codePoint(Number.parseInt(hex, 16)) ?? whole,
    )
    .replace(/&#(\d+);/g, (whole, dec: string) => codePoint(Number.parseInt(dec, 10)) ?? whole)
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Ampersand last: doing it first would turn "&amp;#39;" into an apostrophe
    // rather than the literal "&#39;" the source actually wrote.
    .replace(/&amp;/g, "&");
}
