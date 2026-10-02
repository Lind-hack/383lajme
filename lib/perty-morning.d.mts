export declare const MORNING_HOUR: number;
export declare const RECENT_MS: number;
export declare const MORNING_NOTE: { title: string; body: string; url: string };
export function validEndpoint(raw: unknown): string | null;
export function kosovoNow(now?: Date): { hour: number; date: string };
export function isMorningWindow(now?: Date): boolean;
export function isRecentSend(lastSentAt: string | null | undefined, now?: Date): boolean;
