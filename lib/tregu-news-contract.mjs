export const NEWS_CONTRACT_VERSION = "news-event-v3";

export function hasDeadlineAbsenceCondition(value) {
  const text = String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(munges\w*|nuk|asnje|pa|no|not|absence|without)\b/.test(text)
    && /\b(afat\w*|skad\w*|brenda|deri|deadline|expiry|expires|within|before)\b/.test(text);
}

export function validateNewsProposition(candidate) {
  const p = candidate?.proposition;
  if (!p || !["event_pair", "deadline_occurrence"].includes(p.resolution_mode)) return "missing_resolution_mode";
  for (const key of ["decision", "yes_condition", "no_condition", "resolution_source", "geography"]) {
    if (typeof p[key] !== "string" || p[key].trim().length < 3) return `missing_${key}`;
  }
  if (!Array.isArray(p.entities) || !p.entities.length || p.entities.some(entity => typeof entity !== "string" || !entity.trim())) return "missing_entities";
  if (p.yes_condition.trim().toLowerCase() === p.no_condition.trim().toLowerCase()) return "identical_outcome_conditions";
  if (p.review_policy !== "pause_for_review") return "review_policy_required";
  if (p.resolution_mode === "event_pair" && hasDeadlineAbsenceCondition(p.no_condition)) return "event_pair_requires_explicit_negative_outcome";
  return null;
}

export function isEventReviewMarket(market) {
  return market?.pre_match_analysis?.contract_version === NEWS_CONTRACT_VERSION
    && market?.pre_match_analysis?.proposition?.resolution_mode === "event_pair";
}
