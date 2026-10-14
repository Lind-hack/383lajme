// What Për ty tells GA4, so we can see whether the list works without keeping
// anything about the reader on our own servers.
//
// Every event goes through lib/analytics `track`, a no-op until the reader has
// accepted analytics cookies. Nothing personal is sent: the story's slug, its
// place in the list, and which kind of pick it was (a follow, a learned taste,
// or one of the day's top stories), so CTR by kind compares the personal picks
// with the general ones shown beside them in the same list.
//
//   perty_view        once per visit: how many stories, follows, quiet follows
//   perty_impression  a row was on screen ≥ 1 s (once per row per visit)
//   perty_click       a row was opened
//   perty_less        "Më pak si kjo"
//   perty_more_open   a folded "Më shumë" group was opened
//   perty_end         the "Kaq për sot" card came into view
//   perty_read        on the article page, for a visit that came from Për ty:
//                     engaged seconds, how far down it got, whether it counted
//                     as a real read
//
// The click is handed to the article page through sessionStorage (this tab
// only, gone when it closes), keyed by slug, so a read is credited to Për ty
// only when the reader really came from it.

import { track } from "@/lib/analytics";

export type PertyList = "edition" | "more" | "brief" | "section";

export type PertyClick = { slug: string; position: number; kind: string; list: PertyList; at: number };

const CLICK_KEY = "383:perty-click";
/** A click older than this no longer explains an article visit. */
const CLICK_TTL_MS = 30 * 60_000;

export function trackPerty(event: string, params: Record<string, unknown> = {}) {
  track(event, params);
}

/** Records the click and leaves it for the article page to pick up. */
export function noteClick(click: Omit<PertyClick, "at">) {
  trackPerty("perty_click", { slug: click.slug, position: click.position, kind: click.kind, list: click.list });
  try {
    sessionStorage.setItem(CLICK_KEY, JSON.stringify({ ...click, at: Date.now() }));
  } catch {
    // No storage: the read simply is not credited to Për ty.
  }
}

/** The Për ty click that led to this article, if any; read once, then cleared. */
export function takeClick(slug: string): PertyClick | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(CLICK_KEY) ?? "null");
    if (raw?.slug !== slug) return null;
    sessionStorage.removeItem(CLICK_KEY);
    const at = Number(raw?.at);
    if (!Number.isFinite(at) || Date.now() - at > CLICK_TTL_MS) return null;
    return {
      slug,
      position: Number(raw?.position) || 0,
      kind: typeof raw?.kind === "string" ? raw.kind : "",
      list: raw?.list === "more" || raw?.list === "brief" || raw?.list === "section" ? raw.list : "edition",
      at,
    };
  } catch {
    return null;
  }
}
