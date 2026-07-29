const WEEK_IN_SECONDS = 60 * 60 * 24 * 7;

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
  brand: "Shell Kosova" | "IP Petrol" | "HIB Petrol";
  station: string | null;
  diesel: number | null;
  petrol: number | null;
  gas: number | null;
  updatedAt: string | null;
};

export type FuelSnapshot = {
  brands: FuelBrandSnapshot[];
  sourceUrl: string;
  fallback: boolean;
};

type NaftaSotFuel = {
  fuel_type_name?: string;
  price?: number | string | null;
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
      brand: "HIB Petrol",
      station: null,
      diesel: null,
      petrol: null,
      gas: null,
      updatedAt: null,
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

export async function getWeeklyExchangeSnapshot(): Promise<ExchangeSnapshot> {
  try {
    const response = await fetch(BANK_OF_ALBANIA_URL, {
      next: { revalidate: WEEK_IN_SECONDS },
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
    console.warn("Weekly EUR/ALL fetch failed; using last verified value.", error);
    return FALLBACK_EXCHANGE;
  }
}

function getFuelPrice(station: NaftaSotStation, fuelName: string) {
  const fuel = station.fuel_types?.find(
    (item) => item.fuel_type_name?.toLocaleLowerCase("sq") === fuelName
  );
  return parseNumber(fuel?.price);
}

function stationToSnapshot(
  stations: NaftaSotStation[],
  brand: FuelBrandSnapshot["brand"]
): FuelBrandSnapshot {
  const matches = stations
    .filter((station) => station.brand_name === brand)
    .sort(
      (a, b) =>
        Date.parse(b.last_price_update ?? "1970-01-01") -
        Date.parse(a.last_price_update ?? "1970-01-01")
    );

  const station =
    matches.find(
      (item) =>
        getFuelPrice(item, "dizel") !== null &&
        getFuelPrice(item, "benzinë") !== null &&
        getFuelPrice(item, "gaz") !== null
    ) ?? matches[0];

  if (!station) {
    return {
      brand,
      station: null,
      diesel: null,
      petrol: null,
      gas: null,
      updatedAt: null,
    };
  }

  return {
    brand,
    station: station.name ?? null,
    diesel: getFuelPrice(station, "dizel"),
    petrol: getFuelPrice(station, "benzinë"),
    gas: getFuelPrice(station, "gaz"),
    updatedAt: station.last_price_update ?? null,
  };
}

export async function getWeeklyFuelSnapshot(): Promise<FuelSnapshot> {
  try {
    const response = await fetch(NAFTA_SOT_BOOTSTRAP_URL, {
      next: { revalidate: WEEK_IN_SECONDS },
      headers: { "User-Agent": "383ks.com fuel utility/1.0" },
    });

    if (!response.ok) throw new Error(`NaftaSot returned ${response.status}`);
    const payload = (await response.json()) as NaftaSotBootstrap;
    const stations = Array.isArray(payload.stations) ? payload.stations : [];

    if (stations.length === 0) throw new Error("NaftaSot returned no stations");

    return {
      brands: (["Shell Kosova", "IP Petrol", "HIB Petrol"] as const).map((brand) =>
        stationToSnapshot(stations, brand)
      ),
      sourceUrl: "https://naftasot.com/",
      fallback: false,
    };
  } catch (error) {
    console.warn("Weekly Kosovo fuel fetch failed; using last verified values.", error);
    return FALLBACK_FUEL;
  }
}
