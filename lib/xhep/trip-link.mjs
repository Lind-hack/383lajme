/**
 * Trip links: the trip travels inside the URL, so nothing about a visitor is
 * stored on a server. A friend who scans the card's QR gets the same trip
 * (cities, days, interests) and, because the planner is deterministic, the
 * same day-by-day plan — then weaves their own card from it.
 *
 *   https://383ks.com/visit/t?d=<payload>
 *
 * Payload v1, "~"-separated, every field validated on the way in:
 *   1 ~ name ~ type ~ days ~ month ~ arrival ~ interests ~ cities ~ budget ~ seed
 * The name is the owner's choice to share; it can be empty.
 */
import { normalizeCardProfile } from "./card-art.mjs";

export const TRIP_BASE_URL = "https://383ks.com/visit/t";

const TYPE = { first: "f", diaspora: "d", family: "m" };
const ARRIVAL = { fly: "a", "drive:": "c", "drive:kulle": "k", "drive:merdare": "r", "drive:hani-i-elezit": "h", "drive:vermice-morine": "v" };
const INTEREST = { nature: "n", history: "h", food: "f", coffee: "c", nightlife: "l", skiing: "s" };
const CITY = { prishtine: "pr", prizren: "pz", peje: "pe", gjakove: "gj", mitrovice: "mi", gjilan: "gl", ferizaj: "fe" };
const BUDGET = { easy: "e", mid: "m", treat: "t" };
const invert = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
const TYPE_R = invert(TYPE);
const ARRIVAL_R = invert(ARRIVAL);
const INTEREST_R = invert(INTEREST);
const CITY_R = invert(CITY);
const BUDGET_R = invert(BUDGET);

/** Compact payload for a profile (not URL-encoded). */
export function encodeTrip(rawProfile) {
  const p = normalizeCardProfile(rawProfile);
  const seed = typeof rawProfile?.seed === "string" && /^[a-z0-9]{6,32}$/.test(rawProfile.seed) ? rawProfile.seed : "";
  return [
    "1",
    p.name.replace(/~/g, " "),
    TYPE[p.travellerType],
    String(p.days),
    String(p.month ?? 0),
    ARRIVAL[p.arrival === "fly" ? "fly" : `drive:${p.crossing ?? ""}`],
    p.interests.map((i) => INTEREST[i]).join(""),
    p.cities.map((c) => CITY[c]).join(""),
    BUDGET[p.budget],
    seed,
  ].join("~");
}

export function tripUrl(rawProfile, lang = "en") {
  return `${TRIP_BASE_URL}?d=${encodeURIComponent(encodeTrip(rawProfile))}${lang === "sq" ? "&lang=sq" : ""}`;
}

/** Decode a payload into a normalized profile-shaped object, or null if it isn't one. */
export function decodeTrip(payload) {
  if (typeof payload !== "string" || payload.length > 200) return null;
  const parts = payload.split("~");
  if (parts.length !== 10 || parts[0] !== "1") return null;
  const [, name, type, days, month, arrival, interests, cities, budget, seed] = parts;
  const arrivalKey = ARRIVAL_R[arrival] ?? "fly";
  const decoded = {
    name,
    travellerType: TYPE_R[type],
    days: Number(days),
    month: Number(month) || null,
    arrival: arrivalKey === "fly" ? "fly" : "drive",
    crossing: arrivalKey.startsWith("drive:") ? arrivalKey.slice(6) || null : null,
    interests: [...interests].map((ch) => INTEREST_R[ch]).filter(Boolean),
    cities: (cities.match(/.{2}/g) ?? []).map((code) => CITY_R[code]).filter(Boolean),
    budget: BUDGET_R[budget],
  };
  const p = normalizeCardProfile(decoded);
  return { ...p, seed: /^[a-z0-9]{6,32}$/.test(seed) ? seed : null };
}

/**
 * A joining friend's card: the same trip and interests (so the same palette
 * and plan — one card family) with their own seed and name.
 */
export function joinTrip(trip, { name = "", seed }) {
  return {
    ...trip,
    name: typeof name === "string" ? name.trim().slice(0, 18) : "",
    travellerType: trip.travellerType,
    seed,
    joinedFrom: trip.seed ?? null,
    travellingWith: trip.name,
    stamps: [],
    completed: true,
  };
}
