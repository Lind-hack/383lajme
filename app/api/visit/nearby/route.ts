import { NextResponse, type NextRequest } from "next/server";
import { haversineKm } from "@/lib/visit-border-server";
import { exactOsmImageReference, googleTypeForKind, selectExactGoogleCandidate } from "@/lib/visit-place-image.mjs";

export const runtime = "nodejs";

type OverpassElement = { id: number; type: "node" | "way" | "relation"; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
const kinds = ["police", "hospital", "fire_station", "fuel"] as const;
type NearbyKind = typeof kinds[number];
type NearbyBase = { kind: NearbyKind; name: string; latitude: number; longitude: number; distanceKm: number; openingHours: string | null; tags: Record<string, string> };
type CommonsPage = { pageid: number; title: string; imageinfo?: { thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[] };
type GoogleCandidate = { id?: string; displayName?: { text?: string }; location?: { latitude: number; longitude: number }; photos?: { name: string; authorAttributions?: { displayName?: string; uri?: string; photoUri?: string }[] }[]; googleMapsUri?: string };

function stripTags(value = "") {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function mapsDirections(latitude: number, longitude: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
}

function streetView(latitude: number, longitude: number) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude},${longitude}`;
}

async function exactCommonsPhoto(reference: string) {
  try {
    const params = new URLSearchParams({ action: "query", titles: reference, prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "900", format: "json", origin: "*" });
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": "383ks-visitor-utility/3.0 (+https://www.383ks.com/visit)" },
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { query?: { pages?: Record<string, CommonsPage> } };
    const page = Object.values(payload.query?.pages ?? {})[0];
    const info = page?.imageinfo?.[0];
    if (!page || !info?.thumburl || !info.thumburl.startsWith("https://upload.wikimedia.org/")) return null;
    const metadata = info.extmetadata ?? {};
    return {
      url: info.thumburl,
      sourceUrl: info.descriptionurl ?? `https://commons.wikimedia.org/?curid=${page.pageid}`,
      title: stripTags(metadata.ImageDescription?.value) || page.title.replace(/^File:/, ""),
      credit: stripTags(metadata.Artist?.value) || "Wikimedia Commons",
      license: stripTags(metadata.LicenseShortName?.value) || "Commons licence",
      provider: "wikimedia" as const,
      verified: true as const,
      embeddable: true as const,
    };
  } catch {
    return null;
  }
}

async function exactGooglePhoto(place: NearbyBase) {
  const apiKey = process.env.GOOGLE_MAPS_PLATFORM_API_KEY;
  const includedType = googleTypeForKind(place.kind);
  if (!apiKey || !includedType) return null;
  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.photos,places.googleMapsUri,places.types" },
      body: JSON.stringify({
        textQuery: `${place.name}, Kosovo`, includedType, strictTypeFiltering: true, maxResultCount: 3,
        locationBias: { circle: { center: { latitude: place.latitude, longitude: place.longitude }, radius: 200 } },
        languageCode: "sq", regionCode: "XK",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { places?: GoogleCandidate[] };
    const candidate = selectExactGoogleCandidate(place, payload.places ?? [], haversineKm) as GoogleCandidate | null;
    const photo = candidate?.photos?.[0];
    if (!candidate || !photo?.name) return null;
    const author = photo.authorAttributions?.[0];
    return {
      url: `/api/visit/place-photo?name=${encodeURIComponent(photo.name)}`,
      sourceUrl: candidate.googleMapsUri ?? mapsDirections(place.latitude, place.longitude),
      title: `${candidate.displayName?.text ?? place.name}, fotografi e vendit`,
      credit: author?.displayName ? `${author.displayName} / Google Maps` : "Google Maps",
      creditUrl: author?.uri ?? author?.photoUri ?? candidate.googleMapsUri ?? null,
      license: "Google Maps",
      provider: "google" as const,
      verified: true as const,
      embeddable: false as const,
    };
  } catch {
    return null;
  }
}

async function exactPlacePhoto(place: NearbyBase) {
  const commonsReference = exactOsmImageReference(place.tags);
  if (commonsReference) {
    const photo = await exactCommonsPhoto(commonsReference);
    if (photo) return photo;
  }
  return exactGooglePhoto(place);
}

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
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "383ks-visitor-utility/3.0 (+https://www.383ks.com/visit)" },
      body: new URLSearchParams({ data: query }),
      cache: "no-store",
      signal: AbortSignal.timeout(18_000),
    });
    if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
    const payload = (await response.json()) as { elements?: OverpassElement[] };
    const nearestBase = Object.fromEntries(kinds.map((kind) => {
      const options = (payload.elements ?? []).flatMap((element) => {
        if (element.tags?.amenity !== kind) return [];
        const lat = element.lat ?? element.center?.lat;
        const lon = element.lon ?? element.center?.lon;
        if (lat === undefined || lon === undefined) return [];
        return [{
          kind,
          name: element.tags?.name ?? element.tags?.["name:sq"] ?? ({ police: "Polici", hospital: "Spital / ambulancë", fire_station: "Zjarrfikës", fuel: "Pikë karburanti" } as const)[kind],
          latitude: lat,
          longitude: lon,
          distanceKm: haversineKm({ latitude, longitude }, { latitude: lat, longitude: lon }),
          openingHours: element.tags?.opening_hours ?? null,
          tags: element.tags ?? {},
        }];
      }).sort((a, b) => a.distanceKm - b.distanceKm);
      return [kind, options[0] ?? null];
    })) as Record<NearbyKind, NearbyBase | null>;
    const nearest = Object.fromEntries(await Promise.all(kinds.map(async (kind) => {
      const place = nearestBase[kind];
      if (!place) return [kind, null];
      const { tags: _tags, ...safePlace } = place;
      return [kind, { ...safePlace, mapsUrl: mapsDirections(place.latitude, place.longitude), streetViewUrl: streetView(place.latitude, place.longitude), photo: await exactPlacePhoto(place) }];
    })));
    return NextResponse.json({
      nearest, fallbackSearches, degraded: false, attribution: "© OpenStreetMap contributors",
      note: "Only imagery tied to the exact place record is shown. Verify opening hours and call 112 in an emergency.",
    }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    return NextResponse.json({
      nearest: { police: null, hospital: null, fire_station: null, fuel: null }, fallbackSearches, degraded: true,
      attribution: "Google Maps search fallback", note: "The live map index is temporarily unavailable. Open a nearby search and verify the result before travelling.",
      detail: String(error instanceof Error ? error.message : error),
    }, { headers: { "Cache-Control": "private, max-age=60" } });
  }
}
