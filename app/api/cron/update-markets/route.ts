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

  const results: { slug: string; ok: boolean; nudged?: number; error?: string }[] = [];

  // News-driven odds refresh: when the AI's probability (scored against fresh
  // articles) diverges sharply from the LMSR price, the maker nudges the price
  // a capped step toward the AI estimate — so breaking news moves the odds
  // even before any human trades on it. AI_NUDGE_MAX_PP caps the move per run
  // (percentage points); set to 0 to disable and keep the AI line advisory-only.
  const nudgeCap = Number(process.env.AI_NUDGE_MAX_PP ?? "3") / 100;
  const NUDGE_TRIGGER = 0.08; // only react to real divergence, not noise

  for (const market of (markets ?? []) as Market[]) {
    try {
      const score = await scoreMarketWithAI(market);
      let marketProb = lmsrPriceYes(market.q_yes, market.q_no, market.b);
      let nudgedTo: number | null = null;

      const diff = score.probability - marketProb;
      if (nudgeCap > 0 && Math.abs(diff) >= NUDGE_TRIGGER) {
        const step = Math.sign(diff) * Math.min(Math.abs(diff) * 0.3, nudgeCap);
        const target = Math.min(0.97, Math.max(0.03, marketProb + step));
        // Keep q_yes fixed, solve q_no so lmsr_price_yes(q_yes, q_no, b) = target.
        const newQNo = market.q_yes - market.b * Math.log(target / (1 - target));
        const { error: nudgeErr } = await admin
          .from("markets")
          .update({ q_no: newQNo, updated_at: new Date().toISOString() })
          .eq("id", market.id)
          .eq("status", "open");
        if (!nudgeErr) {
          marketProb = target;
          nudgedTo = target;
        }
      }

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

      results.push({ slug: market.slug, ok: true, ...(nudgedTo !== null ? { nudged: Math.round(nudgedTo * 100) } : {}) });
    } catch (err) {
      results.push({ slug: market.slug, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, scored: results.length, results });
}
