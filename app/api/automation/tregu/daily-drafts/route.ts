import { NextResponse, type NextRequest } from "next/server";
import { automationDenied } from "@/lib/require-automation";
import { previewDailyDraftAutomation, runDailyDraftAutomation } from "@/lib/tregu-automation-server";
import { getLatestArticles } from "@/lib/db";
import { selectDailySourceArticles } from "@/lib/tregu-daily-market-quality.mjs";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Read-only context for the root/container Hermes Codex OAuth caller.
export async function GET(request: NextRequest) {
  const denied = automationDenied(request);
  if (denied) return denied;
  const sourceArticles = selectDailySourceArticles(await getLatestArticles(60), 24);
  const admin = createAdminClient();
  const { data: futureTemplates, error: futureError } = admin ? await admin.from("markets").select("id,slug,question,description,closes_at,live_event,sport_outcomes,status,market_classification,market_type").eq("status", "draft").in("market_classification", ["live_f1", "live_football"]).gt("closes_at", new Date().toISOString()) : { data: [], error: null };
  const { data: activeMarkets, error: activeError } = admin ? await admin
    .from("markets")
    .select("question,category,closes_at,source_article_slugs,pre_match_analysis,status,market_classification")
    .in("status", ["open", "draft", "stale"])
    .eq("market_classification", "general_news")
    .order("created_at", { ascending: false })
    .limit(80) : { data: [], error: null };
  if (futureError) return NextResponse.json({ error: `Could not load future sport templates: ${futureError.message}` }, { status: 500 });
  if (activeError) return NextResponse.json({ error: `Could not load active market topics: ${activeError.message}` }, { status: 500 });
  return NextResponse.json({
    articles: sourceArticles.map((article) => ({
      slug: article.slug,
      category: article.category,
      title: article.title,
      excerpt: article.excerpt,
      body: String(article.body ?? "").slice(0, 4500),
      source: article.source,
      url: article.url ?? null,
      publishedAt: article.publishedAt,
    })),
    activeMarkets: (activeMarkets ?? []).map((market) => {
      const analysis = market.pre_match_analysis && typeof market.pre_match_analysis === "object" ? market.pre_match_analysis as Record<string, unknown> : {};
      return {
        question: market.question,
        category: market.category,
        closes_at: market.closes_at,
        source_article_slugs: market.source_article_slugs ?? [],
        topic_key: typeof analysis.topic_key === "string" ? analysis.topic_key : null,
      };
    }),
    futureTemplates: (futureTemplates ?? []).filter((market) => !(market.live_event as Record<string, unknown> | null)?.review_email_sent_at),
  });
}

export async function POST(request: NextRequest) {
  const denied = automationDenied(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { candidates?: unknown; dryRun?: boolean; runKey?: unknown; markTemplateIds?: unknown } | null;
  if (body && Array.isArray(body.markTemplateIds)) {
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Supabase service-role configuration is required." }, { status: 500 });
    const ids = body.markTemplateIds.filter((id): id is string => typeof id === "string" && id.length > 10);
    const { data, error } = await admin.from("markets").select("id,live_event").in("id", ids).eq("status", "draft").in("market_classification", ["live_f1", "live_football"]);
    if (error) return NextResponse.json({ error: `Could not load future sport templates: ${error.message}` }, { status: 500 });
    for (const market of data ?? []) { const { error: updateError } = await admin.from("markets").update({ live_event: { ...(market.live_event ?? {}), review_email_sent_at: new Date().toISOString() } }).eq("id", market.id); if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 }); }
    return NextResponse.json({ ok: true, marked: (data ?? []).length });
  }
  if (!body || !Array.isArray(body.candidates)) {
    return NextResponse.json({ error: "A validated Codex candidates payload is required." }, { status: 400 });
  }
  try {
    if (body.dryRun) return NextResponse.json(await previewDailyDraftAutomation(body.candidates));
    return NextResponse.json(await runDailyDraftAutomation(body.candidates, new Date(), body.runKey));
  } catch (error) {
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error) }, { status: 500 });
  }
}
