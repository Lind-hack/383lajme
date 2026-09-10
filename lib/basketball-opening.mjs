import { americanOddsToProbability } from "./football-pre-match.mjs";

function overallRecord(competitor) {
  const record = competitor?.records?.find(row => row.type === "total" || row.name === "overall");
  const match = String(record?.summary ?? "").match(/^(\d+)-(\d+)$/);
  if (!match) return null;
  const wins = Number(match[1]), losses = Number(match[2]);
  return wins + losses > 0 ? { wins, losses } : null;
}

/** Provider odds first, then observed season records; never invent team form. */
export function basketballOpeningModel(competition, sourceUrl) {
  const odds = competition?.odds?.[0]?.moneyline;
  const readOdds = node => americanOddsToProbability(node?.close?.odds ?? node?.open?.odds ?? node?.odds ?? node);
  const homeOdds = readOdds(odds?.home), awayOdds = readOdds(odds?.away);
  if (homeOdds && awayOdds) {
    const home = homeOdds / (homeOdds + awayOdds);
    return { probabilities: { home, away: 1 - home }, source_url: sourceUrl, method: "Normalized provider moneyline" };
  }
  const home = overallRecord(competition?.competitors?.find(row => row.homeAway === "home"));
  const away = overallRecord(competition?.competitors?.find(row => row.homeAway === "away"));
  if (home && away) {
    const h = (home.wins + 2) / (home.wins + home.losses + 4);
    const a = (away.wins + 2) / (away.wins + away.losses + 4);
    const probability = Math.max(.03, Math.min(.97, h * (1 - a) / (h * (1 - a) + a * (1 - h))));
    return { probabilities: { home: probability, away: 1 - probability }, source_url: sourceUrl,
      method: "ESPN season records: smoothed log5 estimate; not bookmaker odds", inputs: { home, away },
      missing_inputs: ["moneyline", "injuries", "rest_days", "recent_form"] };
  }
  return { probabilities: { home: .5, away: .5 }, source_url: sourceUrl,
    method: "Neutral prior: provider moneyline unavailable", missing_inputs: ["moneyline", "season_records"] };
}
