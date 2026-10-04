export declare const EMERGENCY_CHECKED_AT: string;
export declare const HOSPITALS: readonly { name: string; city: string; lat: number; lon: number; osm: string }[];
export function rankPlace(kind: "police" | "hospital" | "fuel" | "fire_station", tags?: Record<string, string>): number | null;
export function crowKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number;
export function pickBest<T extends { rank: number | null; minutes?: number | null; km: number }>(options: T[]): T | null;
export function photoMatchesName(fileTitle: string, placeName: string): boolean;
