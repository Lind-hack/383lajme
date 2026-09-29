/**
 * Live scores for Kosovo Superliga games that FIBA LiveStats does not cover.
 *
 * LiveStats only lists the games the federation runs its stat crew at (on
 * 2026-09-29 its competition feed held one game of the season), so every
 * other Superliga market sat at its pre-match price for the whole game.
 * Flashscore's public competition page lists every game with its status and
 * per-quarter scores. It gives no game clock, so the clock is estimated
 * conservatively (half a quarter left), which keeps odds moving with the
 * score without claiming precision the source does not have.
 *
 * This is a price signal only. Settlement still waits for the federation's
 * published final (normalizeFbkFixture); a Flashscore "finished" game stays
 * STATUS_IN_PROGRESS at zero seconds until then.
 */
import { normalizeFbkFixture } from "./fbk-basketball.mjs";

export const FBK_FLASHSCORE_URL = "https://www.flashscore.com/basketball/kosovo/superliga/";
const CACHE_MS = 60_000;
/** Home/away score fields per quarter, then overtime. */
const PERIOD_FIELDS = [["BA", "BB"], ["BC", "BD"], ["BE", "BF"], ["BG", "BH"], ["BI", "BJ"]];

const normalizeName = (value) => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const integer = (value) => (/^\d+$/.test(String(value ?? "")) ? Number(value) : null);

/** Every game on the competition page: identity, status, scores, period. */
export function parseFlashscoreBasketball(html) {
  const rows = [];
  for (const chunk of String(html ?? "").split("~AA÷").slice(1)) {
    const id = chunk.split("¬", 1)[0];
    if (!/^[A-Za-z0-9]{8}$/.test(id)) continue;
    const fields = Object.fromEntries([...chunk.slice(0, 4000).matchAll(/([A-Z]{2,3})÷([^¬]*)/g)].map(([, key, value]) => [key, value]));
    const kickoff = integer(fields.AD);
    if (!fields.AE || !fields.AF || kickoff === null) continue;
    const period = PERIOD_FIELDS.filter(([home]) => integer(fields[home]) !== null).length;
    rows.push({
      id,
      home: fields.AE,
      away: fields.AF,
      kickoff: kickoff * 1000,
      // AB: 1 scheduled, 2 live, 3 finished.
      status: fields.AB === "2" ? "live" : fields.AB === "3" ? "finished" : "scheduled",
      home_score: integer(fields.AG),
      away_score: integer(fields.AH),
      period,
    });
  }
  return rows;
}

/** Names match after folding accents and punctuation; one may carry a suffix ("Rahoveci 029"). */
function sameTeam(a, b) {
  const x = normalizeName(a), y = normalizeName(b);
  return Boolean(x && y) && (x === y || (Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x))));
}

/** The one Flashscore game for a federation fixture: both teams and a kickoff within 15 minutes. */
export function findFlashscoreGame(fixture, rows) {
  const kickoff = Date.parse(fixture?.kickoff ?? "");
  if (!Number.isFinite(kickoff)) return null;
  const found = (rows ?? []).filter((row) =>
    sameTeam(row.home, fixture.home_team) && sameTeam(row.away, fixture.away_team) && Math.abs(row.kickoff - kickoff) <= 15 * 60_000);
  // Two candidates means the identity is ambiguous; guessing would price the wrong game.
  return found.length === 1 ? found[0] : null;
}

/** A priced observation from a Flashscore row, or null when it says nothing new. */
export function flashscoreObservation(fixture, row, now = new Date()) {
  if (!row || row.status === "scheduled" || row.home_score === null || row.away_score === null) return null;
  const base = normalizeFbkFixture(fixture, now);
  if (base.status === "STATUS_FINAL") return null;
  const finished = row.status === "finished";
  const period = Math.max(1, Math.min(5, row.period || 1));
  const sourceUrl = `https://www.flashscore.com/match/${row.id}/`;
  return {
    ...base,
    status: "STATUS_IN_PROGRESS",
    detail: finished ? "Përfundoi · pret rezultatin zyrtar të FBK" : `Q${period > 4 ? "OT" : period} · Flashscore`,
    period: finished ? Math.max(4, period) : period,
    clock_seconds: finished ? 0 : period > 4 ? 150 : 300,
    has_official_score: true,
    source_label: "Flashscore",
    source_url: sourceUrl,
    competitors: [
      { team: fixture.home_team, homeAway: "home", score: row.home_score },
      { team: fixture.away_team, homeAway: "away", score: row.away_score },
    ],
    supplemental: { fbk: { ...base.supplemental.fbk, availability: finished ? "flashscore_finished" : "flashscore_live", flashscore_id: row.id } },
  };
}

let cache = { at: 0, rows: null };

/** The competition page, read at most once a minute across all games. */
export async function fetchFlashscoreBasketballRows({ fetchImpl = fetch, now = Date.now() } = {}) {
  if (cache.rows && now - cache.at < CACHE_MS) return cache.rows;
  const response = await fetchImpl(FBK_FLASHSCORE_URL, {
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; 383ks.com live odds)", "Accept-Language": "en" },
  });
  if (!response.ok) throw new Error(`Flashscore Kosovo Superliga: ${response.status}`);
  const rows = parseFlashscoreBasketball(await response.text());
  cache = { at: now, rows };
  return rows;
}

/** Test hook: forget the cached page. */
export function resetFlashscoreCache() {
  cache = { at: 0, rows: null };
}
