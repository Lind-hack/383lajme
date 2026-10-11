export interface ShownLog {
  date: string;
  items: { slug: string; key: string }[];
}
export declare const SHOWN_KEY: string;
export declare const SKIP_PENALTY: number;
export function normalizeShown(raw: unknown): ShownLog | null;
export function noteShown(log: unknown, today: string, items: readonly { slug: string; key?: string }[]): ShownLog;
export function settleSkips(
  log: unknown,
  readSlugs: Iterable<string>,
  today: string
): { penalties: Record<string, number>; log: ShownLog | null };
export function readShown(storage?: Storage): ShownLog | null;
export function writeShown(log: ShownLog | null, storage?: Storage): boolean;
