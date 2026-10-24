export declare const MAX_MUST_KNOW: number;
export declare const MUST_KNOW_MS: number;
export declare const SECOND_WITHIN: number;
export declare const MIN_SCORE: number;
export declare const DECAY_PER_HOUR: number;
export declare const PER_PIECE: number;
export function mustKnow<A extends { slug: string; title: string; category?: string; publishedAt?: string; engagementScore?: number }>(
  pool: readonly A[] | null | undefined,
  opts?: { now?: number; read?: ReadonlySet<string> }
): A[];
