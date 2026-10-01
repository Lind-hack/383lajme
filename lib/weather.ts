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
  /** False after sunset, so a clear night shows a moon rather than a sun. */
  isDay: boolean;
  label: string;
  /**
   * Highest chance of rain over the next six hours, 0–100. It used to be the
   * day's maximum, which counts hours already gone and so barely moved from
   * morning to night. Null when not reported.
   */
  rainChance: number | null;
  /** Today's high and low, rounded. Null when not reported. */
  highC: number | null;
  lowC: number | null;
  /** The next hours, starting after the current one, local Kosovo time. */
  hours: HourWeather[];
  /** Open-Meteo's observation time, local ("20:00"), so the card can say how fresh it is. */
  observedAt: string | null;
};

export type HourWeather = {
  /** "21:00" */
  time: string;
  tempC: number;
  code: number;
  isDay: boolean;
  rainChance: number | null;
};

const NEXT_HOURS = 6;
const HOUR_STRIP = 5;

function hourly(data: unknown): { time: string; temp: number; code: number; isDay: boolean; rain: number | null }[] {
  const h = (data as { hourly?: Record<string, unknown[]> })?.hourly;
  const times = Array.isArray(h?.time) ? h.time : [];
  return times.flatMap((time, i) => {
    const temp = h?.temperature_2m?.[i];
    const code = h?.weather_code?.[i];
    const rain = h?.precipitation_probability?.[i];
    const isDay = h?.is_day?.[i] !== 0;
    if (typeof time !== "string" || typeof temp !== "number" || typeof code !== "number") return [];
    return [{ time, temp, code, isDay, rain: typeof rain === "number" && Number.isFinite(rain) ? rain : null }];
  });
}

/** A daily value from Open-Meteo, or null — never a guessed number. */
function firstDaily(data: unknown, key: string): number | null {
  const value = (data as { daily?: Record<string, unknown[]> })?.daily?.[key]?.[0];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const CITIES = [
  { city: "Prishtinë", lat: 42.6629, lon: 21.1655 },
  { city: "Tiranë", lat: 41.3275, lon: 19.8187 },
  { city: "Shkup", lat: 41.9981, lon: 21.4254 },
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
  const results = await Promise.all(CITIES.map(getWeatherAt));
  return results.filter((r): r is CityWeather => r !== null);
}

/**
 * One place's conditions, or null when Open-Meteo has no usable answer. The
 * homepage strip asks for its three cities; Për ty asks for the reader's town.
 */
export async function getWeatherAt({ city, lat, lon }: { city: string; lat: number; lon: number }): Promise<CityWeather | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code,is_day` +
      `&hourly=temperature_2m,weather_code,precipitation_probability,is_day&forecast_hours=${NEXT_HOURS + 1}` +
      `&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min` +
      `&forecast_days=1&timezone=Europe%2FBelgrade`;
    const response = await fetch(url, { next: { revalidate: 1800 } });
    if (!response.ok) return null;

    const data = await response.json();
    const tempC = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;
    if (typeof tempC !== "number" || typeof code !== "number") return null;

    // Hourly starts at the current hour: it and the next six decide the
    // umbrella; the day's maximum is the fallback when hours are missing.
    const hours = hourly(data);
    const nextRain = hours.slice(0, NEXT_HOURS + 1).map((h) => h.rain).filter((r): r is number => r !== null);
    const rain = nextRain.length ? Math.max(...nextRain) : firstDaily(data, "precipitation_probability_max");
    const high = firstDaily(data, "temperature_2m_max");
    const low = firstDaily(data, "temperature_2m_min");
    return {
      city,
      tempC: Math.round(tempC),
      code,
      isDay: data?.current?.is_day !== 0,
      label: weatherLabel(code),
      rainChance: rain === null ? null : Math.round(rain),
      highC: high === null ? null : Math.round(high),
      lowC: low === null ? null : Math.round(low),
      hours: hours.slice(1, HOUR_STRIP + 1).map((h) => ({
        time: h.time.slice(11, 16),
        tempC: Math.round(h.temp),
        code: h.code,
        isDay: h.isDay,
        rainChance: h.rain === null ? null : Math.round(h.rain),
      })),
      observedAt: typeof data?.current?.time === "string" ? data.current.time.slice(11, 16) : null,
    };
  } catch {
    return null;
  }
}
