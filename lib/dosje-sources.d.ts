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
  /** Snapshot actually read when the live url did not resolve; null otherwise. */
  archive_url?: string | null;
  via_archive?: boolean;
}

export declare const PUBLISHER_TIERS: { tier: number; hosts: string[] }[];
export declare function tierOf(url: string): number | null;
export declare function publisherOf(url: string): string | null;
export declare function fetchSource(
  url: string,
  opts?: {
    timeoutMs?: number;
    /** Injected for tests so the fallback can be exercised without network. */
    fetchImpl?: typeof fetch;
    /** Set false to refuse the archive and report the live failure as-is. */
    archive?: boolean;
    /** yyyymmdd; steers which snapshot is returned. */
    timestamp?: string | null;
  }
): Promise<FetchedSource>;

/**
 * False for a url no request can ever satisfy — a reserved host (RFC 2606 /
 * 6761) or a non-http scheme. Used to keep placeholder citations out of the
 * link-rot rotation instead of reporting them as links that just died.
 */
export declare function isFetchableCitationUrl(url: string): boolean;

export declare const WAYBACK_AVAILABILITY: string;
export declare function archiveSnapshot(
  url: string,
  opts?: { timeoutMs?: number; fetchImpl?: typeof fetch; timestamp?: string | null }
): Promise<string | null>;
/** A four-digit year in the query, as a yyyymmdd Wayback timestamp, or null. */
export declare function timestampForQuery(query: string): string | null;
export declare function relevanceGroupsForQuery(query: string): string[][];
export declare function sourceMatchesProfile(
  source: { title?: string | null; text?: string | null },
  groups: string[][]
): boolean;
export declare function searchSources(
  query: string,
  opts?: { limit?: number; timeoutMs?: number }
): Promise<{ url: string; title: string | null; published_date: string | null; lead?: string }[]>;
export declare function gatherEvidence(
  query: string,
  opts?: { max?: number; relevanceGroups?: string[][] | null }
): Promise<FetchedSource[]>;
