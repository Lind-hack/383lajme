export declare const FRONT_STORIES: number;
export interface PageContentsEntry {
  n: number;
  title: string;
  key: string;
}
export type PaperPage<T, S> =
  | { kind: "front"; key: "front"; n: number; title: string; lead: T | null; stories: T[]; contents: PageContentsEntry[] }
  | { kind: "more"; key: "more"; n: number; title: string; stories: T[] }
  | { kind: "section"; key: string; n: number; title: string; section: S }
  | { kind: "back"; key: "back"; n: number; title: string; quiet: S[] };
export function paperPages<T, S extends { key: string; title: string; kind: string; empty: boolean }>(
  paper: { edition: readonly T[]; sections: readonly S[] } | null | undefined
): PaperPage<T, S>[];
export function pageFromHash(hash: unknown, count: number): number;
export function hashForPage(index: number): string;
