// Current conditions for the three cities 383's readers actually live in or
// travel between: Prishtina, Tirana, Skopje.
//
// Open-Meteo is used because it needs no API key and no billing relationship —
// there is no account to expire, no quota to blow, and no secret to leak. That
// matters on a page that must keep rendering when everything else is down.
//
// Cached for 30 minutes. Weather that is half an hour stale is still true
// enough for "should I take a jacket"; hammering a free service for a strip at
// the top of a news page is not.

export type CityWeather = {
  city: string;
  tempC: number;
  code: number;
  label: string;
};

const CITIES = [
  { city: "Prishtinë", lat: 42.6629, lon: 21.1655 },
  { city: "Shkup", lat: 41.9981, lon: 21.4254 },
  { city: "Tiranë", lat: 41.3275, lon: 19.8187 },
] as const;

/**
 * WMO weather codes, grouped the way a reader cares about rather than the way
 * the standard splits them. The exact shade of drizzle is not worth a word.
 */
export function weatherLabel(code: number): string {
  if (code === 0) return "Kthjellët";
  if (code <= 2) return "Pjesërisht me re";
  if (code === 3) return "Me re";
  if (code <= 48) return "Mjegull";
  if (code <= 57) return "Shi i imët";
  if (code <= 67) return "Shi";
  if (code <= 77) return "Borë";
  if (code <= 82) return "Rrebeshe";
  if (code <= 86) return "Reshje bore";
  return "Stuhi";
}

/** A coarse bucket so the UI can pick an icon without a 40-case switch. */
export function weatherKind(
  code: number
): "clear" | "cloud" | "rain" | "snow" | "storm" {
  if (code <= 1) return "clear";
  if (code <= 48) return "cloud";
  if (code <= 67 || (code >= 80 && code <= 82)) return "rain";
  if (code <= 77 || (code >= 85 && code <= 86)) return "snow";
  return "storm";
}

/**
 * Never throws and never returns a fabricated temperature. A city that cannot
 * be read is simply absent from the result, and the strip renders the ones that
 * did answer — the same graceful-degradation rule the rest of the page follows.
 */
export async function getCityWeather(): Promise<CityWeather[]> {
  const results = await Promise.all(
    CITIES.map(async ({ city, lat, lon }): Promise<CityWeather | null> => {
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,weather_code&timezone=Europe%2FBelgrade`;
        const response = await fetch(url, { next: { revalidate: 1800 } });
        if (!response.ok) return null;

        const data = await response.json();
        const tempC = data?.current?.temperature_2m;
        const code = data?.current?.weather_code;
        if (typeof tempC !== "number" || typeof code !== "number") return null;

        return { city, tempC: Math.round(tempC), code, label: weatherLabel(code) };
      } catch {
        return null;
      }
    })
  );

  return results.filter((r): r is CityWeather => r !== null);
}
