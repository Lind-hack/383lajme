const EVENT_ID = "760515";
const KICKOFF = "2026-07-15T19:00:00.000Z";
const OUTCOMES = ["ENGLAND", "DRAW", "ARGENTINA"];

function stableExp(value) {
  return Math.exp(Math.min(700, Math.max(-700, value)));
}

export function lmsrThreeOutcomePrices({ q_england, q_draw, q_argentina, b }) {
  const liquidity = Number(b);
  if (!Number.isFinite(liquidity) || liquidity <= 0) throw new Error("LMSR liquidity must be positive.");
  const values = [Number(q_england), Number(q_draw), Number(q_argentina)];
  if (values.some((value) => !Number.isFinite(value))) throw new Error("LMSR quantities must be finite.");
  const pivot = Math.max(...values);
  const weights = values.map((value) => stableExp((value - pivot) / liquidity));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return { england: weights[0] / total, draw: weights[1] / total, argentina: weights[2] / total };
}

export function previewThreeOutcomeBet(market, side, coins) {
  if (!OUTCOMES.includes(side)) throw new Error("Invalid three-outcome side.");
  const cost = Number(coins);
  if (!Number.isFinite(cost) || cost <= 0) throw new Error("Virtual 383C stake must be positive.");
  const b = Number(market.b);
  const quantities = [Number(market.q_england), Number(market.q_draw), Number(market.q_argentina)];
  const pivot = Math.max(...quantities);
  const weights = quantities.map((value) => stableExp((value - pivot) / b));
  const selected = OUTCOMES.indexOf(side);
  const sum = weights.reduce((total, value) => total + value, 0);
  const other = sum - weights[selected];
  const shares = b * Math.log((sum * Math.exp(cost / b) - other) / weights[selected]);
  quantities[selected] += shares;
  return {
    shares,
    quantities: { q_england: quantities[0], q_draw: quantities[1], q_argentina: quantities[2] },
    prices: lmsrThreeOutcomePrices({ q_england: quantities[0], q_draw: quantities[1], q_argentina: quantities[2], b }),
  };
}

/**
 * Builds the fixed generic sport-market row. It has no database client; the
 * caller owns the explicit authorized write. Source text is retained as evidence;
 * social discovery never becomes a claim or a probability input.
 */
export function buildArgentinaEnglandDraft({ event, verifiedNews, openingOdds, now = new Date() }) {
  if (event?.provider !== "espn" || String(event?.event_id) !== EVENT_ID) throw new Error("Official ESPN event 760515 is required.");
  const eventKickoffAt = Date.parse(String(event?.date));
  if (!Number.isFinite(eventKickoffAt) || eventKickoffAt !== Date.parse(KICKOFF)) throw new Error("Official ESPN kickoff must be 2026-07-15T19:00:00Z.");
  if (new Date(now).getTime() >= new Date(KICKOFF).getTime()) throw new Error("Pre-match draft builder is only valid before kickoff.");
  const teams = new Set((event?.competitors ?? []).map((competitor) => String(competitor?.team).toLowerCase()));
  if (!teams.has("england") || !teams.has("argentina")) throw new Error("Official ESPN competitors England and Argentina are required.");
  if (!Array.isArray(verifiedNews) || verifiedNews.length === 0 || verifiedNews.some((source) => !source?.url || !source?.source)) {
    throw new Error("At least one verified news source with URL and publisher is required.");
  }
  if (!event?.source_url) throw new Error("Official ESPN source URL is required.");
  const opening = openingOdds?.probabilities;
  if (opening !== undefined) {
    const values = [opening?.england, opening?.draw, opening?.argentina].map(Number);
    if (values.some((value) => !Number.isFinite(value) || value <= 0) || Math.abs(values.reduce((total, value) => total + value, 0) - 1) > 1e-9) {
      throw new Error("Verified full-time 1X2 opening probabilities must be positive and normalized.");
    }
  }

  return {
    idempotency_key: `sport-market:${EVENT_ID}:${KICKOFF}`,
    slug: "england-argentina-full-time-result-20260715",
    question: "England–Argentina: rezultati pas 90 minutash?",
    description: "Treg virtual 383C me tre rezultate. Analiza para ndeshjes shfaq vetëm burime të verifikuara; formacionet, statistikat dhe rezultati vijnë nga ESPN kur publikohen.",
    resolution_criteria: "Zgjidhet vetëm nga rezultati zyrtar i ESPN pas kohës së rregullt (90 minuta dhe koha shtesë e gjyqtarit, pa penallti): ENGLAND nëse fiton Anglia, DRAW nëse është barazim, ARGENTINA nëse fiton Argjentina. Mbyllet automatikisht vetëm kur ESPN raporton statusin zyrtar FULL_TIME/FT.",
    category: "sport",
    status: "open",
    market_type: "three_outcome",
    outcomes: OUTCOMES,
    q_england: 400 * Math.log(opening?.england ?? 1 / 3),
    q_draw: 400 * Math.log(opening?.draw ?? 1 / 3),
    q_argentina: 400 * Math.log(opening?.argentina ?? 1 / 3),
    sport_outcomes: [
      { key: "england", label: "England", team: "England" },
      { key: "draw", label: "Draw" },
      { key: "argentina", label: "Argentina", team: "Argentina" },
    ],
    outcome_quantities: {
      england: 400 * Math.log(opening?.england ?? 1 / 3),
      draw: 400 * Math.log(opening?.draw ?? 1 / 3),
      argentina: 400 * Math.log(opening?.argentina ?? 1 / 3),
    },
    reference_probabilities: opening ?? { england: 1 / 3, draw: 1 / 3, argentina: 1 / 3 },
    // ESPN FULL_TIME/FT closes the market early. This is only a stale-event safety
    // fallback and deliberately remains after the scheduled match window.
    closes_at: new Date(new Date(KICKOFF).getTime() + 6 * 3_600_000).toISOString(),
    source_article_slugs: [],
    ai_generated: false,
    live_event: {
      provider: "espn",
      event_id: EVENT_ID,
      league: String(event.league),
      yes_team: "England",
      home_team: "England",
      away_team: "Argentina",
      kickoff: KICKOFF,
      sport: "soccer",
      source_url: String(event.source_url),
    },
    analysis: {
      claims: [],
      sources: [{ title: "ESPN official event", url: String(event.source_url), source: "ESPN" }, ...verifiedNews.map((source) => ({ title: String(source.title ?? source.source), url: String(source.url), source: String(source.source) }))],
      refresh_requirements: ["verified_news", "espn_starting_lineups", "espn_stats", "espn_score_status"],
    },
  };
}
