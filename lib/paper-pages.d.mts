export declare const FRONT_STORIES: number;
export declare const MORE_PER_PAGE: number;
export declare const SECTION_STORIES: number;
export interface PageContentsEntry {
  n: number;
  title: string;
  key: string;
  /** Stories on that page; 0 for the back page. */
  count: number;
}
type SectionItem<S> = S extends { items: readonly (infer I)[] } ? I : never;
export type PaperPage<T, S> =
  | { kind: "front"; key: "front"; n: number; title: string; lead: T | null; stories: T[] }
  | { kind: "index"; key: "index"; n: number; title: string; contents: PageContentsEntry[] }
  | { kind: "more"; key: string; n: number; title: string; stories: T[]; from: number }
  | { kind: "section"; key: string; n: number; title: string; section: S; items: SectionItem<S>[]; hidden: number }
  | { kind: "back"; key: "back"; n: number; title: string; quiet: S[]; about: boolean }
  | { kind: "about"; key: "about"; n: number; title: string; quiet: S[] };
export function paperPages<T, S extends { key: string; title: string; kind: string; empty: boolean; items?: readonly unknown[] }>(
  paper: { edition: readonly T[]; sections: readonly S[] } | null | undefined
): PaperPage<T, S>[];
export function pageFromHash(hash: unknown, count: number): number;
export function hashForPage(index: number): string;
export function spreadStart(index: number, perView: 1 | 2): number;
