const FLASH_SCORE_WORLD_CUP_URL = "https://www.flashscore.com/football/world/world-championship-2026/";
const ARGENTINA_SPAIN_FLASH_SCORE_URL = "https://www.flashscoreusa.com/game/soccer/argentina-f9OppQjp/spain-bLyo6mco/?mid=UgbUKPmT";
const METRIC_LABELS = new Map([
  ["expected goals", "xg"], ["xg", "xg"], ["shots", "shots"], ["total shots", "shots"],
  ["shots on target", "shots_on_target"], ["on target", "shots_on_target"], ["possession", "possession"],
  ["corner kicks", "corners"], ["corners", "corners"],
]);

function numberFromText(value) {
  const matched = String(value ?? "").replace(",", ".").match(/\d+(?:\.\d+)?/);
  return matched ? Number(matched[0]) : null;
}

function decodeField(value) {
  return String(value ?? "").replace(/\\u002F/g, "/").replace(/&amp;/g, "&");
}

/** Reads only the public competition document; no login, challenge, or private endpoint is used. */
export function findFlashscoreMatch(html, homeTeam, awayTeam) {
  for (const chunk of String(html ?? "").split("~AA÷").slice(1)) {
    const fields = Object.fromEntries([...chunk.slice(0, 4_000).matchAll(/([A-Z]{2,3})÷([^¬]*)/g)].map(([, key, value]) => [key, decodeField(value)]));
    const id = chunk.split("¬", 1)[0];
    if (!/^[A-Za-z0-9]{8}$/.test(id)) continue;
    const teams = [fields.AE, fields.AF].map((team) => String(team ?? "").trim().toLowerCase());
    if (teams.includes(String(homeTeam).toLowerCase()) && teams.includes(String(awayTeam).toLowerCase())) {
      return { id, source_url: `https://www.flashscore.com/match/${id}/`, teams: [fields.AE, fields.AF] };
    }
  }
  return null;
}

/**
 * Flashscore's public HTML sometimes contains a visible stat table. Return only
 * pairs actually present in that document; absent xG deliberately stays absent.
 */
export function parseFlashscoreStats(html, homeTeam, awayTeam) {
  const text = String(html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const metrics = { [homeTeam]: {}, [awayTeam]: {} };
  for (const [label, key] of METRIC_LABELS) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`(\\d+(?:[.,]\\d+)?%?)\\s+${escaped}\\s+(\\d+(?:[.,]\\d+)?%?)`, "i"));
    if (!match) continue;
    const home = numberFromText(match[1]); const away = numberFromText(match[2]);
    if (Number.isFinite(home) && Number.isFinite(away)) {
      metrics[homeTeam][key] = home;
      metrics[awayTeam][key] = away;
    }
  }
  return Object.fromEntries(Object.entries(metrics).filter(([, values]) => Object.keys(values).length));
}

/**
 * Supplemental, non-authoritative metrics for the one mapped ESPN event.
 * A public-page failure is a normal unavailable result, never a fabricated stat.
 */
export async function fetchFlashscoreLiveStats({ eventId, homeTeam, awayTeam, fetchedAt = new Date(), fetchImpl = fetch }) {
  const retrieved_at = new Date(fetchedAt).toISOString();
  const audit = { provider: "flashscore", event_id: String(eventId), source_url: FLASH_SCORE_WORLD_CUP_URL, retrieved_at, availability: "unavailable" };
  if (!["760515", "760517"].includes(String(eventId))) return { metrics: {}, audit: { ...audit, reason: "not_configured_for_event" } };
  try {
    if (String(eventId) === "760517") {
      const detail = await fetchImpl(ARGENTINA_SPAIN_FLASH_SCORE_URL, { headers: { accept: "text/html" }, cache: "no-store", redirect: "follow" });
      if (!detail.ok) return { metrics: {}, audit: { ...audit, source_url: ARGENTINA_SPAIN_FLASH_SCORE_URL, reason: `public_match_http_${detail.status}` } };
      const metrics = parseFlashscoreStats(await detail.text(), homeTeam, awayTeam);
      return { metrics, audit: { ...audit, source_url: ARGENTINA_SPAIN_FLASH_SCORE_URL, availability: Object.keys(metrics).length ? "available" : "unavailable", reason: Object.keys(metrics).length ? undefined : "no_live_metrics_in_public_match_document" } };
    }
    const listing = await fetchImpl(FLASH_SCORE_WORLD_CUP_URL, { headers: { accept: "text/html" }, cache: "no-store", redirect: "follow" });
    if (!listing.ok) return { metrics: {}, audit: { ...audit, reason: `public_listing_http_${listing.status}` } };
    const match = findFlashscoreMatch(await listing.text(), homeTeam, awayTeam);
    if (!match) return { metrics: {}, audit: { ...audit, reason: "matching_public_event_not_found" } };
    const detail = await fetchImpl(match.source_url, { headers: { accept: "text/html" }, cache: "no-store", redirect: "follow" });
    if (!detail.ok) return { metrics: {}, audit: { ...audit, source_url: match.source_url, reason: `public_match_http_${detail.status}` } };
    const metrics = parseFlashscoreStats(await detail.text(), homeTeam, awayTeam);
    return {
      metrics,
      audit: {
        ...audit,
        source_url: match.source_url,
        availability: Object.keys(metrics).length ? "available" : "unavailable",
        reason: Object.keys(metrics).length ? undefined : "no_live_metrics_in_public_match_document",
      },
    };
  } catch (error) {
    return { metrics: {}, audit: { ...audit, reason: `public_access_error:${String(error instanceof Error ? error.message : error).slice(0, 160)}` } };
  }
}

/** Flashscore wins only per metric when its successfully returned observation is at least as fresh as ESPN's. */
export function mergeFlashscoreWithEspn(espnEvent, flashscore) {
  const flashscoreFresh = Date.parse(flashscore?.audit?.retrieved_at ?? "") >= Date.parse(espnEvent?.fetched_at ?? "");
  const metrics = structuredClone(espnEvent.metrics ?? {});
  const metric_sources = Object.fromEntries(Object.entries(metrics).map(([team, values]) => [team, Object.fromEntries(Object.keys(values).map((key) => [key, "espn"]))]));
  if (flashscoreFresh) for (const [team, values] of Object.entries(flashscore?.metrics ?? {})) {
    if (!metrics[team]) metrics[team] = {};
    if (!metric_sources[team]) metric_sources[team] = {};
    for (const [key, value] of Object.entries(values)) {
      if (Number.isFinite(value)) { metrics[team][key] = value; metric_sources[team][key] = "flashscore"; }
    }
  }
  return { ...espnEvent, metrics, metric_sources, supplemental: { flashscore: flashscore.audit } };
}
