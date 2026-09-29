import { normalizeFbkFixture } from './fbk-basketball.mjs';
import { fetchFlashscoreBasketballRows, findFlashscoreGame, flashscoreObservation } from './fbk-flashscore.mjs';
const HOST = 'https://fibalivestats.dcd.shared.geniussports.com';
const normalizeName = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const count = value => value !== null && value !== undefined && value !== '' && /^\d+$/.test(String(value)) ? Number(value) : null;
const fields = {
  tot_sPoints: 'points', tot_sFieldGoalsMade: 'field_goals_made', tot_sFieldGoalsAttempted: 'field_goals_attempted',
  tot_sTwoPointersMade: 'two_pointers_made', tot_sTwoPointersAttempted: 'two_pointers_attempted',
  tot_sThreePointersMade: 'three_pointers_made', tot_sThreePointersAttempted: 'three_pointers_attempted',
  tot_sFreeThrowsMade: 'free_throws_made', tot_sFreeThrowsAttempted: 'free_throws_attempted',
  tot_sAssists: 'assists', tot_sReboundsTotal: 'rebounds', tot_sReboundsOffensive: 'offensive_rebounds',
  tot_sReboundsDefensive: 'defensive_rebounds', tot_sTurnovers: 'turnovers', tot_sSteals: 'steals', tot_sBlocks: 'blocks',
};
export function liveStatsMetrics(team) {
  const values = Object.fromEntries(Object.entries(fields).flatMap(([source, target]) => count(team?.[source]) === null ? [] : [[target, count(team[source])]]));
  for (const kind of ['field_goals', 'two_pointers', 'three_pointers', 'free_throws']) {
    if (values[`${kind}_made`] > values[`${kind}_attempted`]) {
      delete values[`${kind}_made`]; delete values[`${kind}_attempted`];
    }
  }
  return values;
}

/** Separate score telemetry from competition completion; both are observed feeds. */
export function normalizeLinkedLiveStats(fixture, { matchId, competitionName, matches, data, updatedAt }, now = new Date()) {
  const fallback = normalizeFbkFixture(fixture, now);
  const unavailable = (reason, base = fallback) => ({ ...base, supplemental: { fbk: { ...base.supplemental.fbk, availability: 'unverified_livestats', reason } } });
  if (!/superlig|super league/i.test(competitionName) || /women|femr|supercup|u\s*\d{2}/i.test(competitionName)) return unavailable('competition_mismatch');
  const match = (Array.isArray(matches) ? matches : []).find(row => String(row.matchId) === String(matchId));
  if (!match) return unavailable('match_identity_unavailable');
  const matchTime = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(match.matchTimeUTC ?? '') ? Date.parse(match.matchTimeUTC.replace(' ', 'T') + 'Z') : NaN;
  if (!Number.isFinite(matchTime) || Math.abs(matchTime - Date.parse(fixture.kickoff)) > 5 * 60000) return unavailable('fixture_time_mismatch');
  const home = data?.tm?.['1'], away = data?.tm?.['2'];
  if (![ [home?.name, fixture.home_team], [away?.name, fixture.away_team], [match.homename, fixture.home_team], [match.awayname, fixture.away_team] ].every(([a,b]) => a && normalizeName(a) === normalizeName(b))) return unavailable('team_identity_mismatch');
  const homeScore = count(home.score), awayScore = count(away.score);
  if (homeScore === null || awayScore === null || homeScore !== count(match.homescore) || awayScore !== count(match.awayscore)) return unavailable('score_feeds_disagree');
  const clock = String(data.clock ?? '').match(/^(\d{1,2}):([0-5]\d)$/);
  const period = count(data.period);
  const seconds = clock ? Number(clock[1]) * 60 + Number(clock[2]) : null;
  const completed = match.matchStatus === 'COMPLETE';
  const fresh = Number.isFinite(Date.parse(updatedAt)) && now.getTime() - Date.parse(updatedAt) >= -60000 && now.getTime() - Date.parse(updatedAt) <= 180000;
  // Official federation scores corroborate the final result. A clock alone is
  // never completion evidence, including in overtime.
  const confirmedFinal = completed && homeScore !== awayScore && fixture.home_score === homeScore && fixture.away_score === awayScore;
  const active = match.live === 1 && !completed && fresh && period >= 1 && seconds !== null && seconds <= (period > 4 ? 300 : 600);
  const sourceUrl = `${HOST}/data/${matchId}/data.json`;
  // A federation final settles unless a readable LiveStats feed contradicts it.
  if (!confirmedFinal && !active && fallback.status === 'STATUS_FINAL') {
    if (homeScore !== fixture.home_score || awayScore !== fixture.away_score) return unavailable('federation_livestats_disagree', normalizeFbkFixture(fixture, now, { allowFinal: false }));
    return { ...fallback, metrics: { [fixture.home_team]: liveStatsMetrics(home), [fixture.away_team]: liveStatsMetrics(away) }, metric_sources: { provider: 'FIBA LiveStats', source_url: sourceUrl, updated_at: updatedAt ?? null } };
  }
  return {
    ...fallback, status: confirmedFinal ? 'STATUS_FINAL' : active ? 'STATUS_IN_PROGRESS' : fallback.status,
    detail: confirmedFinal ? 'Përfunduar — FBK / LiveStats' : active ? `Q${period} ${data.clock}` : fallback.detail,
    period, clock_seconds: seconds, has_official_score: confirmedFinal || active,
    source_updated_at: updatedAt ?? null,
    competitors: [{ team: fixture.home_team, homeAway: 'home', score: homeScore }, { team: fixture.away_team, homeAway: 'away', score: awayScore }],
    metrics: { [fixture.home_team]: liveStatsMetrics(home), [fixture.away_team]: liveStatsMetrics(away) },
    metric_sources: { provider: 'FIBA LiveStats', source_url: sourceUrl, updated_at: updatedAt ?? null },
    supplemental: { fbk: { availability: confirmedFinal ? 'verified_final' : active ? 'live' : 'stats_only', live_stats_url: fixture.live_stats_url, source_url: sourceUrl, match_id: String(matchId), competition: competitionName, completion_status: match.matchStatus } },
  };
}

