// A frozen copy of one reader's front page, carried entirely in a link:
// /gazeta/<code>. Personalisation lives only on the reader's device, so a friend
// opening /per-ty would see their own feed; sharing "my paper" means sending
// this snapshot instead.
//
// What goes in, and nothing else: the Kosovo date, the first name (only when the
// reader leaves "Shfaq emrin tim" on), the paper's style and accent, the
// edition's story slugs, and up to four section keys with two slugs each. Never
// reasons, read history, the ledger or learned affinity. Section titles are not
// carried at all: the server derives them from the key (lib/per-ty-paper.mjs
// describeSection), so a link cannot put arbitrary text on 383's pages or cards.
//
// No database: nothing about the reader is stored, and there is no write
// endpoint for guests to abuse. Every field is validated on the way back in;
// anything off and the whole code is rejected.

import { normalizeName } from "./reader-name.mjs";
import { STYLES, ACCENTS } from "./paper-prefs.mjs";
import { describeSection } from "./per-ty-paper.mjs";

export const SNAPSHOT_VERSION = 1;
export const MAX_EDITION = 10;
export const MAX_SECTIONS = 4;
export const PER_SECTION = 2;
export const MAX_CODE_LENGTH = 3000;
export const EXPIRES_DAYS = 30;

const SLUG = /^[a-z0-9-]{1,120}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CODE = /^[A-Za-z0-9_-]+$/;

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code) {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

function validDate(value) {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const t = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === value;
}

/**
 * @param {{ date: string, name?: string, style?: string, accent?: string,
 *   edition: readonly string[], sections?: readonly { key: string, slugs: readonly string[] }[] }} paper
 * @returns {string} the code for /gazeta/<code>
 */
export function encodeSnapshot(paper) {
  const sections = [];
  for (const section of paper?.sections ?? []) {
    if (sections.length >= MAX_SECTIONS) break;
    if (!describeSection(section?.key)) continue;
    const slugs = (section?.slugs ?? []).filter((s) => SLUG.test(s)).slice(0, PER_SECTION);
    if (slugs.length) sections.push([section.key, slugs]);
  }
  const payload = {
    v: SNAPSHOT_VERSION,
    d: paper?.date,
    n: normalizeName(paper?.name ?? "") || undefined,
    s: STYLES.includes(paper?.style) ? paper.style : STYLES[0],
    a: ACCENTS.includes(paper?.accent) ? paper.accent : ACCENTS[0],
    e: (paper?.edition ?? []).filter((s) => SLUG.test(s)).slice(0, MAX_EDITION),
    x: sections,
  };
  return toBase64Url(JSON.stringify(payload));
}

/**
 * The snapshot behind a code, or null for anything malformed, oversized,
 * unknown or hand-crafted to carry what a real paper never would.
 *
 * @param {unknown} code
 * @returns {null | { date: string, name: string, style: string, accent: string,
 *   edition: string[], sections: { key: string, slugs: string[] }[] }}
 */
export function decodeSnapshot(code) {
  if (typeof code !== "string" || code.length === 0 || code.length > MAX_CODE_LENGTH || !CODE.test(code)) return null;
  let raw;
  try {
    raw = JSON.parse(fromBase64Url(code));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || raw.v !== SNAPSHOT_VERSION) return null;
  if (!validDate(raw.d)) return null;
  if (!STYLES.includes(raw.s) || !ACCENTS.includes(raw.a)) return null;

  let name = "";
  if (raw.n !== undefined) {
    name = normalizeName(raw.n);
    if (!name || name !== raw.n) return null;
  }

  const seen = new Set();
  const fresh = (slug) => typeof slug === "string" && SLUG.test(slug) && !seen.has(slug) && (seen.add(slug), true);

  if (!Array.isArray(raw.e) || raw.e.length === 0 || raw.e.length > MAX_EDITION) return null;
  if (!raw.e.every(fresh)) return null;

  const sections = [];
  if (!Array.isArray(raw.x) || raw.x.length > MAX_SECTIONS) return null;
  for (const entry of raw.x) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [key, slugs] = entry;
    if (!describeSection(key) || sections.some((s) => s.key === key)) return null;
    if (!Array.isArray(slugs) || slugs.length === 0 || slugs.length > PER_SECTION || !slugs.every(fresh)) return null;
    sections.push({ key, slugs: [...slugs] });
  }

  return { date: raw.d, name, style: raw.s, accent: raw.a, edition: [...raw.e], sections };
}

/** True once the paper is more than EXPIRES_DAYS old, both dates Kosovo calendar days. */
export function isExpired(date, today) {
  if (!validDate(date) || !validDate(today)) return true;
  const days = (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86_400_000;
  return days > EXPIRES_DAYS || days < -1;
}
