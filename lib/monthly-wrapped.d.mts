export interface WrappedStory {
  slug: string;
  title: string;
  imageUrl: string | null;
}
export interface WrappedRegion {
  key: "kosove" | "shqiperi" | "bote";
  label: string;
  count: number;
  top: WrappedStory | null;
}
export interface MonthWrappedData {
  month: string;
  title: string;
  monthName: string;
  year: number;
  total: number;
  days: number;
  regions: WrappedRegion[];
  person: { id: string; name: string; count: number; top: WrappedStory | null } | null;
  busiest: { date: string; count: number; label: string; top: WrappedStory | null } | null;
}
export type WrappedCard = "hyrje" | "kosove" | "shqiperi" | "bote" | "emri" | "dita";

export declare const REGIONS: { key: string; category: string; label: string }[];
export declare const CARDS: WrappedCard[];
export function parseMonth(raw: unknown): { year: number; month: number } | null;
export function monthLabel(raw: unknown): { definite: string; name: string; year: number } | null;
export function kosovoDate(iso: string | null | undefined): string | null;
export function monthRange(raw: unknown): { from: string; to: string } | null;
export function isMonthOver(raw: unknown, now?: Date): boolean;
export function lastMonth(now?: Date): string;
export function buildMonthWrapped(
  articles: readonly {
    slug: string;
    title: string;
    excerpt?: string;
    category?: string;
    city?: string;
    publishedAt: string;
    engagementScore?: number;
    imageUrl?: string;
  }[],
  month: string
): MonthWrappedData | null;
export function cardsFor(wrapped: MonthWrappedData | null): WrappedCard[];
