/** Private research is independent of which articles the newsroom publishes. */
export async function loadMarketResearch(admin, now = new Date()) {
  const { data, error } = await admin.storage.from('market-research').download('latest.json');
  if (error) return { markets: {}, status: 'unavailable' };
  const payload = JSON.parse(await data.text());
  const age = now.getTime() - Date.parse(payload.generated_at);
  if (!Number.isFinite(age) || age < -60_000 || age > 30 * 60_000) return { markets: {}, status: 'stale' };
  return { markets: payload.markets ?? {}, status: 'fresh', generated_at: payload.generated_at };
}
