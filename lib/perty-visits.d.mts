export declare const VISIT_KEY: string;
export declare const READ_KEY: string;
export declare const SAME_VISIT_MS: number;
export function nextVisit(stored: unknown, now?: number): { last: string; since: string | null };
export function isNewSince(article: { publishedAt?: string } | null | undefined, since: string | null): boolean;
export function normalizeRead(raw: unknown): string[];
export function markRead(raw: unknown, slug: unknown): string[];
export function recordVisit(now?: number): string | null;
export function readSlugs(): string[];
export function rememberRead(slug: string, now?: number): void;
export function forgetVisits(): void;

export const TODAY_READ_KEY: string;
export function readTodaySlugs(now?: number): string[];
