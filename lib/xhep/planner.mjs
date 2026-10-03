/**
 * Deterministic day planner: curated places only, never invented ones.
 *
 *   planTrip(profile) → [{ day, cityId, stops: [{ placeId, minutes, slot }], minutes }]
 *
 * One city per day, in the visitor's route order, repeating the route when
 * the stay is longer than the city list. Within a city, places are scored by
 * how many of the visitor's interests they match, then ordered morning →
 * afternoon → evening, keeping each day under DAY_BUDGET_MIN. A city seen
 * twice continues with the places it hasn't shown yet.
 */
import { PLACES } from "./places.mjs";

export const DAY_BUDGET_MIN = 420; // about 7 hours of visiting, leaving room for meals and travel
const SLOT_ORDER = { morning: 0, any: 1, afternoon: 2, evening: 3 };
const MAX_DAYS = 30;

function score(place, interests) {
  const hits = place.interests.filter((i) => interests.includes(i)).length;
  return hits * 10 + (place.coords ? 1 : 0);
}

export function planTrip(profile) {
  const cities = Array.isArray(profile?.cities) && profile.cities.length ? profile.cities : ["prishtine"];
  const interests = Array.isArray(profile?.interests) ? profile.interests : [];
  const days = Math.min(MAX_DAYS, Math.max(1, Number(profile?.days) || 1));
  const shown = new Map(cities.map((id) => [id, new Set()]));
  const plan = [];

  for (let d = 0; d < days; d += 1) {
    const cityId = cities[d % cities.length];
    const seen = shown.get(cityId) ?? new Set();
    const pool = PLACES.filter((p) => p.cityId === cityId)
      .map((p) => ({ p, s: score(p, interests) - (seen.has(p.id) ? 100 : 0) }))
      .sort((a, b) => b.s - a.s || a.p.id.localeCompare(b.p.id));
    const stops = [];
    let used = 0;
    for (const { p } of pool) {
      if (used + p.minutes > DAY_BUDGET_MIN && stops.length > 0) continue;
      if (stops.length >= 4) break;
      stops.push(p);
      used += p.minutes;
      seen.add(p.id);
    }
    stops.sort((a, b) => SLOT_ORDER[a.bestTime] - SLOT_ORDER[b.bestTime] || a.id.localeCompare(b.id));
    plan.push({
      day: d + 1,
      cityId,
      minutes: used,
      stops: stops.map((p) => ({ placeId: p.id, minutes: p.minutes, slot: p.bestTime })),
    });
  }
  return plan;
}
