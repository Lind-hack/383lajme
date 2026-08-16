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

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("lat"));
  const longitude = Number(request.nextUrl.searchParams.get("lon"));
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
    const nearest = Object.fromEntries(kinds.map((kind) => {
      const options = (payload.elements ?? []).flatMap((element) => {
        if (element.tags?.amenity !== kind) return [];
        const lat = element.lat ?? element.center?.lat;
        const lon = element.lon ?? element.center?.lon;
        if (lat === undefined || lon === undefined) return [];
        const distanceKm = haversineKm({ latitude, longitude }, { latitude: lat, longitude: lon });
        return [{ kind, name: element.tags?.name ?? element.tags?.["name:sq"] ?? ({ police: "Polici", hospital: "Spital / ambulancë", fire_station: "Zjarrfikës", fuel: "Pikë karburanti" } as const)[kind], latitude: lat, longitude: lon, distanceKm, openingHours: element.tags?.opening_hours ?? null }];
      }).sort((a, b) => a.distanceKm - b.distanceKm);
      return [kind, options[0] ?? null];
    }));
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
