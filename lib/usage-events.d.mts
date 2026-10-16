export const FEATURES: Record<string, string>;
export const BUTTONS: Record<string, string[]>;
export function publicPath(value: unknown): string | null;
export function featureForPath(path: string): string;
export function buttonAction(label: string): string;
export type UsageRow = { id: string; path: string; feature: string; kind: 'page' | 'click' | 'active'; action: string | null; target_path: string | null; seconds: number };
export function parseUsageBatch(body: unknown): { visitor: string; session: string; events: UsageRow[] } | null;
