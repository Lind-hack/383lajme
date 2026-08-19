// Both feeds publish on their own schedule; a daily window keeps the cards in
// step with them. The weekly window was holding fuel prices ~3 weeks stale.
const DAY_IN_SECONDS = 60 * 60 * 24;

const BANK_OF_ALBANIA_URL =
  "https://www.bankofalbania.org/Markets/Official_exchange_rate/";
const NAFTA_SOT_BOOTSTRAP_URL =
  "https://api.naftasot.com/api/public/bootstrap?sort_by=cheapest";

export type ExchangeSnapshot = {
  allPerEur: number;
  change: number | null;
  updatedAt: string;
  sourceUrl: string;
  fallback: boolean;
};

export type FuelBrandSnapshot = {
  brand: "Shell Kosova" | "IP Petrol" | "Petrol Company";
  station: string | null;
  diesel: number | null;
  petrol: number | null;
  gas: number | null;
  /** Oldest of the three prices — the age of the row as a whole. */
  updatedAt: string | null;
  /** Newest of the three, so the card can show a range when they diverge. */
  freshestAt?: string | null;
};

export type FuelSnapshot = {
  brands: FuelBrandSnapshot[];
  sourceUrl: string;
  fallback: boolean;
  /** Why live data could not be used. Present only when fallback is true. */
  fallbackReason?: string;
};

type NaftaSotFuel = {
  fuel_type_name?: string;
  price?: number | string | null;
  /** Each price carries its own timestamp, and they diverge: one forecourt
   *  had diesel from today, petrol from yesterday and gas from three days
   *  earlier. Undeclared until now, so every consumer treated the station's
   *  date as the date of all three. */
  updated_at?: string | null;
};

type NaftaSotStation = {
  name?: string;
  brand_name?: string;
  last_price_update?: string | null;
  fuel_types?: NaftaSotFuel[];
};

type NaftaSotBootstrap = {
  stations?: NaftaSotStation[];
};

const FALLBACK_EXCHANGE: ExchangeSnapshot = {
  allPerEur: 93.61,
  change: -0.05,
  updatedAt: "2026-07-29T12:38:52+02:00",
  sourceUrl: BANK_OF_ALBANIA_URL,
  fallback: true,
};

const FALLBACK_FUEL: FuelSnapshot = {
  brands: [
    {
      brand: "Shell Kosova",
      station: "Shell Veternik 4",
      diesel: 1.74,
      petrol: 1.53,
      gas: 0.6,
      updatedAt: "2026-07-29T08:55:36.507Z",
    },
    {
      brand: "IP Petrol",
      station: "IP Petrol Komoran",
      diesel: 1.74,
      petrol: 1.53,
      gas: 0.6,
      updatedAt: "2026-07-29T08:55:31.295Z",
    },
    {
      // Replaces HIB Petrol, which had published no price since 2026-05-14 and so
      // rendered as a permanently empty row. Petrol Company posts daily; it does
      // not list gas at its freshest station, hence that one null.
      brand: "Petrol Company",
      station: "Petrol Company Klinë",
      diesel: 1.76,
      petrol: 1.5,
      gas: null,
      updatedAt: "2026-08-17T06:12:00.000Z",
    },
  ],
  sourceUrl: "https://naftasot.com/",
  fallback: true,
};

function parseNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function bankDateToIso(date: string, time: string) {
  const [day, month, year] = date.split(".");
  return `${year}-${month}-${day}T${time}+02:00`;
}

export async function getDailyExchangeSnapshot(): Promise<ExchangeSnapshot> {
  try {
    const response = await fetch(BANK_OF_ALBANIA_URL, {
      next: { revalidate: DAY_IN_SECONDS },
      headers: { "User-Agent": "383ks.com market utility/1.0" },
    });

    if (!response.ok) throw new Error(`Bank of Albania returned ${response.status}`);
    const html = await response.text();
    const eurRow = html.match(
      /<TD nowrap>Euro<\/TD>\s*<TD nowrap>EUR<\/TD>\s*<td[^>]*>([\d.,]+)<\/td>\s*<td[^>]*>([-+\d.,]+)<\/td>/i
    );
    const updated = html.match(
      /Last update:<\/span>[\s\S]*?<b>(\d{2}\.\d{2}\.\d{4})<\/b>[\s\S]*?<b>(\d{2}:\d{2}:\d{2})<\/b>/i
    );
    const allPerEur = parseNumber(eurRow?.[1]);

    if (allPerEur === null) throw new Error("EUR/ALL rate was not present");

    return {
      allPerEur,
      change: parseNumber(eurRow?.[2]),
      updatedAt: updated
        ? bankDateToIso(updated[1], updated[2])
        : new Date().toISOString(),
      sourceUrl: BANK_OF_ALBANIA_URL,
      fallback: false,
    };
  } catch (error) {
    console.warn("Daily EUR/ALL fetch failed; using last verified value.", error);
    return FALLBACK_EXCHANGE;
  }
}

