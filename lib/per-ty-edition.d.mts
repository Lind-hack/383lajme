export declare const WORDS_PER_MINUTE: number;
export declare const MIN_MINUTES: number;

export interface EditionItem {
  article: { slug: string; title?: string; excerpt?: string };
  reason: string;
  kind: string;
}

export interface MoreGroup<I> {
  key: string;
  title: string;
  kind: "person" | "city" | "topics";
  items: I[];
}

export function readingMinutes(
  items: readonly { article: { title?: string; excerpt?: string } }[] | null | undefined
): number;

export function buildEdition<I extends EditionItem>(
  feed: readonly I[] | null | undefined,
  opts?: { size?: number; perReason?: number; homeFrom?: string | null }
): { edition: I[]; more: MoreGroup<I>[]; minutes: number };
