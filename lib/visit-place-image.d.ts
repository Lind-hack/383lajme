export type VisitNearbyKind = "police" | "hospital" | "fire_station" | "fuel";

export function normalizePlaceName(value?: string): string;
export function namesDescribeSamePlace(left: string, right: string): boolean;
export function googleTypeForKind(kind: VisitNearbyKind): string | null;
export function selectExactGoogleCandidate<T>(
  place: { name: string; latitude: number; longitude: number },
  candidates: T[],
  distanceKm: (
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
  ) => number,
): T | null;
export function exactOsmImageReference(tags?: Record<string, string>): string | null;
