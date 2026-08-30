export interface DosjeCoverageArticle {
  slug: string;
  title: string;
  source: string | null;
  publishedAt: string | null;
  score: number;
  method: string | null;
  missing: boolean;
}

export interface DosjeCoverageMoment {
  id: string;
  title: string;
  status: string;
  eventDate: string | null;
  displayDate: string | null;
}

export interface DosjeCoverageMediaItem {
  id: string;
  kind: string;
  url: string | null;
  credit: string | null;
  sourceUrl: string | null;
  milestoneId: string | null;
  approved: boolean;
  approvedBy: string | null;
  checkStatus: number | null;
}

export interface DosjeCoverage {
  slug: string;
  title: string;
  status: string;
  articles: DosjeCoverageArticle[];
  moments: {
    total: number;
    approved: number;
    draft: number;
    needsSource: number;
    rejected: number;
    items: DosjeCoverageMoment[];
  };
  media: {
    total: number;
    image: { total: number; approved: number; review: number; rejected: number };
    video: { total: number; approved: number; review: number; rejected: number };
    items: DosjeCoverageMediaItem[];
  };
}

export interface DosjeCoverageInput {
  topics?: Array<Record<string, unknown>>;
  articleTopics?: Array<Record<string, unknown>>;
  articles?: Array<Record<string, unknown>>;
  milestones?: Array<Record<string, unknown>>;
  media?: Array<Record<string, unknown>>;
}

export function buildDosjeCoverage(input?: DosjeCoverageInput): DosjeCoverage[];