function getFuelPrice(station: NaftaSotStation, fuelName: string) {
  const fuel = station.fuel_types?.find(
    (item) => item.fuel_type_name?.toLocaleLowerCase("sq") === fuelName
  );
  return parseNumber(fuel?.price);
}

/**
 * Fetch the NaftaSot station list.
 *
 * The failure reason is returned rather than swallowed. Production served the
 * hardcoded fallback — 29 July prices under a "Rifreskim ditor" label — for
 * weeks, and nothing on the page or in this function said why. A card that
 * silently substitutes stale numbers for live ones is worse than a card that
 * admits it has none.
 *
 * The User-Agent matters: the API sits behind Cloudflare, which answers a
 * residential request with 200 and is far less forgiving of a datacenter IP
 * announcing itself as a bot. A conventional browser string is the difference
 * between the render path getting data and getting a challenge page.
 */
export async function fetchNaftaSotStations(): Promise<
  { ok: true; stations: NaftaSotStation[] } | { ok: false; reason: string }
> {
  try {
    const response = await fetch(NAFTA_SOT_BOOTSTRAP_URL, {
      next: { revalidate: DAY_IN_SECONDS },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "sq,en;q=0.8",
      },
      // Without a ceiling a hung upstream stalls the whole homepage render.
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        reason: `HTTP ${response.status} ${response.statusText} — ${body.slice(0, 120)}`,
      };
    }

    const payload = (await response.json()) as NaftaSotBootstrap;
    const stations = Array.isArray(payload.stations) ? payload.stations : [];
    if (stations.length === 0) return { ok: false, reason: "no stations in payload" };
    return { ok: true, stations };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * The freshest published price for one fuel across a brand's stations.
 *
 * Per fuel, not per station, because each price carries its own updated_at and
 * they diverge: on a single Shell forecourt the diesel was from today, the
 * petrol from yesterday and the gas from three days earlier. Picking one
 * station and stamping its newest date on all three presented the gas price as
 * being as current as the diesel, which it was not.
 */
function freshestFuel(
  stations: NaftaSotStation[],
  fuelName: string,
): { price: number | null; updatedAt: string | null; station: string | null } {
  let best: { price: number; updatedAt: string | null; station: string | null } | null = null;

  for (const station of stations) {
    const fuel = station.fuel_types?.find(
      (item) => item.fuel_type_name?.toLocaleLowerCase("sq") === fuelName,
    );
    const price = parseNumber(fuel?.price);
    if (price === null) continue;

    const stamp = Date.parse(fuel?.updated_at ?? station.last_price_update ?? "");
    const bestStamp = best ? Date.parse(best.updatedAt ?? "") : Number.NEGATIVE_INFINITY;
    if (!best || (Number.isFinite(stamp) && stamp > bestStamp)) {
      best = {
        price,
        updatedAt: fuel?.updated_at ?? station.last_price_update ?? null,
        station: station.name ?? null,
      };
    }
  }

  return best ?? { price: null, updatedAt: null, station: null };
}

function stationToSnapshot(
  stations: NaftaSotStation[],
  brand: FuelBrandSnapshot["brand"],
): FuelBrandSnapshot {
  const matches = stations.filter((station) => station.brand_name === brand);

  const diesel = freshestFuel(matches, "dizel");
  const petrol = freshestFuel(matches, "benzinë");
  const gas = freshestFuel(matches, "gaz");

  // The row's date is the oldest of the prices shown, because that is the age
  // of the row as a whole. Claiming the newest would date the whole line by
  // its freshest number.
  const stamps = [diesel.updatedAt, petrol.updatedAt, gas.updatedAt]
    .filter((value): value is string => Boolean(value))
    .sort();

  return {
    brand,
    // Whichever forecourt supplied the diesel, the price readers check first.
    station: diesel.station ?? petrol.station ?? gas.station,
    diesel: diesel.price,
    petrol: petrol.price,
    gas: gas.price,
    updatedAt: stamps[0] ?? null,
    freshestAt: stamps[stamps.length - 1] ?? null,
  };
}

export async function getDailyFuelSnapshot(): Promise<FuelSnapshot> {
  const result = await fetchNaftaSotStations();

  if (!result.ok) {
    console.warn(`[fuel] NaftaSot unavailable (${result.reason}); serving last verified values.`);
    return { ...FALLBACK_FUEL, fallbackReason: result.reason };
  }

  return {
    brands: (["Shell Kosova", "IP Petrol", "Petrol Company"] as const).map((brand) =>
      stationToSnapshot(result.stations, brand),
    ),
    sourceUrl: "https://naftasot.com/",
    fallback: false,
  };
}
