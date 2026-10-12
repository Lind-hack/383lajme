export type StoryReactionKey = "zemerim" | "dyshim" | "qesharake" | "dakord" | "shprese";
export declare const STORY_REACTIONS: readonly { key: StoryReactionKey; emoji: string; label: string }[];
export declare const MAX_SLUGS: number;
export declare const TOP_MIN: number;
export declare const MINE_KEY: string;
export type Tally = Partial<Record<StoryReactionKey, number>>;
export function isReaction(v: unknown): v is StoryReactionKey;
export function isStorySlug(v: unknown): v is string;
export function isVoter(v: unknown): v is string;
export function parseSlugs(input: unknown): string[];
export function talliesFrom(rows: unknown): Record<string, Tally>;
export function shares(tally: Tally | null | undefined): {
  total: number;
  list: { key: StoryReactionKey; emoji: string; label: string; n: number; pct: number }[];
};
export function topLine(tally: Tally | null | undefined): null | { key: StoryReactionKey; emoji: string; label: string; n: number; pct: number; total: number };
export function normalizeMine(raw: unknown): Record<string, StoryReactionKey>;
