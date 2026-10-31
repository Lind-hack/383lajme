export declare const DAILY_KEY: string;
export declare const DAY_TURNS_AT_HOUR: number;
export declare const FRESH_MAX: number;
export interface DailyRecord {
  v: 1;
  day: string;
  sig: string;
  at: string;
  slugs: string[];
}
export function editionDay(now?: number): string;
export function followSignature(interests: unknown): string;
export function normalizeDaily(raw: unknown): DailyRecord | null;
export function pickDaily<I extends { article: { slug: string; publishedAt?: string }; kind: string }>(
  stored: unknown,
  opts: {
    day: string;
    signature: string;
    ranked: readonly I[];
    read: ReadonlySet<string>;
    now?: number;
    build: (candidates: I[]) => I[];
    freshMax?: number;
  }
): { record: DailyRecord; edition: I[]; fresh: I[]; rebuilt: boolean };
export function newForYou(
  items: readonly { article: { slug: string; publishedAt?: string } }[] | null | undefined,
  since: string | null,
  read: ReadonlySet<string>
): number;
export function readDaily(): unknown;
export function writeDaily(record: DailyRecord | null): void;
