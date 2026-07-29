const DOMESTIC_LEAGUES = new Set(["eng.1", "esp.1", "ita.1", "ger.1"]);
const TOURNAMENT_LEAGUE = /(?:^|\.)(?:uefa|fifa|concacaf|conmebol|afc|caf)(?:\.|$)|champions|europa|conference|libertadores|sudamericana|world|cup/i;
const LEAGUE_PHASE = /league[\s_-]*phase|group[\s_-]*(?:phase|stage)|groups?/i;
const KNOCKOUT_STAGE = /knockout|play[\s_-]*off|round[\s_-]*of|last[\s_-]*(?:32|16|8)|quarter|semi|final/i;

const clean = (value) => String(value ?? "").trim();
const numeric = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Classifies a fixture without guessing away the draw. Two outcomes are used
 * only when structured metadata proves this match decides who advances.
 */
export function classifyFootballFixture(fixture = {}) {
  const league = clean(fixture.league).toLowerCase();
  const leg = numeric(fixture.leg?.value ?? fixture.leg);
  const seriesMatches = numeric(
    fixture.series?.total_competitions ??
      fixture.series?.totalCompetitions ??
      fixture.series_total_competitions
  );
  const stageText = [
    fixture.stage,
    fixture.stage_slug,
    fixture.season_slug,
    fixture.round,
    fixture.series?.title,
    fixture.series_title,
    fixture.leg?.displayValue,
    fixture.leg_display,
    fixture.note,
  ]
    .map(clean)
    .filter(Boolean)
    .join(" ");
  const explicitKind = clean(fixture.competition_kind).toLowerCase();
  const isDomesticLeague = explicitKind === "league" || DOMESTIC_LEAGUES.has(league);
  const isTournament =
    explicitKind === "tournament" ||
    Boolean(leg) ||
    Boolean(seriesMatches) ||
    TOURNAMENT_LEAGUE.test(`${league} ${stageText}`);
  const isLeaguePhase = LEAGUE_PHASE.test(stageText);
  const isKnockout = !isLeaguePhase && (Boolean(leg) || KNOCKOUT_STAGE.test(stageText));
  const isFinal =
    /(?:^|[\s_-])final(?:s)?(?:$|[\s_-])/i.test(` ${stageText} `) &&
    !/semi[\s_-]*final|quarter[\s_-]*final/i.test(stageText);
  const explicitDecisive =
    fixture.decisive === true ||
    fixture.is_decisive === true ||
    fixture.market_intent === "to_qualify";
  const singleLegKnockout =
    isKnockout &&
    (fixture.single_leg === true || seriesMatches === 1 || (isFinal && leg === null));
  const decisive = Boolean(
    isTournament &&
      isKnockout &&
      (explicitDecisive || leg === 2 || singleLegKnockout)
  );
  const stageKind = isDomesticLeague
    ? "league"
    : isLeaguePhase
      ? "league_phase"
      : isKnockout
        ? "knockout"
        : isTournament
          ? "tournament_phase"
          : "league";
  const stageLabel =
    clean(fixture.series?.title ?? fixture.series_title ?? fixture.stage ?? fixture.season_slug)
      .replaceAll("-", " ") ||
    (stageKind === "league" ? "League match" : "Tournament match");

  return {
    competitionKind: isTournament && !isDomesticLeague ? "tournament" : "league",
    stageKind,
    stageLabel,
    leg: leg === 1 || leg === 2 ? leg : null,
    seriesMatches,
    marketIntent: decisive ? "to_qualify" : "match_result",
    outcomeMode: decisive ? "two_way" : "three_way",
    drawAllowed: !decisive,
    decisive,
    resolutionBasis: decisive
      ? "aggregate_then_extra_time_then_penalties"
      : "regulation_time_90_minutes",
  };
}

export function footballOutcomes(fixture, format = classifyFootballFixture(fixture)) {
  const teamOutcome = (key, team = {}) => ({
    key,
    team: clean(team.name),
    label: clean(team.name),
    color: clean(team.color) ? `#${clean(team.color).replace(/^#/, "")}` : undefined,
    logo: team.logo ?? null,
  });
  const outcomes = [teamOutcome("home", fixture?.home)];
  if (format.drawAllowed) outcomes.push({ key: "draw", label: "Barazim", color: "#7A7A78" });
  outcomes.push(teamOutcome("away", fixture?.away));
  return outcomes;
}

export function footballMarketQuestion(fixture, format = classifyFootballFixture(fixture)) {
  const match = `${clean(fixture?.home?.name)} — ${clean(fixture?.away?.name)}`;
  return format.marketIntent === "to_qualify"
    ? `${match}: kush kualifikohet?`
    : `${match}: rezultati pas 90 minutave?`;
}
