export declare const LEDGER_KEY: string;
export declare const LEDGER_VERSION: number;
export declare const MAX_MONTHS: number;
export declare const MAX_KEYS: number;

export interface LedgerMonth {
  visitDays: number[];
  readIds: string[];
  reads: number;
  readHours: number[];
  people: Record<string, number>;
  cities: Record<string, number>;
  categories: Record<string, number>;
  questions: number;
}

export interface Ledger {
  v: number;
  firstSeen: string | null;
  months: Record<string, LedgerMonth>;
}

export interface LedgerSummary {
  reads: number;
  questions: number;
  days: number;
  topPeople: [string, number][];
  topCities: [string, number][];
  topCategories: [string, number][];
  readHours: number[];
  beforeNine: number | null;
}

export function emptyLedger(): Ledger;
export function normalizeLedger(raw: unknown): Ledger;
export function kosovoParts(now?: number): { month: string; day: number; hour: number; date: string };
export function recordVisit(ledger: unknown, now?: number): Ledger;
export function recordRead(ledger: unknown, slug: string, keys: readonly string[], now?: number): Ledger;
export function recordQuestion(ledger: unknown, now?: number): Ledger;
export function daysWithUs(ledger: unknown): number;
export function longestStreak(ledger: unknown): number;
export function summarize(ledger: unknown, span: { from: string; to: string }): LedgerSummary;

export function readLedger(): Ledger;
export function noteVisit(now?: number): void;
export function noteRead(slug: string, keys: readonly string[], now?: number): void;
export function noteQuestion(now?: number): void;
export function forgetLedger(): void;
