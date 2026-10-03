/**
 * The visitor's Kosova në xhep profile: quiz answers, the card seed and the
 * stamps they collect. Device-only by default (localStorage), written through
 * a wrapped store so Safari private mode or a full disk never crashes the
 * page — the visitor just keeps an in-memory profile for the session.
 */
import { normalizeCardProfile } from "./card-art.mjs";

export const PROFILE_KEY = "xhep.profile.v1";
export const PROFILE_VERSION = 1;

/** Every field optional on the way in: stored data may predate this schema. */
export function normalizeProfile(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  const card = normalizeCardProfile(p);
  const startDate = typeof p.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.startDate) && !Number.isNaN(Date.parse(p.startDate)) ? p.startDate : null;
  return {
    v: PROFILE_VERSION,
    ...card,
    // A start date, when given, is the source of truth for the month.
    month: startDate ? Number(startDate.slice(5, 7)) : card.month,
    startDate,
    seed: typeof p.seed === "string" && /^[a-z0-9]{6,32}$/.test(p.seed) ? p.seed : null,
    stamps: Array.isArray(p.stamps) ? [...new Set(p.stamps.filter((s) => typeof s === "string" && s.length <= 200))].slice(0, 100) : [],
    // Set when this card was woven by joining a friend's trip.
    travellingWith: typeof p.travellingWith === "string" ? normalizeCardProfile({ name: p.travellingWith }).name : "",
    completed: p.completed === true,
    updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : null,
  };
}

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// Holds the profile only while storage is refusing writes, so a session in
// Safari private mode (or a full disk) still has its card.
let memoryProfile = null;

/** Read the profile; null when the visitor hasn't started one. */
export function readProfile(storage) {
  const store = resolveStorage(storage);
  if (!store) return memoryProfile;
  try {
    const raw = store.getItem(PROFILE_KEY);
    if (raw) return normalizeProfile(JSON.parse(raw));
  } catch {
    /* unreadable or corrupt: fall through */
  }
  return memoryProfile;
}

/** Persist the profile. Returns false when storage refused (the in-memory copy still holds). */
export function writeProfile(profile, storage, now = new Date()) {
  const next = { ...normalizeProfile(profile), updatedAt: now.toISOString() };
  const store = resolveStorage(storage);
  try {
    if (!store) throw new Error("no storage");
    store.setItem(PROFILE_KEY, JSON.stringify(next));
    memoryProfile = null;
    return true;
  } catch {
    memoryProfile = next;
    return false;
  }
}

export function clearProfile(storage) {
  memoryProfile = null;
  const store = resolveStorage(storage);
  try {
    store?.removeItem(PROFILE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** A fresh card seed: random once, then stable for this visitor's card. */
export function newSeed(random = Math.random) {
  let seed = "";
  while (seed.length < 12) seed += Math.floor(random() * 36).toString(36);
  return seed;
}

/** Cities that fit the visitor's interests, best first, for quiz suggestions. */
export function suggestCities(interests) {
  const score = { prishtine: 0, prizren: 0, peje: 0, gjakove: 0, mitrovice: 0, gjilan: 0, ferizaj: 0 };
  const boosts = {
    nature: ["peje", "prizren", "gjakove"],
    history: ["prizren", "gjakove", "prishtine", "peje"],
    food: ["prizren", "prishtine", "peje"],
    coffee: ["prishtine", "prizren", "gjakove"],
    nightlife: ["prishtine", "prizren"],
    skiing: ["ferizaj", "prizren", "peje"],
  };
  for (const interest of Array.isArray(interests) ? interests : []) {
    (boosts[interest] ?? []).forEach((id, i) => {
      score[id] += 3 - Math.min(i, 2);
    });
  }
  return Object.entries(score)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => id);
}
