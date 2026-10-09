import type { NavCategory } from "./category-map";

export type LearnedPicks = { categories: NavCategory[]; people: string[]; cities: string[]; home: string | null };

export const REVEAL_READS: number;
export const PICK_MIN: number;
export const HOME_MIN: number;
export const OFFER_KEY: string;
export const OFFER_PAUSE_MS: number;
export const LEARNED_KEY: string;

export function learnedPicks(affinity: unknown, now?: number): LearnedPicks;
export function hasLearnedPaper(picks: LearnedPicks | null | undefined): boolean;
export function totalReads(ledger: unknown): number;
export function shouldOffer(state: {
  reads: number;
  picks: LearnedPicks;
  chosen: boolean;
  lastOffer: number | null;
  now?: number;
}): boolean;
export function pickChips(picks: LearnedPicks | null | undefined): { key: string; label: string }[];
export function withoutChips(picks: LearnedPicks | null | undefined, off: Iterable<string> | null | undefined): LearnedPicks;
export function readLastOffer(): number | null;
export function noteOffer(now?: number): void;
export function isLearnedPaper(): boolean;
export function setLearnedPaper(on: boolean): void;
