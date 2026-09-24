export interface City {
  id: string;
  name: string;
  /** Feed label, e.g. "Nga Prizreni". */
  from: string;
  forms: string[];
}
export declare const CITIES: City[];
export function cityById(id: unknown): City | null;
export function isCityId(id: unknown): boolean;
