export function njoftimeBudget(unclaimedCount: number): number;
export function selectHomeTail<T extends { id: string }>(
  articles: T[],
  latest: T[],
  claimed: ReadonlySet<string | undefined>,
): { recent: T[]; story: T | undefined; archive: T[] };
