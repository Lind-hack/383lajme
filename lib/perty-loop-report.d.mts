export type LoopEvent = { path: string; visitor_hash: string; created_at: string; kind: string; action: string | null };
export function pertyLoopReport(events: LoopEvent[], now?: Date): { cohorts: unknown[]; [key: string]: unknown };
