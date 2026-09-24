import { basketballOpeningModel } from "./basketball-opening.mjs";
/** Clock/score model for regulation and overtime. All odds are estimates. */
export function basketballWinProbability(event, prior = 0.5) {
  const home = event.competitors?.find(t => t.homeAway === "home") ?? event.competitors?.[0];
  const away = event.competitors?.find(t => t.homeAway === "away") ?? event.competitors?.[1];
  if (!home || !away || !Number.isFinite(event.clock_seconds) || !Number.isFinite(event.period)) return prior;
  const quarterSeconds = event.league === "nba" ? 720 : 600;
  const remaining = Math.max(0, 4 - event.period) * quarterSeconds + Math.max(0, event.clock_seconds);
  const difference = Number(home.score) - Number(away.score);
  if (!Number.isFinite(difference)) return prior;
  const earlyWeight = Math.min(1, remaining / (quarterSeconds * 4));
  const priorLogit = Math.log(Math.max(.001, prior) / Math.max(.001, 1 - prior));
  // Residual scoring variance declines with time; a tied clock at zero still
  // goes to overtime and must never be settled as a draw by this model.
  const uncertainty = Math.sqrt(1 + remaining * .14);
  const base = 1 / (1 + Math.exp(-(1.7 * difference / uncertainty + priorLogit * earlyWeight)));
  const pressure = basketballStatPressure(event.metrics?.[home.team], event.metrics?.[away.team]) * earlyWeight;
  return Math.max(.000001, Math.min(.999999, base + pressure));
}

/**
 * The score already holds every point scored. What it hides is process: a team
 * shooting better, owning the offensive glass and protecting the ball tends to
 * keep outscoring. Bounded to four points either way and scaled by the time
 * left by the caller, so the scoreboard always dominates and the effect is
 * zero at the horn. Returns a probability shift for the home side.
 */
export function basketballStatPressure(home, away) {
  const number = value => Number.isFinite(Number(value)) ? Number(value) : null;
  if (!home || !away) return 0;
  const fgaH = number(home.field_goals_attempted), fgaA = number(away.field_goals_attempted);
  let signal = 0;
  if (fgaH >= 10 && fgaA >= 10) {
    const efg = (row, fga) => ((number(row.field_goals_made) ?? 0) + .5 * (number(row.three_pointers_made) ?? 0)) / fga;
    signal += (efg(home, fgaH) - efg(away, fgaA)) * .25;
    const ftRate = (row, fga) => (number(row.free_throws_attempted) ?? 0) / fga;
    signal += (ftRate(home, fgaH) - ftRate(away, fgaA)) * .05;
  }
  const margin = key => {
    const a = number(home[key]), b = number(away[key]);
    return a === null || b === null ? 0 : a - b;
  };
  signal += margin("offensive_rebounds") * .004 + margin("rebounds") * .002 - margin("turnovers") * .004;
  return Math.max(-.04, Math.min(.04, signal));
}

export async function discoverBasketball({ now = new Date(), fetchImpl = fetch } = {}) {
  const end = new Date(now.getTime() + 72 * 3600000);
  const dates = `${now.toISOString().slice(0, 10).replaceAll("-", "")}-${end.toISOString().slice(0, 10).replaceAll("-", "")}`;
  const results = await Promise.allSettled(["nba", "fiba.world"].map(async league => {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/${league}/scoreboard?dates=${dates}&limit=100`;
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(12000), cache: "no-store" });
    if (!response.ok) throw new Error(`ESPN ${league}: ${response.status}`);
    const body = await response.json();
    return (body.events ?? []).flatMap(event => {
      const competition = event.competitions?.[0];
      const start = Date.parse(event.date);
      if (!event.id || !Number.isFinite(start) || start <= now.getTime() || start > end.getTime() || competition?.status?.type?.state !== "pre") return [];
      const home = competition.competitors?.find(t => t.homeAway === "home")?.team;
      const away = competition.competitors?.find(t => t.homeAway === "away")?.team;
      if (!home?.displayName || !away?.displayName) return [];
      const outcomes = [{ key: "home", label: home.displayName, team: home.displayName, logo: home.logo }, { key: "away", label: away.displayName, team: away.displayName, logo: away.logo }];
      const b = 6500;
      const openingModel = basketballOpeningModel(competition, url);
      const homeProbability = openingModel.probabilities.home;
      const awayProbability = 1-homeProbability;
      return [{ slug: `basketball-${league.replaceAll(".", "-")}-${event.id}`, question: `${home.displayName} — ${away.displayName}: kush fiton?`, category: "sport", status: "open", market_type: "two_outcome", market_classification: "live_basketball", b, outcomes: ["home", "away"], sport_outcomes: outcomes, outcome_quantities: { home: b * Math.log(homeProbability), away: b * Math.log(awayProbability) }, reference_probabilities: { home: homeProbability, away: awayProbability }, pre_match_analysis: { opening_model: openingModel }, closes_at: new Date(start + 6 * 3600000).toISOString(), resolution_source: "ESPN", resolution_rules: "Fituesi zyrtar, duke përfshirë kohën shtesë. Nuk ka barazim.", live_event: { provider: "espn", event_id: String(event.id), league, sport: "basketball", yes_team: home.displayName, home_team: home.displayName, away_team: away.displayName, kickoff: new Date(start).toISOString(), source_url: url } }];
    });
  }));
  if (results.every(r => r.status === "rejected")) throw new Error("Basketball schedules unavailable");
  return results.flatMap(r => r.status === "fulfilled" ? r.value : []);
}
