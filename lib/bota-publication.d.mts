export const BOTA_VERSION: number;
export function botaArticleId(url: string): string;
export function kosovoDay(): string;
export function validateBotaPublication(input: unknown, today?: string): {date:string;model:string;reasoningEffort:string;articles:any[]};
export function articleIndex(positive: number, neutral: number, negative: number): number | null;
export function buildBotaSnapshot(articles:any[],day:string,collectedAt?:string|null): {outlets:any;history:any[]};
