export declare const READ_WPM: number;
export declare const OPEN_WEIGHT: number;
export declare const FULL_WEIGHT: number;
export declare const BOUNCE_S: number;
export declare const REAL_READ_S: number;
export function expectedSeconds(words: number): number;
export function visitWeight(visit: { engagedS?: number; depth?: number; words?: number }): number;
export function weightToAdd(credited: number, total: number): number;
export function countWords(text: unknown): number;
