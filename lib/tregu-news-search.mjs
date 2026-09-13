/** Bounded entity queries; punctuation cannot become PostgREST filter syntax. */
export function propositionSearchTerms(market) {
  const proposition = market?.pre_match_analysis?.proposition ?? {};
  const entities = Array.isArray(proposition.entities) ? proposition.entities : [];
  return [...new Set(entities.map(value => String(value).replace(/[^\p{L}\p{N} -]/gu, ' ').replace(/\s+/g, ' ').trim()))]
    .filter(value => value.length >= 2).slice(0, 4);
}

export function containsNamedEntity(text, name) {
  const fold = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const acronym = /^[A-Z]{2,3}$/.test(name);
  const escaped = fold(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, acronym ? 'u' : 'iu').test(fold(text));
}
