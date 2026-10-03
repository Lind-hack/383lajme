export declare const NAME_KEY: string;
export function normalizeName(raw: unknown): string;
export function genitive(raw: unknown): string | null;
export function paperName(raw: unknown): string;
export function readName(): string;
export function writeName(raw: unknown): string;
export interface PaperTitle {
  id: string;
  /** "Kurieri i" — followed by the reader's name in the genitive. */
  of: string;
  /** "Kurieri yt" — when the name cannot be declined. */
  own: string;
}
export declare const TITLES: readonly PaperTitle[];
export function isTitleId(id: unknown): boolean;
export function defaultTitle(raw: unknown): string;
export function paperTitle(raw: unknown, titleId?: string | null): string;
export function sharedTitle(raw: unknown, titleId?: string | null): string;
