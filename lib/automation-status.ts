export type AutomationJob = {
  id: string; name: string; schedule: string; enabled: boolean;
  status: "running" | "success" | "failed" | "idle";
  started_at: string | null; finished_at: string | null; next_run: string | null;
  stage: string; result: string; error: string | null;
};
export type AutomationSnapshot = {
  generated_at: string; jobs: AutomationJob[];
  news: {
    discovered_at: string | null; leads: number; categories: Record<string, number>;
    working_feeds: number; total_feeds: number;
    stories: { title: string; url: string; category: string; source: string }[];
    batches: { hour: string; count: number; published: boolean; articles: { title: string; slug: string; category: string }[] }[];
  };
  social: { checked_at: string | null; usable: number; watchlists: number; videos: { title: string; url: string; publisher: string; published: string }[] };
};
