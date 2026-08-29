import { fetchFlashscoreLiveStats, mergeFlashscoreWithEspn } from "./flashscore-live-stats.mjs";
import { normalizeEspnSummary } from "./tregu-sport-market.mjs";

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

async function fetchSummary(url, fetchImpl = fetch) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchImpl(url, { headers: { accept: "application/json" }, cache: "no-store" });
      if (response.ok) return response.json();
      if (!RETRYABLE.has(response.status) || attempt === 2) {
        const failure = new Error(`ESPN scoreboard returned ${response.status}`);
        failure.status = response.status;
        throw failure;
      }
    } catch (error) {
      const status = Number(error?.status ?? error?.cause?.status ?? 0);
      if (attempt === 2 || (status > 0 && !RETRYABLE.has(status))) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
  }
  throw new Error("ESPN summary request exhausted retries.");
}

/** Server-only adapter for ESPN's public summary endpoint. No social source is accepted. */
export async function fetchEspnLiveEvents(liveEvents) {
  const unique = new Map();
  for (const config of liveEvents ?? []) {
    if (config?.provider === "espn" && config?.event_id && config?.league) {
      unique.set(`${config.league}:${config.event_id}`, config);
    }
  }

  const results = await Promise.allSettled([...unique.values()].map(async (config) => {
    const sport = encodeURIComponent(String(config.sport ?? "soccer"));
    const league = encodeURIComponent(String(config.league));
    const eventId = encodeURIComponent(String(config.event_id));
    const source_url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${eventId}`;
    const body = await fetchSummary(source_url);
    const espnEvent = normalizeEspnSummary(config, body);
    const [home, away] = espnEvent.competitors;
    const flashscore = await fetchFlashscoreLiveStats({
      eventId: config.event_id,
      homeTeam: home.team,
      awayTeam: away.team,
      league: config.league,
    });
    return mergeFlashscoreWithEspn(espnEvent, flashscore);
  }));
  const fulfilled = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (unique.size > 0 && fulfilled.length === 0) {
    const errors = results.flatMap((result) => result.status === "rejected" ? [String(result.reason?.message ?? result.reason)] : []);
    throw new Error(`All ESPN event summaries failed: ${errors.join("; ")}`);
  }
  return fulfilled;
}
