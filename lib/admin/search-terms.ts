/**
 * Turning what the operator typed into a PostgREST filter, safely.
 *
 * Kept free of imports so it is testable on its own: this is the subtle part
 * of admin search, and the part that fails loudly in production if it is wrong.
 *
 * Two hazards, and missing either one breaks the query rather than merely
 * returning the wrong rows.
 *
 * PostgREST parses `or=(a.ilike.x,b.ilike.y)` positionally, so a comma or a
 * parenthesis inside a term ends the clause early and the request 400s. Typing
 * "Kosova, Serbia" would take search down, not just miss.
 *
 * Separately `%` and `_` are ilike wildcards, so a typed `%` quietly matches
 * every row and the operator concludes search is broken.
 */

/** Columns a term is matched against. Body is searched but never returned. */
export const SEARCH_FIELDS = ["title", "excerpt", "body", "source", "slug"] as const;

/** Guards against a pathological query: six terms is far past useful. */
const MAX_TOKENS = 6;
const MAX_TOKEN_LEN = 40;

/**
 * Split search text into safe tokens.
 *
 * Tokenising rather than sanitising down to a single string is what makes the
 * box behave like a search box. "Kosova, Serbia" becomes two terms that must
 * both appear, not the literal phrase "Kosova Serbia", which matches nothing.
 */
export function searchTokens(raw: string): string[] {
  return raw
    .replace(/[\\%_]/g, "")
    .replace(/[(),.:*"']/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_TOKENS)
    .map((t) => t.slice(0, MAX_TOKEN_LEN));
}

/**
 * The or() group for one token: match it in any searchable column.
 *
 * Callers apply one group per token. PostgREST ANDs separate or= groups, so
 * every token must appear somewhere in the row.
 */
export function orGroupFor(token: string): string {
  return SEARCH_FIELDS.map((f) => `${f}.ilike.%${token}%`).join(",");
}
