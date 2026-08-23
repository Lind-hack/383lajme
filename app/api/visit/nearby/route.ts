import { NextResponse, type NextRequest } from "next/server";
import { haversineKm } from "@/lib/visit-border-server";

export const runtime = "nodejs";

type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const kinds = ["police", "hospital", "fire_station", "fuel"] as const;

type NearbyKind = typeof kinds[number];
type NearbyBase = { kind: NearbyKind; name: string; latitude: number; longitude: number; distanceKm: number; openingHours: string | null };
type CommonsPage = {
  pageid: number;
  title: string;
  coordinates?: { lat: number; lon: number }[];
  imageinfo?: { thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[];
};

function stripTags(value = "") {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function mapsDirections(latitude: number, longitude: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
}

async function nearbyPhoto(place: NearbyBase, seed: number, offset: number) {
  try {
    const params = new URLSearchParams({
      action: "query",
      generator: "geosearch",
      ggsprimary: "all",
      ggsnamespace: "6",
      ggsradius: "3000",
      ggslimit: "12",
      ggscoord: `${place.latitude}|${place.longitude}`,
      prop: "imageinfo|coordinates",
      iiprop: "url|extmetadata",
      iiurlwidth: "900",
      format: "json",
      origin: "*",
    });
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": "383ks-visitor-utility/2.0 (+https://www.383ks.com/visit)" },
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) throw new Error("Commons unavailable");
    const payload = await response.json() as { query?: { pages?: Record<string, CommonsPage> } };
    const choices = Object.values(payload.query?.pages ?? {}).flatMap((page) => {
      const info = page.imageinfo?.[0];
      const coordinates = page.coordinates?.[0];
      if (!info?.thumburl || !coordinates || !info.thumburl.startsWith("https://upload.wikimedia.org/")) return [];
      const metadata = info.extmetadata ?? {};
      return [{
        url: info.thumburl,
        sourceUrl: info.descriptionurl ?? `https://commons.wikimedia.org/?curid=${page.pageid}`,
        title: stripTags(metadata.ImageDescription?.value) || page.title.replace(/^File:/, ""),
        credit: stripTags(metadata.Artist?.value) || "Wikimedia Commons",
        license: stripTags(metadata.LicenseShortName?.value) || "Commons licence",
        distanceKm: haversineKm(place, { latitude: coordinates.lat, longitude: coordinates.lon }),
        kind: "photo" as const,
      }];
    }).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 8);
    if (choices.length) return choices[Math.abs(seed + offset * 17) % choices.length];
  } catch {
    // A truthful map preview is used when no reusable nearby photograph is available.
  }
  return {
    url: `https://staticmap.openstreetmap.de/staticmap.php?center=${place.latitude},${place.longitude}&zoom=16&size=900x500&maptype=mapnik&markers=${place.latitude},${place.longitude},red-pushpin&refresh=${seed}`,
    sourceUrl: "https://www.openstreetmap.org/copyright",
    title: `Harta e ${place.name}`,
    credit: "© OpenStreetMap contributors",
    license: "ODbL",
    distanceKm: 0,
    kind: "map" as const,
  };
}

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("lat"));
  const longitude = Number(request.nextUrl.searchParams.get("lon"));
  const analysisSeed = Number(request.nextUrl.searchParams.get("analysis")) || Date.now();
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 41 || latitude > 44 || longitude < 19 || longitude > 23) {
    return NextResponse.json({ error: "Location is outside the supported Kosovo area." }, { status: 400 });
  }

  const query = `[out:json][timeout:15];(nw(around:10000,${latitude.toFixed(5)},${longitude.toFixed(5)})[amenity~"^(police|hospital|fire_station|fuel)$"];);out center tags 80;`;
  const fallbackSearches = {
    police: `https://www.google.com/maps/search/police/@${latitude},${longitude},14z`,
    hospital: `https://www.google.com/maps/search/hospital/@${latitude},${longitude},14z`,
    fire_station: `https://www.google.com/maps/search/fire+station/@${latitude},${longitude},14z`,
    fuel: `https://www.google.com/maps/search/gas+station/@${latitude},${longitude},14z`,
  };
  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "383ks-visitor-utility/1.0 (+https://www.383ks.com/visit)" },
      body: new URLSearchParams({ data: query }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
    const payload = (await response.json()) as { elements?: OverpassElement[] };
    const nearestBase = Object.fromEntries(kinds.map((kind) => {
      const options = (payload.elements ?? []).flatMap((element) => {
        if (element.tags?.amenity !== kind) return [];
        const lat = element.lat ?? element.center?.lat;
        const lon = element.lon ?? element.center?.lon;
        if (lat === undefined || lon === undefined) return [];
        const distanceKm = haversineKm({ latitude, longitude }, { latitude: lat, longitude: lon });
        return [{ kind, name: element.tags?.name ?? element.tags?.["name:sq"] ?? ({ police: "Polici", hospital: "Spital / ambulancë", fire_station: "Zjarrfikës", fuel: "Pikë karburanti" } as const)[kind], latitude: lat, longitude: lon, distanceKm, openingHours: element.tags?.opening_hours ?? null }];
      }).sort((a, b) => a.distanceKm - b.distanceKm);
      return [kind, options[0] ?? null];
    })) as Record<NearbyKind, NearbyBase | null>;
    const nearest = Object.fromEntries(await Promise.all(kinds.map(async (kind, index) => {
      const place = nearestBase[kind];
      if (!place) return [kind, null];
      return [kind, { ...place, mapsUrl: mapsDirections(place.latitude, place.longitude), photo: await nearbyPhoto(place, analysisSeed, index) }];
    })));
    return NextResponse.json({ nearest, fallbackSearches, degraded: false, attribution: "© OpenStreetMap contributors", note: "Map listings may be incomplete. Verify opening hours and call 112 in an emergency." }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    return NextResponse.json({
      nearest: { police: null, hospital: null, fire_station: null, fuel: null },
      fallbackSearches,
      degraded: true,
      attribution: "Google Maps search fallback",
      note: "The live map index is temporarily unavailable. Open a nearby search and verify the result before travelling.",
      detail: String(error instanceof Error ? error.message : error),
    }, { headers: { "Cache-Control": "private, max-age=60" } });
  }
}
