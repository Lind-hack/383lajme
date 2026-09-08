const routes = { "Las Vegas": "las-vegas", Miami: "miami", Austin: "united-states", Catalunya: "barcelona-catalunya", "Barcelona-Catalunya": "barcelona-catalunya", Madrid: "spain", "Yas Marina Circuit": "abu-dhabi", "Yas Marina": "abu-dhabi", Jeddah: "saudi-arabia", Silverstone: "great-britain" };

/** Read scheduled distance from the official current-season circuit page. */
export async function fetchF1RaceDistance(race, { fetchImpl = fetch } = {}) {
  const year = new Date(race.date_start ?? race.race_start).getUTCFullYear();
  const circuit = String(race.circuit_short_name ?? "");
  const slug = routes[circuit] ?? String(race.country_name ?? "").toLowerCase().replaceAll(" ", "-");
  if (!Number.isInteger(year) || !/^[a-z-]+$/.test(slug) || !circuit) return null;
  const url = `https://www.formula1.com/en/racing/${year}/${slug}/circuit`;
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    const html = await response.text();
    // A redirect to another round must not become this round's distance.
    if (!html.toLowerCase().includes(circuit.toLowerCase())) return null;
    const count = Number(html.match(/Number of Laps<\/dt>\s*<dd[^>]*>\s*(\d+)\s*<\/dd>/i)?.[1]);
    if (!Number.isInteger(count) || count < 20 || count > 100) return null;
    return { total_laps: count, lap_count_source: url };
  } catch { return null; }
}
