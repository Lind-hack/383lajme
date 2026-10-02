export function absence(ledger: unknown, today: string): { missed: number; last: string } | null;
export function followUp<
  A extends { slug: string; title: string; excerpt?: string; category?: string; city?: string; publishedAt?: string },
>(
  edition: readonly { article: A }[] | null | undefined,
  pool: readonly A[] | null | undefined,
  read: ReadonlySet<string>
): { before: A; after: A } | null;
