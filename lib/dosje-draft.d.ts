import type { FetchedSource } from "./dosje-sources";

export interface DraftQuote {
  source: number;
  text: string;
}

export interface DraftClaim {
  sentence?: string;
  quotes?: DraftQuote[];
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
  claims: { sentences: Array<{ sentence: string; quotes: Array<DraftQuote & { url: string; publisher: string | null }> }> };
}

export interface ValidatedCitation {
  url: string;
  publisher: string | null;
  source_title: string | null;
  source_date: string | null;
  archive_url: string | null;
  quote: string | null;
}

/** Refusal reasons are stable slugs so logs and the review queue can key on them. */
export type RefusalReason =
  | "title_missing" | "summary_too_short" | "citation_index_invalid" | "no_citations"
  | "tertiary_sources_only" | "claim_needs_two_publishers" | "quote_not_in_source"
  | "event_date_invalid" | "event_date_in_future" | "event_date_not_in_quotes"
  | "uncited_sentence" | "figure_not_in_quotes";

export declare const TERTIARY_HOSTS: string[];
export declare const MIN_PUBLISHERS: number;
export declare function hostOf(url: string): string | null;
export declare function isTertiary(url: string): boolean;
export declare function figuresIn(text: string): Set<string>;
export declare function sentencesIn(text: string): string[];
export declare const MIN_QUOTE: number;
export declare function quoteIsIn(quote: string, text: string): boolean;
export declare function dateInText(text: string, iso: string, precision?: "day" | "month" | "year"): boolean;
export declare function displayDateSq(iso: string, precision?: "day" | "month" | "year"): string;
export declare function validateMilestoneDraft(
  raw: unknown,
  opts?: { sources?: FetchedSource[]; now?: Date }
):
  | { ok: true; milestone: ValidatedMilestone; citations: ValidatedCitation[] }
  | { ok: false; reasons: RefusalReason[]; unsupportedFigures: string[] };
export declare function revalidateStored(
  row: unknown,
  now?: Date
):
  | { ok: true; milestone: ValidatedMilestone; citations: ValidatedCitation[] }
  | { ok: false; reasons: RefusalReason[]; unsupportedFigures: string[] };
