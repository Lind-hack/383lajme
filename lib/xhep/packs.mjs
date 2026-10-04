/**
 * Kosova në xhep packs: one sealed pack per city, opened like a trading-card
 * pack. A pack holds
 *
 *   - up to 7 place cards (the city's curated places, in catalogue order),
 *   - 2 experience cards: the mural (the visitor's own photos) and the story,
 *   - 1 stamp card: the city's scenery, filled in one place at a time.
 *
 * What a visitor has opened and stamped lives in their profile
 * (lib/xhep/profile.mjs) on the device. Two kinds of stamp:
 *
 *   - "gold": signed by the server after one fresh location check at the
 *     place (lib/xhep/stamps.mjs) — proof the visitor stood there;
 *   - "hand": the visitor's own mark, no location — for places they went to
 *     before they had the card, or with location off.
 *
 * A gold stamp always wins over a hand one for the same place.
 */
import { PLACES } from "./places.mjs";
import { stampPlaceId } from "./stamp-id.mjs";

/** Shelf order: west to east, roughly as a visitor drives in from Albania. */
export const PACK_CITIES = ["prizren", "gjakove", "peje", "prishtine", "mitrovice", "ferizaj", "gjilan"];

export const PLACES_PER_PACK = 7;

/**
 * The art and colours of each city's pack. `crimp` is the sealed edge's
 * colour (the strip that tears off); `accent` dresses the city's cards.
 */
export const PACK_ART = {
  prizren: { src: "/visit/packs/prizren.webp", crimp: "#2F6FB3", accent: "#1F5FA8", ink: "#0E2A4A" },
  gjakove: { src: "/visit/packs/gjakove.webp", crimp: "#E35D4F", accent: "#C8463A", ink: "#3A1611" },
  peje: { src: "/visit/packs/peje.webp", crimp: "#2C77B8", accent: "#2167A6", ink: "#0D2840" },
  prishtine: { src: "/visit/packs/prishtine.webp", crimp: "#8A5A3C", accent: "#B4622F", ink: "#2A170B" },
  mitrovice: { src: "/visit/packs/mitrovice.webp", crimp: "#F2D21B", accent: "#2B6CB0", ink: "#14263D" },
  ferizaj: { src: "/visit/packs/ferizaj.webp", crimp: "#E5483D", accent: "#D9481F", ink: "#3B140C" },
  gjilan: { src: "/visit/packs/gjilan.webp", crimp: "#D9B98A", accent: "#9A5B2E", ink: "#2E1C0E" },
};

export function isPackCity(cityId) {
  return typeof cityId === "string" && PACK_CITIES.includes(cityId);
}

/** The places a city's pack carries, catalogue order, at most PLACES_PER_PACK. */
export function packPlaces(cityId) {
  return PLACES.filter((p) => p.cityId === cityId).slice(0, PLACES_PER_PACK);
}

/**
 * Every card in a pack, in the order they come out: places, then the two
 * experience cards, then the stamp card last — the one worth waiting for.
 */
export function packCards(cityId) {
  if (!isPackCity(cityId)) return [];
  return [
    ...packPlaces(cityId).map((place) => ({ kind: "place", id: place.id, place })),
    { kind: "mural", id: `${cityId}:mural` },
    { kind: "story", id: `${cityId}:story` },
    { kind: "stamps", id: `${cityId}:stamps` },
  ];
}

/** Opened packs from a stored profile: { [cityId]: ISO date }. Junk dropped. */
export function normalizePacks(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const cityId of PACK_CITIES) {
    const at = raw?.[cityId];
    if (typeof at === "string" && !Number.isNaN(Date.parse(at))) out[cityId] = at;
  }
  return out;
}

const PLACE_IDS = new Set(PLACES.map((p) => p.id));

/** Hand stamps from a stored profile: known place ids, once each. */
export function normalizeHandStamps(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id) => typeof id === "string" && PLACE_IDS.has(id)))];
}

/**
 * The stamp card's state for one city: each place's stamp ("gold", "hand" or
 * null), how many are stamped, and whether the scene is complete.
 *
 * @param {{ stamps?: string[], handStamps?: string[] } | null | undefined} profile
 * @param {string} cityId
 */
export function stampState(profile, cityId) {
  const gold = new Set((profile?.stamps ?? []).map(stampPlaceId).filter(Boolean));
  const hand = new Set(profile?.handStamps ?? []);
  const places = packPlaces(cityId).map((place) => ({
    place,
    stamp: gold.has(place.id) ? "gold" : hand.has(place.id) ? "hand" : null,
  }));
  const done = places.filter((p) => p.stamp).length;
  return { places, done, total: places.length, complete: places.length > 0 && done === places.length };
}

/** Add a hand stamp; unchanged if the place is unknown or already stamped by hand. */
export function addHandStamp(handStamps, placeId) {
  const list = normalizeHandStamps(handStamps);
  return PLACE_IDS.has(placeId) && !list.includes(placeId) ? [...list, placeId] : list;
}
