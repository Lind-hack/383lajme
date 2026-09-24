export interface Person {
  id: string;
  name: string;
  group: string;
  match: string[];
}
export declare const PEOPLE: Person[];
export declare const PEOPLE_GROUPS: string[];
export function personById(id: unknown): Person | null;
export function isPersonId(id: unknown): boolean;
export function derivedPersonId(name: string): string;