/**
 * FIBA LiveStats competition for the Kosovo men's Superliga — "ProCredit
 * Superliga 2026-2027" (read from game 2920347's page on 2026-09-26). It changes
 * each season, hence the environment override.
 */
export const FBK_SUPERLIGA_COMPETITION_ID = process.env.FBK_LIVESTATS_COMPETITION_ID || '50054';

/**
 * The LiveStats game for a federation fixture, found in the competition's own
 * match list by both team names and a kickoff within five minutes.
 *
 * The federation site (basketbolli.com) almost never publishes a LiveStats link,
 * so live_stats_url stayed null and every Superliga market ran on
 * schedule_only data: no score, no clock, and odds frozen at the pre-match
 * price. The competition feed lists every game of the round with its match id,
 * so the link no longer has to come from the federation.
 */
export function findLiveStatsMatch(fixture, matches) {
  const kickoff = Date.parse(fixture?.kickoff ?? '');
  if (!Number.isFinite(kickoff)) return null;
  const home = normalizeName(fixture.home_team), away = normalizeName(fixture.away_team);
  const found = (Array.isArray(matches) ? matches : []).filter(row => {
    const at = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(row?.matchTimeUTC ?? '') ? Date.parse(row.matchTimeUTC.replace(' ', 'T') + 'Z') : NaN;
    return normalizeName(row?.homename) === home && normalizeName(row?.awayname) === away && Number.isFinite(at) && Math.abs(at - kickoff) <= 5 * 60000;
  });
  // Two candidates means the identity is ambiguous; guessing would price the wrong game.
  return found.length === 1 ? found[0] : null;
}

async function discoverLiveStatsUrl(fixture, fetchImpl) {
  const response = await fetchImpl(`${HOST}/data/competition/${FBK_SUPERLIGA_COMPETITION_ID}.json`, { signal: AbortSignal.timeout(12000), cache: 'no-store', redirect: 'error' });
  if (!response.ok) throw new Error(`FBK LiveStats competition: ${response.status}`);
  const match = findLiveStatsMatch(fixture, await response.json());
  return match ? `${HOST}/u/KOS/${match.matchId}/` : null;
}

/**
 * One Superliga game's live state: FIBA LiveStats when the federation runs it
 * for that game (score and clock), else Flashscore's score once the game has
 * started (fbk-flashscore.mjs), else the schedule. A federation final always
 * wins, because settlement answers to the federation alone.
 */
export async function fetchLinkedFbkLiveStats(fixture, { now = new Date(), fetchImpl = fetch, flashscoreRows } = {}) {
  const observed = await fetchLiveStatsObservation(fixture, { now, fetchImpl }).catch((error) => ({ error }));
  if (!observed.error && ['STATUS_IN_PROGRESS', 'STATUS_FINAL'].includes(observed.status)) return observed;
  if (Date.parse(fixture.kickoff) <= now.getTime()) {
    try {
      const rows = flashscoreRows ?? await fetchFlashscoreBasketballRows({ fetchImpl, now: now.getTime() });
      const fallback = flashscoreObservation(fixture, findFlashscoreGame(fixture, rows), now);
      if (fallback) return fallback;
    } catch {
      // Flashscore is a fallback; its outage leaves the LiveStats answer standing.
    }
  }
  if (observed.error) throw observed.error;
  return observed;
}

async function fetchLiveStatsObservation(fixture, { now, fetchImpl }) {
  const liveStatsUrl = fixture.live_stats_url || await discoverLiveStatsUrl(fixture, fetchImpl);
  if (!liveStatsUrl) return normalizeFbkFixture(fixture, now);
  fixture = { ...fixture, live_stats_url: liveStatsUrl };
  const link = new URL(liveStatsUrl);
  const matchId = link.pathname.match(/^\/(?:u|webcast)\/KOS\/(\d+)\//)?.[1];
  if (link.origin !== HOST || !matchId) return normalizeFbkFixture(fixture, now);
  const read = async url => {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(12000), cache: 'no-store', redirect: 'error' });
    if (!response.ok) throw new Error(`FBK LiveStats: ${response.status}`);
    return response;
  };
  const page = await (await read(link.href)).text();
  const compId = page.match(/id\s*=\s*["']compId["']\s+value\s*=\s*["'](\d+)["']/)?.[1];
  const competitionName = page.match(/<span[^>]*id=["']competitionName["'][^>]*>([^<]+)<\/span>/)?.[1] ?? '';
  if (!compId) return normalizeFbkFixture(fixture, now);
  // A game's data.json answers 403 until tip-off. That is "not started", not a
  // feed failure, so the market keeps its schedule state quietly.
  const dataResponse = await fetchImpl(`${HOST}/data/${matchId}/data.json`, { signal: AbortSignal.timeout(12000), cache: 'no-store', redirect: 'error' });
  if (dataResponse.status === 403 || dataResponse.status === 404) return normalizeFbkFixture(fixture, now);
  if (!dataResponse.ok) throw new Error(`FBK LiveStats: ${dataResponse.status}`);
  const matchesResponse = await read(`${HOST}/data/competition/${compId}.json`);
  return normalizeLinkedLiveStats(fixture, { matchId, competitionName, data: await dataResponse.json(), matches: await matchesResponse.json(), updatedAt: dataResponse.headers.get('last-modified') }, now);
}
