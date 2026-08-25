export interface TopicMilestone {
  year: string;
  date: string;
  tag: string;
  title: string;
  summary: string;
  why: string;
}

export interface Topic {
  slug: string;
  title: string;
  blurb: string;
  forms: string[];
  milestones: TopicMilestone[];
}

export interface TimelineEntry {
  kind: "milestone" | "article";
  id: string;
  year?: string;
  date?: string;
  tag?: string;
  title: string;
  summary?: string;
  why?: string;
  slug?: string;
  isCurrent?: boolean;
}

export const TOPICS: Topic[];

export function topicBySlug(slug: string): Topic | null;
export function articleMatchesTopic(article: unknown, topic: Topic | null): boolean;
export function topicForArticle(article: unknown): Topic | null;
export function articlesForTopic<T>(slug: string, articles: T[]): T[];
export function timelineFor(
  slug: string,
  articles: unknown[],
  currentSlug?: string | null,
): TimelineEntry[];
