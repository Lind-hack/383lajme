export const ANONYMOUS_NAME: "Anonim";
export function publicProfileName(
  profile: { display_name?: string | null; is_anonymous?: boolean | null } | null | undefined,
  fallback?: string
): string;
export function cleanDisplayName(value: unknown): string;
export function normalizeBookmarkIds(value: unknown, limit?: number): string[];
export function buildBalanceHistory(
  transactions: { created_at: string; amount: number }[],
  currentCoins: number,
  nowMs?: number,
  days?: number
): { t: number; coins: number }[];
