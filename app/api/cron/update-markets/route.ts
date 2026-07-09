import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lmsrPriceYes, scoreMarketWithAI, type Market } from "@/lib/tregu";
import { getArticleBySlug } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Vercel Cron -> this route -> Groq scores every open market against recent
// scraped articles and writes a market_snapshots row (AI line on the chart).
// Auth mirrors app/api/cron/dispatch-news: CRON_SECRET as Bearer header or ?secret=.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const authHeader = request.headers.get("authorization") ?? "";
  const querySecret = request.nextUrl.searchParams.get("secret") ?? "";

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is missing in Vercel production env." }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { data: markets, error } = await admin.from("markets").select("*").eq("status", "open");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { slug: string; ok: boolean; error?: string }[] = [];

  for (const market of (markets ?? []) as Market[]) {
    try {
      const score = await scoreMarketWithAI(market);
      const marketProb = lmsrPriceYes(market.q_yes, market.q_no, market.b);

      const { data: bets } = await admin
        .from("transactions")
        .select("amount")
        .eq("market_id", market.id)
        .eq("type", "bet");
      const volume = (bets ?? []).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

      const evidence = score.cited_slugs
        .map((slug) => {
          const article = getArticleBySlug(slug);
          return article ? { title: article.title, slug: article.slug, url: article.url } : null;
        })
        .filter((e): e is { title: string; slug: string; url: string | undefined } => e !== null);

      await admin.from("market_snapshots").insert({
        market_id: market.id,
        ai_prob: score.probability,
        market_prob: marketProb,
        volume,
        evidence,
      });

      results.push({ slug: market.slug, ok: true });
    } catch (err) {
      results.push({ slug: market.slug, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, scored: results.length, results });
}
