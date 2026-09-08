import { americanOddsToProbability } from "./football-pre-match.mjs";
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
  return Math.max(.000001, Math.min(.999999, 1 / (1 + Math.exp(-(1.7 * difference / uncertainty + priorLogit * earlyWeight)))));
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
      const odds = competition.odds?.[0]?.moneyline;
      const readOdds = node => americanOddsToProbability(node?.close?.odds ?? node?.open?.odds ?? node?.odds ?? node);
      const hp = readOdds(odds?.home), ap = readOdds(odds?.away);
      const homeProbability = hp && ap ? hp / (hp + ap) : .5;
      const awayProbability = 1-homeProbability;
      return [{ slug: `basketball-${league.replaceAll(".", "-")}-${event.id}`, question: `${home.displayName} — ${away.displayName}: kush fiton?`, category: "sport", status: "open", market_type: "two_outcome", market_classification: "live_basketball", b, outcomes: ["home", "away"], sport_outcomes: outcomes, outcome_quantities: { home: b * Math.log(homeProbability), away: b * Math.log(awayProbability) }, reference_probabilities: { home: homeProbability, away: awayProbability }, pre_match_analysis: { opening_model: { probabilities: { home: homeProbability, away: awayProbability }, source_url: url, method: hp && ap ? "Normalized provider moneyline" : "Neutral prior: provider moneyline unavailable" } }, closes_at: new Date(start + 6 * 3600000).toISOString(), resolution_source: "ESPN", resolution_rules: "Fituesi zyrtar, duke përfshirë kohën shtesë. Nuk ka barazim.", live_event: { provider: "espn", event_id: String(event.id), league, sport: "basketball", home_team: home.displayName, away_team: away.displayName, kickoff: new Date(start).toISOString(), source_url: url } }];
    });
  }));
  if (results.every(r => r.status === "rejected")) throw new Error("Basketball schedules unavailable");
  return results.flatMap(r => r.status === "fulfilled" ? r.value : []);
}
