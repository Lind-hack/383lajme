import {
  classifyFootballFixture,
  footballMarketQuestion,
  footballOutcomes,
} from "./football-market-format.mjs";
import {
  buildFootballOpeningModel,
  outcomeQuantitiesFromProbabilities,
} from "./football-pre-match.mjs";
import { DEFAULT_SPORT_LIQUIDITY } from "./tregu-liquidity.mjs";

const LEAGUES = [
  { id: "eng.1", label: "Premier League" },
  { id: "esp.1", label: "La Liga" },
  { id: "ita.1", label: "Serie A" },
  { id: "ger.1", label: "Bundesliga" },
  { id: "uefa.champions", label: "UEFA Champions League" },
  { id: "uefa.europa", label: "UEFA Europa League" },
  { id: "uefa.europa.conf", label: "UEFA Conference League" },
];

const day = (date) => date.toISOString().slice(0, 10).replaceAll("-", "");
const teamFrom = (competitor) => ({
  id: String(competitor?.team?.id ?? competitor?.id ?? ""),
  name: String(competitor?.team?.displayName ?? ""),
  code: String(competitor?.team?.abbreviation ?? ""),
  logo: competitor?.team?.logo ?? null,
  color: competitor?.team?.color ?? null,
  form: typeof competitor?.form === "string" ? competitor.form : null,
  records: Array.isArray(competitor?.records) ? competitor.records : [],
  aggregate_score: Number.isFinite(Number(competitor?.aggregateScore))
    ? Number(competitor.aggregateScore)
    : null,
});

const normalizeFixture = (event, source_url = null, fetched_at = null) => {
  const competition = event.competitions?.[0];
  const teams = competition?.competitors ?? [];
  const home = teams.find((team) => team.homeAway === "home");
  const away = teams.find((team) => team.homeAway === "away");
  if (!competition || !home?.team || !away?.team || !event.id || !event.date) return null;
  const bookmaker = competition.odds?.find((candidate) => candidate?.moneyline?.home && candidate?.moneyline?.away);
  return {
    event_id: String(event.id),
    source_url,
    fetched_at,
    bookmaker_odds: bookmaker
      ? {
          provider: String(bookmaker.provider?.displayName ?? bookmaker.provider?.name ?? "unknown"),
          source_url,
          moneyline: bookmaker.moneyline,
        }
      : null,
    kickoff: new Date(event.date).toISOString(),
    season_slug: event.season?.slug ?? null,
    stage: event.season?.slug ?? competition.series?.title ?? null,
    leg: competition.leg
      ? {
          value: Number(competition.leg.value),
          displayValue: String(competition.leg.displayValue ?? ""),
        }
      : null,
    series: competition.series
      ? {
          title: String(competition.series.title ?? ""),
          total_competitions: Number(competition.series.totalCompetitions ?? 0) || null,
        }
      : null,
    note: String(competition.notes?.[0]?.headline ?? competition.altGameNote ?? ""),
    home: teamFrom(home),
    away: teamFrom(away),
  };
};

export const FOOTBALL_LEAGUES = LEAGUES;

export async function fetchUpcomingEspnFootballFixtures({
  now = new Date(),
  windowHours = 72,
  fetchImpl = fetch,
} = {}) {
  const end = new Date(now.getTime() + windowHours * 3_600_000);
  const dates = [
    ...new Set(
      Array.from({ length: 5 }, (_, index) =>
        day(new Date(now.getTime() + index * 86_400_000))
      )
    ),
  ];
  const all = [];
  const requests = LEAGUES.flatMap((league) =>
    dates.map(async (date) => {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.id}/scoreboard?dates=${date}`;
      const response = await fetchImpl(url, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`ESPN ${league.id} ${response.status}`);
      const body = await response.json();
      return { league, url, events: body.events ?? [] };
    })
  );
  const responses = await Promise.allSettled(requests);
  const successful = responses.flatMap((response) =>
    response.status === "fulfilled" ? [response.value] : []
  );
  if (successful.length === 0) {
    throw new Error("ESPN football discovery returned no usable competition responses.");
  }
  for (const { league, url, events } of successful) {
    for (const raw of events) {
      const fixture = normalizeFixture(raw, url, now.toISOString());
      if (!fixture) continue;
      const start = new Date(fixture.kickoff);
      if (start > now && start <= end) {
        all.push({
          ...fixture,
          league: league.id,
          league_label: league.label,
          source_url: url,
        });
      }
    }
  }
  return [...new Map(all.map((fixture) => [fixture.event_id, fixture])).values()].sort(
    (a, b) => a.kickoff.localeCompare(b.kickoff)
  );
}

export function buildUpcomingFootballTemplate(fixture) {
  const slug = `football-${fixture.league}-${fixture.event_id}`.replace(/[^a-z0-9-]/g, "-");
  const footballFormat = classifyFootballFixture(fixture);
  const sportOutcomes = footballOutcomes(fixture, footballFormat);
  const outcomeKeys = sportOutcomes.map(({ key }) => key);
  const openingModel = buildFootballOpeningModel(fixture, { outcomeKeys });
  const probabilities = openingModel.probabilities;
  const quantities = outcomeQuantitiesFromProbabilities(probabilities, DEFAULT_SPORT_LIQUIDITY);
  const resolutionRules =
    footballFormat.marketIntent === "to_qualify"
      ? "Zgjidhet nga skuadra që kualifikohet sipas rezultatit të përgjithshëm (aggregate); në barazim vlejnë koha shtesë dhe penalltitë zyrtare."
      : "Zgjidhet nga rezultati zyrtar pas 90 minutave plus shtesën e rregullt. Koha shtesë dhe penalltitë nuk përfshihen.";

  return {
    slug,
    question: footballMarketQuestion(fixture, footballFormat),
    description: `Treg live për ${fixture.league_label}; gjasat rifreskohen gjatë ndeshjes.`,
    category: "sport",
    status: "open",
    market_type: footballFormat.outcomeMode === "two_way" ? "two_outcome" : "three_outcome",
    market_classification: "live_football",
    outcomes: outcomeKeys,
    closes_at: fixture.kickoff,
    resolution_rules: resolutionRules,
    resolution_source: "Rezultati zyrtar i ndeshjes",
    live_event: {
      provider: "espn",
      event_id: fixture.event_id,
      league: fixture.league,
      kickoff: fixture.kickoff,
      home_team: fixture.home.name,
      away_team: fixture.away.name,
      yes_team: fixture.home.name,
      source_url: fixture.source_url,
      football_format: footballFormat,
      pre_match_model_version: openingModel.model_version,
      stage: fixture.stage ?? fixture.season_slug ?? null,
      leg: footballFormat.leg,
      series: fixture.series ?? null,
    },
    sport_outcomes: sportOutcomes,
    reference_probabilities: probabilities,
    outcome_quantities: quantities,
    b: DEFAULT_SPORT_LIQUIDITY,
    pre_match_analysis: {
      source: "espn",
      fixture,
      football_format: footballFormat,
      opening_model: openingModel,
      created_by: "upcoming_football_template",
    },
  };
}
