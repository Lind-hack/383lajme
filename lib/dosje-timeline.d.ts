export declare function orderTimeline<E extends { kind: string; eventDate?: string | null; publishedAt?: string | null }>(
  entries: E[]
): E[];
