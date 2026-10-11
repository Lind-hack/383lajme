export type LookId = "e-perditshme" | "sporti" | "tabloid" | "bota" | "biznes";
export interface Look {
  id: LookId;
  name: string;
  about: string;
  motto: string;
  cats: readonly string[];
}
export interface LookState {
  look: LookId;
  since: string;
}
export declare const LOOK_KEY: string;
export declare const LOOKS: readonly Look[];
export declare const LOOK_IDS: readonly LookId[];
export declare const PICK_POINTS: number;
export declare const SWITCH_MARGIN: number;
export declare const MIN_STAND_MS: number;
export function lookById(id: unknown): Look | null;
export function readingMix(interests: unknown, now?: number): Record<LookId, number>;
export function normalizeLookState(raw: unknown): LookState | null;
export function resolveLook(
  mix: Record<string, number>,
  stored: unknown,
  opts?: { locked?: string | null; now?: number }
): { look: LookId; state: LookState | null; changed: null | { from: LookId; to: LookId; share: number } };
export function editionName(ledger: unknown): string;
export function readingPace(interests: unknown, now?: number): "short" | "medium" | "long";
export function readLookState(storage?: Storage): LookState | null;
export function writeLookState(state: unknown, storage?: Storage): boolean;
