export type PaperStyle = "klasike" | "moderne" | "nate";
export type PaperAccent = "portokalli" | "blu" | "gjelber" | "vjollce" | "kuqe";
export type PaperLength = 5 | 7 | 10;
export type PaperBox = "brief" | "city" | "tregu" | "numbers";

export interface PaperPrefs {
  v: number;
  /** A TITLES id from lib/reader-name.mjs, or "" for the name's default. */
  title: string;
  style: PaperStyle;
  accent: PaperAccent;
  length: PaperLength;
  order: string[];
  hidden: string[];
  boxes: Record<PaperBox, boolean>;
}

export declare const PREFS_KEY: string;
export declare const PREFS_VERSION: number;
export declare const STYLES: readonly PaperStyle[];
export declare const ACCENTS: readonly PaperAccent[];
export declare const LENGTHS: readonly PaperLength[];
export declare const BOXES: readonly PaperBox[];

export function defaultPrefs(): PaperPrefs;
export function normalizePrefs(raw: unknown): PaperPrefs;
export function orderedKeys(order: readonly string[] | null | undefined, fallback: readonly string[] | null | undefined): string[];
export function moveKey(keys: readonly string[] | null | undefined, key: string, step: number): string[];
export function readPrefs(storage?: Storage): PaperPrefs;
export function writePrefs(prefs: unknown, storage?: Storage): boolean;
