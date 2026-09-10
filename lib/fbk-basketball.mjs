import { createHash } from "node:crypto";
import { KOSOVO_TIME_ZONE } from "./tregu-local-time.mjs";

const ORIGIN = "https://www.basketbolli.com";
const decode = value => String(value).replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => String.fromCodePoint(code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code))).replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim();

/** The federation changes league IDs each season. Follow its Superliga link. */
export function findFbkLeagueUrl(html) {
  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    if (decode(match[2].replace(/<[^>]+>/g, "")).toUpperCase() !== "PROCREDIT SUPERLIGA") continue;
    const url = new URL(decode(match[1]), ORIGIN);
    if (url.origin === ORIGIN && url.pathname === "/Results" && /^\d+$/.test(url.searchParams.get("leagueId") ?? "")) return url.href;
  }
  throw new Error("FBK current men's Superliga link unavailable");
}

/** Convert published Kosovo wall time, rejecting invalid and ambiguous dates. */
export function fbkKickoff(value) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match.map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: KOSOVO_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const candidates = [1, 2].map(offset => new Date(wall - offset * 3600000)).filter(date => {
    const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
    return Number(parts.year) === year && Number(parts.month) === month && Number(parts.day) === day && Number(parts.hour) === hour && Number(parts.minute) === minute;
  });
  return candidates.length === 1 ? candidates[0].toISOString() : null;
}

/** Parse only published fixtures; empty score cells do not mean a 0–0 final. */
export function parseFbkFixtures(html, sourceUrl) {
  const leagueId = new URL(sourceUrl).searchParams.get("leagueId");
  if (!/^\d+$/.test(leagueId ?? "")) throw new Error("FBK league ID missing");
  const fixtures = [];
  const seen = new Set();
  for (const section of html.split(/<section\b/i).slice(1)) {
    const round = decode(section.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]?.replace(/<[^>]+>/g, "") ?? "");
    if (!round) continue;
    for (const block of section.split(/class="match-row"/i).slice(1)) {
      const names = [...block.matchAll(/<h4\b[^>]*class="team-name"[^>]*>([^<]*)<\/h4>/gi)].slice(0, 2).map(m => decode(m[1]));
      const date = block.match(/\b\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\b/)?.[0];
      const kickoff = date ? fbkKickoff(date) : null;
      if (names.length !== 2 || names.some(name => !name) || names[0] === names[1] || !kickoff) continue;
      // Round + pairing survives a rescheduled tip-off without duplicating markets.
      const eventId = `fbk-${leagueId}-${createHash("sha256").update(JSON.stringify([round, ...names])).digest("hex").slice(0, 20)}`;
      if (seen.has(eventId)) continue;
      seen.add(eventId);
      const scores = [...block.matchAll(/<h4\b[^>]*class="team-score"[^>]*>([^<]*)<\/h4>/gi)].slice(0, 2).map(m => /^\d+$/.test(m[1].trim()) ? Number(m[1].trim()) : null);
      const liveLink = [...block.matchAll(/href="([^"]+)"/gi)].map(m => decode(m[1])).find(href => /^https:\/\/(?:fibalivestats\.(?:dcd\.shared\.)?geniussports\.com|www\.fibalivestats\.com)\//i.test(href)) ?? null;
      fixtures.push({ provider: "fbk", event_id: eventId, league: "fbk.kosovo", sport: "basketball", round, home_team: names[0], away_team: names[1], kickoff, source_url: sourceUrl, home_score: scores[0] ?? null, away_score: scores[1] ?? null, live_stats_url: liveLink });
    }
  }
  return fixtures;
}

export function parseFbkStandings(html) {
  return html.split(/class="full-width-row-wrapper"/).slice(1).flatMap(block => {
    const team = decode(block.match(/<h5[^>]*>([^<]+)<\/h5>/)?.[1] ?? "");
    const numbers = [...block.matchAll(/class="uppercase-paragraph table-paragraph"[^>]*>\s*(-?\d+)\s*<\/p>/g)].map(m => Number(m[1]));
    if (!team || numbers.length !== 7) return [];
    const [played, wins, losses, scored, conceded] = numbers;
    if (played < 0 || wins < 0 || losses < 0 || wins + losses !== played || scored < 0 || conceded < 0) return [];
    return [{ team, played, wins, losses, scored, conceded }];
  });
}

