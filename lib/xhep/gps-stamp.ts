/**
 * Ask the server for a gold stamp: one fresh position, sent once, never kept
 * (app/api/xhep/stamp). Returns the signed stamp, or why there is none.
 */
export type GpsStampResult =
  | { ok: true; stamp: string }
  | { ok: false; code: "denied" | "too_far" | "low_accuracy" | "no_location" | "unknown_place" | "generic"; distanceM?: number };

export async function requestGpsStamp(placeId: string, seed: string): Promise<GpsStampResult> {
  let position: GeolocationPosition;
  try {
    position = await new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("unsupported"));
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 });
    });
  } catch {
    return { ok: false, code: "denied" };
  }
  try {
    const response = await fetch("/api/xhep/stamp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeId,
        seed,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
    });
    const payload = (await response.json()) as { ok?: boolean; stamp?: string; code?: string; distanceM?: number };
    if (response.ok && payload.ok && payload.stamp) return { ok: true, stamp: payload.stamp };
    const code = (["too_far", "low_accuracy", "no_location", "unknown_place"] as const).find((c) => c === payload.code) ?? "generic";
    return { ok: false, code, distanceM: payload.distanceM };
  } catch {
    return { ok: false, code: "generic" };
  }
}
