import { fetchFlashscoreLiveStats, mergeFlashscoreWithEspn } from "./flashscore-live-stats.mjs";
import { normalizeEspnSummary } from "./tregu-sport-market.mjs";

/** Server-only adapter for ESPN's public summary endpoint. No social source is accepted. */
export async function fetchEspnLiveEvents(liveEvents) {
  const unique = new Map();
  for (const config of liveEvents ?? []) {
    if (config?.provider === "espn" && config?.event_id && config?.league) {
      unique.set(`${config.league}:${config.event_id}`, config);
    }
  }

  const responses = await Promise.all([...unique.values()].map(async (config) => {
    const sport = encodeURIComponent(String(config.sport ?? "soccer"));
    const league = encodeURIComponent(String(config.league));
    const eventId = encodeURIComponent(String(config.event_id));
    const source_url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${eventId}`;
    const response = await fetch(source_url, { headers: { accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`ESPN scoreboard ${config.event_id} returned ${response.status}`);
    const body = await response.json();
    const espnEvent = normalizeEspnSummary(config, body);
    const [home, away] = espnEvent.competitors;
    const flashscore = await fetchFlashscoreLiveStats({ eventId: config.event_id, homeTeam: home.team, awayTeam: away.team });
    return mergeFlashscoreWithEspn(espnEvent, flashscore);
  }));

  return responses;
}
