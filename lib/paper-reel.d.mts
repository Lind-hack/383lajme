export declare const SECTION_STORIES: number;
type ItemOf<S> = S extends { items?: readonly (infer I)[] } ? I : never;
export type ReelSlide<T, S> = { n: number; key: string; title: string } & (
  | { kind: "cover" }
  | { kind: "brief"; box: string; group: string; groupTitle: string; pos: number; of: number }
  | { kind: "story"; item: T | ItemOf<S>; group: string; groupTitle: string; section?: S; pos: number; of: number }
  | { kind: "section"; section: S; count: number; hidden: number }
  | { kind: "end"; quiet: S[] }
);
export function reelSlides<T extends { article: { slug: string; title: string } }, S extends { key: string; title: string; kind: string; empty?: boolean; items?: readonly unknown[] }>(
  paper: { edition?: readonly T[]; sections?: readonly S[] } | null | undefined,
  opts?: { boxes?: readonly string[]; sectionScreens?: boolean }
): ReelSlide<T, S>[];
export type MoreItem<A> = { article: A; kind: string; primaryKey?: string; keys?: string[] };
export function moreStories<A extends { slug: string; engagementScore?: number }>(from?: {
  ranked?: readonly MoreItem<A>[];
  pool?: readonly A[];
  older?: readonly A[];
  taken?: ReadonlySet<string>;
  read?: ReadonlySet<string>;
  n?: number;
}): MoreItem<A>[];
export function slideFromHash(hash: unknown, count: number): number;
export function hashForSlide(index: number): string;
