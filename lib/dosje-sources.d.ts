/**
 * Types for dosje-sources.mjs.
 *
 * A source is what actually came back from a fetch, which is why every field
 * that can be absent is typed as absent: a citation the pipeline could not
 * resolve has to be representable, so it can be refused rather than assumed.
 */
export interface FetchedSource {
  url: string;
  publisher: string | null;
  tier: number | null;
  fetched_at: string;
  http_status: number | null;
  title?: string | null;
  published_date?: string | null;
  image?: string | null;
  text: string;
  quote?: string | null;
  error?: string;
  ms?: number;
  lead?: string;
}

export declare const PUBLISHER_TIERS: { tier: number; hosts: string[] }[];
export declare function tierOf(url: string): number | null;
export declare function publisherOf(url: string): string | null;
export declare function fetchSource(url: string, opts?: { timeoutMs?: number }): Promise<FetchedSource>;
export declare function searchSources(
  query: string,
  opts?: { limit?: number; timeoutMs?: number }
): Promise<{ url: string; title: string | null; published_date: string | null; lead?: string }[]>;
export declare function gatherEvidence(query: string, opts?: { max?: number }): Promise<FetchedSource[]>;