/** Smoothed log5 estimate, explicitly distinct from a provider moneyline. */
export function fbkOpeningModel(event, standings) {
  const home = standings.find(row => row.team === event.home_team);
  const away = standings.find(row => row.team === event.away_team);
  if (!home?.played || !away?.played) return { probabilities: { home: .5, away: .5 }, source_url: event.source_url, method: "Neutral prior: provider moneyline unavailable" };
  // Two prior wins/losses per team keep short-season records from becoming certainties.
  const h = (home.wins + 2) / (home.played + 4);
  const a = (away.wins + 2) / (away.played + 4);
  const probability = Math.max(.03, Math.min(.97, h * (1 - a) / (h * (1 - a) + a * (1 - h))));
  return { probabilities: { home: probability, away: 1 - probability }, source_url: event.source_url,
    method: "FBK standings: smoothed log5 estimate; not bookmaker odds", inputs: { home, away } };
}

export async function fetchFbkFixtures({ fetchImpl = fetch } = {}) {
  const read = async url => {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(12000), cache: "no-store" });
    if (!response.ok) throw new Error(`FBK schedule: ${response.status}`);
    return response.text();
  };
  const sourceUrl = findFbkLeagueUrl(await read(ORIGIN));
  const html = await read(sourceUrl);
  const standings = parseFbkStandings(html);
  return parseFbkFixtures(html, sourceUrl).map(event => ({ ...event, opening_model: fbkOpeningModel(event, standings) }));
}

export function buildFbkMarkets(fixtures, { now = new Date(), horizonDays = 3 } = {}) {
  return fixtures.filter(event => {
    const start = Date.parse(event.kickoff);
    return start > now.getTime() && start <= now.getTime() + horizonDays * 86400000
      && event.home_score === null && event.away_score === null;
  }).map(event => {
    const b = 6500;
    const opening = event.opening_model ?? fbkOpeningModel(event, []);
    const probabilities = opening.probabilities;
    return {
      slug: `basketball-${event.event_id}`,
      question: `${event.home_team} — ${event.away_team}: kush fiton?`,
      category: "sport", status: "open", market_type: "two_outcome",
      market_classification: "live_basketball", b, outcomes: ["home", "away"],
      sport_outcomes: [{ key: "home", label: event.home_team, team: event.home_team }, { key: "away", label: event.away_team, team: event.away_team }],
      outcome_quantities: { home: b * Math.log(probabilities.home), away: b * Math.log(probabilities.away) },
      reference_probabilities: probabilities,
      pre_match_analysis: { opening_model: opening },
      closes_at: new Date(Date.parse(event.kickoff) + 6 * 3600000).toISOString(),
      resolution_source: "Federata e Basketbollit të Kosovës / FIBA LiveStats",
      resolution_rules: "Fituesi zyrtar, përfshirë kohën shtesë. Nuk ka barazim. Rezultati i përkohshëm nuk zgjidh tregun.",
      live_event: { provider: "fbk", event_id: event.event_id, league: "fbk.kosovo", sport: "basketball", yes_team: event.home_team, home_team: event.home_team, away_team: event.away_team, kickoff: event.kickoff, source_url: event.source_url, live_stats_url: event.live_stats_url },
    };
  });
}

/** A fixture page supplies schedule/score observations, not a confirmed game clock or final. */
export function normalizeFbkFixture(event, now = new Date()) {
  const scheduled = Date.parse(event.kickoff) > now.getTime();
  return {
    provider: "fbk", event_id: event.event_id, league: "fbk.kosovo", sport: "basketball",
    kickoff: event.kickoff, source_url: event.source_url,
    status: scheduled ? "STATUS_SCHEDULED" : "STATUS_FEED_UNAVAILABLE",
    detail: scheduled ? "Ndeshje e planifikuar" : "Në pritje të konfirmimit zyrtar drejtpërdrejt",
    has_official_score: false, metrics: {},
    competitors: [{ team: event.home_team, homeAway: "home", score: null }, { team: event.away_team, homeAway: "away", score: null }],
    supplemental: { fbk: { availability: "schedule_only", live_stats_url: event.live_stats_url, observed_scores: { home: event.home_score, away: event.away_score } } },
  };
}
