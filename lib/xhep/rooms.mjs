/**
 * Trip rooms: friends travelling Kosovo together, each on their own phone.
 * A room is a short code; joining needs only a display name. Each member's
 * device keeps a secret token (the server stores its hash) and sends a
 * summary of its progress — packs opened, places stamped, paintings
 * finished — never the visitor's location, photos or answers.
 *
 * The rules shared by the API (app/api/xhep/rooms) and the page live here.
 */
import { PACK_CITIES, stampState } from "./packs.mjs";

export const ROOM_CODE_RE = /^[a-z0-9]{6}$/;
export const MAX_MEMBERS = 12;
export const NAME_MAX = 18;
export const ROOM_NAME_MAX = 40;
export const MOMENT_MAX = 140;
export const MOMENTS_PER_DAY = 20;

/** No look-alikes (0/o, 1/l/i), so a code read aloud is typed right. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function newRoomCode(random = Math.random) {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return code;
}

/** One line of text: control characters out, spaces collapsed, trimmed, capped. */
export function cleanText(value, max) {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Member colours, in join order. */
export const MEMBER_COLOURS = ["#ff4422", "#2167a6", "#2f9e6e", "#9a5b2e", "#c8463a", "#7a4fd1", "#d99a12", "#13233a", "#e0607e", "#3a8fb7", "#6b8e23", "#8a5a3c"];

/** What a member shares with the room, read from their profile. */
export function progressOf(profile) {
  const opened = PACK_CITIES.filter((c) => profile?.packs?.[c]);
  const cities = {};
  const painted = [];
  let stamps = 0;
  for (const city of PACK_CITIES) {
    const state = stampState(profile, city);
    if (state.done > 0) cities[city] = state.done;
    if (state.complete) painted.push(city);
    stamps += state.done;
  }
  return { opened, painted, cities, stamps };
}

/** A progress summary from a client, checked field by field; anything odd is dropped. */
export function normalizeProgress(raw) {
  const list = (v) => (Array.isArray(v) ? [...new Set(v.filter((c) => PACK_CITIES.includes(c)))] : []);
  const cities = {};
  if (raw && typeof raw.cities === "object" && raw.cities) {
    for (const city of PACK_CITIES) {
      const n = Number(raw.cities[city]);
      if (Number.isInteger(n) && n > 0 && n <= 7) cities[city] = n;
    }
  }
  const stamps = Object.values(cities).reduce((a, b) => a + b, 0);
  // A painting is finished only if all seven of its places are stamped.
  const painted = list(raw?.painted).filter((c) => cities[c] === 7);
  return { opened: list(raw?.opened), painted, cities, stamps };
}

/** Ranking in the room: a finished painting is worth more than its seven stamps alone. */
export function score(progress) {
  return (progress?.stamps ?? 0) + 5 * (progress?.painted?.length ?? 0);
}

/** The moments to post for a change in progress: a pack opened, a painting finished. */
export function progressEvents(before, after) {
  const was = { opened: new Set(before?.opened ?? []), painted: new Set(before?.painted ?? []) };
  return [
    ...(after?.opened ?? []).filter((c) => !was.opened.has(c)).map((cityId) => ({ kind: "pack", cityId })),
    ...(after?.painted ?? []).filter((c) => !was.painted.has(c)).map((cityId) => ({ kind: "complete", cityId })),
  ];
}
