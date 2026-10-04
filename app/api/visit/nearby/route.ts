import { NextResponse, type NextRequest } from "next/server";
import { haversineKm } from "@/lib/visit-border-server";
import { exactOsmImageReference, googleTypeForKind, selectExactGoogleCandidate } from "@/lib/visit-place-image.mjs";
import { EMERGENCY_CHECKED_AT, HOSPITALS, crowKm, photoMatchesName, pickBest, rankPlace } from "@/lib/visit-emergency.mjs";
import { BORDER_CROSSINGS } from "@/lib/visit-v2-data";

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

/** Wikimedia photos taken within metres of the place whose title names it. */
async function nearbyCommonsPhoto(place: NearbyBase) {
  try {
    const params = new URLSearchParams({
      action: "query", generator: "geosearch", ggscoord: `${place.latitude}|${place.longitude}`, ggsradius: "150", ggsnamespace: "6", ggslimit: "20",
      prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "900", format: "json", origin: "*",
    });
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": "383ks-visitor-utility/3.1 (+https://www.383ks.com/visit)" }, cache: "no-store", signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { query?: { pages?: Record<string, CommonsPage> } };
    const page = Object.values(payload.query?.pages ?? {}).find((p) => photoMatchesName(p.title, place.name) && p.imageinfo?.[0]?.thumburl?.startsWith("https://upload.wikimedia.org/"));
    const info = page?.imageinfo?.[0];
    if (!page || !info?.thumburl) return null;
    const metadata = info.extmetadata ?? {};
    return {
      url: info.thumburl,
      sourceUrl: info.descriptionurl ?? `https://commons.wikimedia.org/?curid=${page.pageid}`,
      title: stripTags(metadata.ImageDescription?.value) || page.title.replace(/^File:/, ""),
      credit: stripTags(metadata.Artist?.value) || "Wikimedia Commons",
      license: stripTags(metadata.LicenseShortName?.value) || "Commons licence",
      provider: "wikimedia" as const, verified: true as const, embeddable: true as const,
    };
  } catch {
    return null;
  }
}

/** Driving minutes and kilometres from one point to many (OSRM); null where routing failed. */
async function drive(from: { lat: number; lon: number }, to: { lat: number; lon: number }[]) {
  if (!to.length) return [];
  try {
    const coords = [from, ...to].map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(";");
    const response = await fetch(`https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=duration,distance`, {
      headers: { "User-Agent": "383ks-visitor-utility/3.1 (+https://www.383ks.com/visit)" }, cache: "no-store", signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) throw new Error(String(response.status));
    const payload = await response.json() as { durations?: (number | null)[][]; distances?: (number | null)[][] };
    return to.map((_, i) => {
      const seconds = payload.durations?.[0]?.[i + 1];
      const meters = payload.distances?.[0]?.[i + 1];
      return typeof seconds === "number" && typeof meters === "number" ? { minutes: Math.max(1, Math.round(seconds / 60)), km: meters / 1000 } : null;
    });
  } catch {
    return to.map(() => null);
  }
}

type Option = NearbyBase & { rank: number | null; km: number; minutes?: number | null };

/** Overpass mirrors, tried in order: any one of them being busy is common. */
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
/** Map results per ~1 km cell for 30 minutes: places don't move, and it spares the mirrors. */
const mapCache = new Map<string, { at: number; elements: OverpassElement[] }>();

/** Police, hospitals, clinics and fuel around a point; null when every mirror failed. */
async function mapElements(query: string, cell: string): Promise<OverpassElement[] | null> {
  const hit = mapCache.get(cell);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.elements;
  for (const url of OVERPASS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "383ks-visitor-utility/3.1 (+https://www.383ks.com/visit)" },
        body: new URLSearchParams({ data: query }),
        cache: "no-store",
        signal: AbortSignal.timeout(9_000),
      });
      if (!response.ok) continue;
      const text = await response.text();
      if (!text.startsWith("{")) continue; // a busy mirror answers with an HTML/XML error page
      const elements = (JSON.parse(text) as { elements?: OverpassElement[] }).elements ?? [];
      if (mapCache.size > 500) mapCache.delete(mapCache.keys().next().value as string);
      mapCache.set(cell, { at: Date.now(), elements });
      return elements;
    } catch {
      // Try the next mirror.
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("lat"));
  const longitude = Number(request.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 41 || latitude > 44 || longitude < 19 || longitude > 23) {
    return NextResponse.json({ error: "Location is outside the supported Kosovo area." }, { status: 400 });
  }
  const here = { lat: latitude, lon: longitude };
  const query = `[out:json][timeout:15];(nw(around:15000,${latitude.toFixed(5)},${longitude.toFixed(5)})[amenity~"^(police|hospital|clinic|fuel)$"];);out center tags 150;`;
  const fallbackSearches = {
    police: `https://www.google.com/maps/search/stacioni+policor/@${latitude},${longitude},14z`,
    hospital: `https://www.google.com/maps/search/spitali/@${latitude},${longitude},13z`,
    fire_station: `https://www.google.com/maps/search/zjarrfikesit/@${latitude},${longitude},14z`,
    fuel: `https://www.google.com/maps/search/pike+karburanti/@${latitude},${longitude},14z`,
  };
  const elements = await mapElements(query, `${latitude.toFixed(2)},${longitude.toFixed(2)}`);
  const degraded = elements === null;
  try {
    const fromMap = (kind: NearbyKind, amenities: string[]): Option[] => (elements ?? []).flatMap((element) => {
      const tags = element.tags;
      if (!tags || !amenities.includes(tags.amenity)) return [];
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (lat === undefined || lon === undefined) return [];
      if (tags.amenity === "clinic" && !/qkmf|urgjenc|emergjenc/i.test(tags.name ?? "")) return [];
      const name = tags["name:sq"] ?? tags.name ?? ({ police: "Polici", hospital: "Spital", fire_station: "Zjarrfikës", fuel: "Pikë karburanti" } as const)[kind];
      const km = crowKm(here, { lat, lon });
      return [{ kind, name, latitude: lat, longitude: lon, distanceKm: km, km, openingHours: tags.opening_hours ?? null, tags, rank: rankPlace(kind, tags) }];
    });
    const checkedHospitals: Option[] = HOSPITALS.map((h) => {
      const km = crowKm(here, h);
      return { kind: "hospital" as const, name: h.name, latitude: h.lat, longitude: h.lon, distanceKm: km, km, openingHours: "24/7", tags: {}, rank: 0 };
    }).filter((h) => h.km < 60);
    const candidates: Record<"police" | "hospital" | "fuel", Option[]> = {
      police: fromMap("police", ["police"]),
      // The checked list, plus map entries that mark an emergency department.
      hospital: [...checkedHospitals, ...fromMap("hospital", ["hospital", "clinic"]).filter((o) => o.rank === 0 || o.rank === 2)],
      fuel: fromMap("fuel", ["fuel"]),
    };
    // Route the closest few suitable options of each kind, and every border crossing, in one call.
    const shortlist = {
      police: candidates.police.filter((o) => o.rank !== null).sort((a, b) => a.km - b.km).slice(0, 4),
      hospital: candidates.hospital.filter((o) => o.rank !== null).sort((a, b) => a.km - b.km).slice(0, 4),
      fuel: candidates.fuel.filter((o) => o.rank !== null).sort((a, b) => a.km - b.km).slice(0, 4),
    };
    const flat = [...shortlist.police, ...shortlist.hospital, ...shortlist.fuel];
    const crossings = BORDER_CROSSINGS.map((c) => ({ id: c.id, name: c.name, lat: c.latitude, lon: c.longitude }));
    const routes = await drive(here, [...flat.map((o) => ({ lat: o.latitude, lon: o.longitude })), ...crossings]);
    const routed = routes.some(Boolean);
    flat.forEach((o, i) => {
      const r = routes[i];
      if (r) {
        o.minutes = r.minutes;
        o.km = r.km;
      }
    });
    const crossingTimes = crossings
      .map((c, i) => {
        const r = routes[flat.length + i];
        return { id: c.id, name: c.name, km: r?.km ?? crowKm(here, c), minutes: r?.minutes ?? null };
      })
      .sort((a, b) => (a.minutes ?? a.km * 1.6) - (b.minutes ?? b.km * 1.6));
    const nearestBase = {
      police: pickBest(shortlist.police) as Option | null,
      hospital: pickBest(shortlist.hospital) as Option | null,
      fuel: pickBest(shortlist.fuel) as Option | null,
    };
    const nearest = Object.fromEntries(await Promise.all((["police", "hospital", "fuel"] as const).map(async (kind) => {
      const place = nearestBase[kind];
      if (!place) return [kind, null];
      const photo = (await exactPlacePhoto(place)) ?? (await nearbyCommonsPhoto(place));
      return [kind, {
        name: place.name, latitude: place.latitude, longitude: place.longitude,
        distanceKm: place.km, minutes: place.minutes ?? null, byRoad: place.minutes != null,
        openingHours: place.openingHours, mapsUrl: mapsDirections(place.latitude, place.longitude),
        streetViewUrl: streetView(place.latitude, place.longitude), photo,
      }];
    })));
    return NextResponse.json({
      nearest: { ...nearest, fire_station: null }, crossing: crossingTimes[0] ?? null, crossings: crossingTimes,
      fallbackSearches, degraded, routed, attribution: "© OpenStreetMap contributors · routes: OSRM",
      note: "Emergency hospitals are a checked list; other places come from OpenStreetMap. In an emergency call 112.",
      checkedAt: EMERGENCY_CHECKED_AT,
    }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    return NextResponse.json({
      nearest: { police: null, hospital: null, fire_station: null, fuel: null }, crossing: null, crossings: [], fallbackSearches, degraded: true, routed: false,
      attribution: "Google Maps search fallback", note: "The live map index is temporarily unavailable. Open a nearby search and verify the result before travelling.",
      detail: String(error instanceof Error ? error.message : error),
    }, { headers: { "Cache-Control": "private, max-age=60" } });
  }
}
