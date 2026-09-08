/** Refresh confirmed roster availability from the event provider, never rumors. */
export function rosterNews(body, teams, sourceUrl) {
  const facts = [];
  for (const group of body?.injuries ?? []) {
    const side = ["home", "away"].find(side => String(teams[side]?.id) === String(group.team?.id));
    if (!side) continue;
    for (const injury of group.injuries ?? []) {
      const status = String(injury.status ?? injury.type?.description ?? "").toLowerCase();
      if (!/^(out|suspended|injured reserve)$/.test(status)) continue;
      const player = injury.athlete?.displayName;
      if (player) facts.push({ side, player, status, source: "ESPN", url: sourceUrl });
    }
  }
  return [...new Map(facts.map(f => [`${f.side}:${f.player}`, f])).values()];
}
export async function fetchPregameRoster(fixture, { sport = "soccer", fetchImpl = fetch } = {}) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${encodeURIComponent(fixture.league)}/summary?event=${encodeURIComponent(fixture.event_id)}`;
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!response.ok) throw new Error(`Pregame roster unavailable: ${response.status}`);
  return rosterNews(await response.json(), fixture, url);
}
export function applyRosterNews(probabilities, facts = []) {
  // Conservative model coefficient, not a measured player valuation. The
  // adjustment is recomputed from the base each time, so reports never compound.
  const counts = {home: 0, away: 0};
  for (const fact of facts) if (fact.side in counts) counts[fact.side]++;
  const values = Object.fromEntries(Object.entries(probabilities).map(([key, value]) =>
    [key, value * Math.exp(-Math.min(3, counts[key] ?? 0) * .08)]));
  const total = Object.values(values).reduce((sum,v)=>sum+v,0);
  return Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value/total]));
}
