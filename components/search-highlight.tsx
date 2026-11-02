import { fold, searchTerms, stem } from "@/lib/search-match.mjs";

/** The folded terms a highlight looks for, from what the reader typed. */
export function highlightTerms(query: string): string[] {
  return searchTerms(query) as string[];
}

/** Does this word in a headline answer one of the query's terms? */
function hits(word: string, terms: readonly string[]): boolean {
  const folded = fold(word);
  if (!folded) return false;
  return terms.some((term) => {
    if (!term) return false;
    if (folded.startsWith(term)) return true;
    // "kosova" lights up "Kosovës": the same stem the ranking matched on.
    const root = stem(term);
    return root !== term && folded.startsWith(root);
  });
}

/**
 * Text with the words that matched the search marked.
 *
 * Matching is per word and diacritic-blind, like the ranking, so a reader who
 * typed "kosove" sees "Kosovës" lit in the headline that came back for it.
 */
export default function Highlight({ text, terms }: { text: string; terms?: readonly string[] }) {
  if (!terms?.length) return <>{text}</>;
  const parts = String(text ?? "").split(/(\s+)/);
  return (
    <>
      {parts.map((part, i) =>
        part.trim() && hits(part, terms) ? (
          <mark key={i} className="kerko-hl">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}
