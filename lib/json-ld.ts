/**
 * JSON-LD, safe to drop inside a <script> tag.
 *
 * JSON.stringify does not escape `</script>`. The HTML parser closes a script
 * element the moment it sees that byte sequence, whatever JavaScript string it
 * happens to sit inside, so a value containing it ends the block early and
 * everything after is parsed as markup.
 *
 * That matters here because the article page feeds this function `title`,
 * `excerpt` and `body` -- text that began life on an external news site, passed
 * through an LLM rewrite, and was stored without HTML being stripped. The
 * article body itself is deliberately rendered as plain text by
 * lib/article-body.mjs, with a comment saying that was chosen to avoid trading a
 * formatting bug for an XSS one. The metadata never got the same treatment.
 *
 * U+2028 and U+2029 are escaped for a different reason: they are valid inside a
 * JSON string but are line terminators in JavaScript source, so an unescaped one
 * breaks the script without any tag being involved. They are written here as
 * \u escapes rather than as the characters themselves -- a literal U+2028 in
 * this file would terminate the regex it sits in, which is the same bug one
 * level down.
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
