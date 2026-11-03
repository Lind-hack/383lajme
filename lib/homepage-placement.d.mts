import type { Article } from './mock-data';
export type HomepagePlacement = { article_id: string; starts_at: string; ends_at: string };
export function applyHomepagePlacement(ranked: Article[], article: Article | null, placement: HomepagePlacement | null, now?: number): Article[];
