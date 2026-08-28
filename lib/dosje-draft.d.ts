import type { FetchedSource } from "./dosje-sources";

export interface DraftClaim {
  sentence?: string;
  source_indexes?: number[];
}

export interface ValidatedMilestone {
  title: string;
  summary: string;
  why: string | null;
  tag: string | null;
  event_date: string;
  date_precision: "day" | "month" | "year";
  display_date: string;
  dedupe_key: string;
  claims: { sentences: DraftClaim[] };
}

export interface ValidatedCitation {
  url: string;
  publisher: string | null;
  source_title: string | null;
  source_date: string | null;
  quote: string | null;
}

/** Refusal reasons are stable slugs so logs and the review queue can key on them. */
export type RefusalReason =
  | "title_missing" | "summary_too_short" | "citation_index_invalid" | "no_citations"
  | "tertiary_sources_only" | "insufficient_publishers" | "event_date_invalid"
  | "event_date_in_future" | "event_date_unsupported" | "uncited_sentence"
  | "figure_not_in_sources";

export declare const TERTIARY_HOSTS: string[];
export declare const MIN_PUBLISHERS: number;
export declare function hostOf(url: string): string | null;
export declare function isTertiary(url: string): boolean;
export declare function figuresIn(text: string): Set<string>;
export declare function sentencesIn(text: string): string[];
export declare function validateMilestoneDraft(
  raw: unknown,
  opts?: { sources?: FetchedSource[]; now?: Date }
):
  | { ok: true; milestone: ValidatedMilestone; citations: ValidatedCitation[] }
  | { ok: false; reasons: RefusalReason[]; unsupportedFigures: string[] };
