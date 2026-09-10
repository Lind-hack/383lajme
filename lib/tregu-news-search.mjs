/** Bounded entity queries; punctuation cannot become PostgREST filter syntax. */
export function propositionSearchTerms(market) {
  const proposition = market?.pre_match_analysis?.proposition ?? {};
  const entities = Array.isArray(proposition.entities) ? proposition.entities : [];
  return [...new Set(entities.map(value => String(value).replace(/[^\p{L}\p{N} -]/gu, ' ').replace(/\s+/g, ' ').trim()))]
    .filter(value => value.length >= 3).slice(0, 4);
}
