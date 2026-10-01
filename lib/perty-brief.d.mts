export declare const MAX_SLUGS: number;
export declare const MIN_SLUGS: number;
export declare const MAX_LINES: number;
export declare const BRIEF_SYSTEM: string;
export function validSlugs(raw: unknown): string[];
export function briefKey(slugs: readonly string[]): string;
export function buildBriefPrompt(
  articles: readonly { slug: string; title: string; excerpt?: string | null; body?: string | null }[]
): string;
export function cleanBrief(raw: unknown, allowed: readonly string[]): { slug: string; text: string }[];
