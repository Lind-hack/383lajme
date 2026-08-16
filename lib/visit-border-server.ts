import { BORDER_CROSSINGS, type BorderCrossingId } from "@/lib/visit-v2-data";

const MPB_URL = "https://mpb.rks-gov.net/?culture=en-gb";

export type WaitRange = { min: number; max: number };

export type OfficialBorderWait = {
  crossingId: BorderCrossingId;
  name: string;
  entry: WaitRange;
  exit: WaitRange;
  updatedAt: string | null;
  fetchedAt: string;
  status: "current" | "unavailable";
  sourceName: "Kosovo Ministry of Internal Affairs";
  sourceUrl: typeof MPB_URL;
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;|&#xA0;/gi, " ")
    .replace(/&euml;|&#235;|&#xEB;/gi, "ë")
    .replace(/&Euml;|&#203;|&#xCB;/gi, "Ë")
    .replace(/&ccedil;|&#231;|&#xE7;/gi, "ç")
    .replace(/&Ccedil;|&#199;|&#xC7;/gi, "Ç")
    .replace(/&ndash;|&mdash;/gi, "-")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRange(value: string): WaitRange | null {
  const matches = value.match(/\d+/g)?.map(Number);
  if (!matches?.length) return null;
  const min = matches[0];
  const max = matches.length > 1 ? matches[1] : min;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > 240 || max > 240) return null;
  return { min, max };
}

function textCells(row: string) {
  return [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) =>
    decodeHtml(match[1].replace(/<[^>]+>/g, " ")),
  );
}

export function parseMpbBorderHtml(html: string, fetchedAt = new Date().toISOString()): OfficialBorderWait[] {
  const tab = html.match(/<div[^>]+id=["']tab-3["'][^>]*>([\s\S]*?)<div[^>]+id=["']tab-4["']/i)?.[1] ?? html;
  const updatedRaw = decodeHtml(tab.match(/Updated:\s*([^<]+)/i)?.[1] ?? "");
  const rows = [...tab.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => textCells(match[1]));

  return BORDER_CROSSINGS.flatMap((crossing) => {
    const row = rows.find((cells) => cells[0]?.localeCompare(crossing.officialName, "sq", { sensitivity: "base" }) === 0);
    if (!row) return [];
    const entry = parseRange(row[1] ?? "");
    const exit = parseRange(row[2] ?? "");
    if (!entry || !exit) return [];
    return [{
      crossingId: crossing.id,
      name: crossing.name,
      entry,
      exit,
      updatedAt: updatedRaw || null,
      fetchedAt,
      status: "current" as const,
      sourceName: "Kosovo Ministry of Internal Affairs" as const,
      sourceUrl: MPB_URL,
    }];
  });
}

export async function fetchOfficialBorderWaits(): Promise<OfficialBorderWait[]> {
  const fetchedAt = new Date().toISOString();
  const response = await fetch(MPB_URL, {
    headers: { "User-Agent": "383ks-visitor-utility/1.0 (+https://www.383ks.com/visit)" },
    next: { revalidate: 600 },
  });
  if (!response.ok) throw new Error(`MPB returned ${response.status}`);
  const waits = parseMpbBorderHtml(await response.text(), fetchedAt);
  if (waits.length !== BORDER_CROSSINGS.length) throw new Error("MPB border table format changed");
  return waits;
}

export function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
