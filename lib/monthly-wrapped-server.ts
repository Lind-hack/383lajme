// Loads one month of articles and builds "Tetori në 383" from them.
//
// Cached for a day and shared by the wrapped page and its six card images, so a
// month's articles leave the database once a day, not seven times. Only the
// eight columns the wrapped reads are selected: lib/db.ts explains how fat
// article reads used up the egress allowance before.

import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { buildMonthWrapped, monthRange, parseMonth } from "@/lib/monthly-wrapped.mjs";

const COLUMNS = "slug,title,excerpt,category,city,published_at,engagement_score,image_url";
/** PostgREST returns at most 1000 rows a request; a busy month is more. */
const PAGE = 1000;
const MAX_PAGES = 8;

type Row = {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  city: string | null;
  published_at: string;
  engagement_score: number | null;
  image_url: string | null;
};

async function monthArticles(month: string) {
  const range = monthRange(month);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!range || !url || !anonKey) return [];
  const supabase = createSupabaseClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const rows: Row[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from("news_articles")
      .select(COLUMNS)
      .gte("published_at", range.from)
      .lt("published_at", range.to)
      .order("published_at", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(`month articles: ${error.message}`);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }
  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt ?? "",
    category: r.category ?? "",
    city: r.city ?? undefined,
    publishedAt: r.published_at,
    engagementScore: r.engagement_score ?? undefined,
    imageUrl: r.image_url ?? undefined,
  }));
}

export type MonthWrapped = NonNullable<ReturnType<typeof buildMonthWrapped>>;

const cachedMonth = unstable_cache(
  async (month: string) => buildMonthWrapped(await monthArticles(month), month),
  ["monthly-wrapped-v1"],
  { revalidate: 86400, tags: ["monthly-wrapped"] }
);

/** The wrapped for `month` ("2026-10"), or null for a malformed month. */
export async function getMonthWrapped(month: string): Promise<MonthWrapped | null> {
  if (!parseMonth(month)) return null;
  return cachedMonth(month);
}
