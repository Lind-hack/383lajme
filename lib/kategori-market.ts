import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { matchesNewsFilter } from "./tregu-news-taxonomy.mjs";
import { lmsrPriceYes } from "./tregu-client";

/** What the category page's Tregu card shows. */
export type SectionMarket = {
  slug: string;
  question: string;
  /** Probability of PO, 0–1; null for markets with more than two outcomes. */
  prob: number | null;
  closesAt: string;
};

/** Category slugs that Tregu files markets under; the rest have none. */
const TREGU_FILTER: Record<string, string> = {
  kosove: "kosove",
  shqiperi: "shqiperi",
  sport: "sport",
  ekonomi: "ekonomi",
  bote: "bote",
};

/**
 * One open market for a section, or null.
 *
 * Only the two taxonomy fields of `pre_match_analysis` are read, as aliases:
 * the column also carries the whole pre-match write-up for sport books, and
 * pulling it for every open market on every category view is exactly the
 * egress db.ts's column list exists to avoid. A binary market is preferred —
 * its PO/JO split reads at a glance — and among those the one closing soonest.
 */
export async function getSectionMarket(categorySlug: string, now = Date.now()): Promise<SectionMarket | null> {
  const filter = TREGU_FILTER[categorySlug];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!filter || !url || !anonKey) return null;
  try {
    const supabase = createSupabaseClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await supabase
      .from("markets")
      .select(
        "slug,question,category,status,q_yes,q_no,b,market_type,closes_at," +
          "news_geography:pre_match_analysis->>news_geography," +
          "proposition_geography:pre_match_analysis->proposition->>geography," +
          "news_topic:pre_match_analysis->>news_topic"
      )
      .eq("status", "open")
      .order("closes_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as unknown as Array<Record<string, unknown>>)
      .map((row): Record<string, unknown> => ({
        ...row,
        // The shape marketNewsTaxonomy() reads.
        pre_match_analysis: {
          news_geography: row?.news_geography ?? undefined,
          news_topic: row?.news_topic ?? undefined,
          proposition: { geography: row?.proposition_geography ?? undefined },
        },
      }))
      .filter((row) => matchesNewsFilter(row, filter))
      .filter((row) => typeof row?.slug === "string" && typeof row?.question === "string")
      .filter((row) => Date.parse(String(row?.closes_at ?? "")) > now);
    const pick = rows.find((row) => (row?.market_type ?? "binary") === "binary") ?? rows[0];
    if (!pick) return null;
    const binary = (pick?.market_type ?? "binary") === "binary";
    // The book price, exactly as /api/tregu/markets computes it.
    const prob = lmsrPriceYes(Number(pick?.q_yes), Number(pick?.q_no), Number(pick?.b));
    return {
      slug: String(pick.slug),
      question: String(pick.question),
      prob: binary && Number.isFinite(prob) ? Math.max(0, Math.min(1, prob)) : null,
      closesAt: String(pick.closes_at),
    };
  } catch (error) {
    // The card falls back to Pyet Dardanin; the page never fails on Tregu.
    console.error("[kategori] Tregu market unavailable", error);
    return null;
  }
}
