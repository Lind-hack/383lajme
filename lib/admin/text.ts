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
export function decodeEntities(value: string): string {
  if (!value) return "";
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Ampersand last: doing it first would turn "&amp;#39;" into an apostrophe
    // rather than the literal "&#39;" the source actually wrote.
    .replace(/&amp;/g, "&");
}
