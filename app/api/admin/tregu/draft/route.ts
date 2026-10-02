import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getLatestArticles } from "@/lib/db";
import { buildDailyDraftPlan, dailyDraftPublicationReason, validateDailyDraftSubmission } from "@/lib/tregu-automation.mjs";
import { draftMarketsFromNews, slugifyQuestion } from "@/lib/tregu";

export const dynamic = "force-dynamic";

// Admin-triggered v2 draft generation. Rows stay review-only until approved.
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const now = new Date();
  try {
    const sourceArticles = await getLatestArticles(60);
    const drafted = await draftMarketsFromNews(5);
    const validated = validateDailyDraftSubmission(drafted, new Set(sourceArticles.map((article) => article.slug)), {
      minimum: 0,
      nonSportOnly: true,
      sourceArticles,
      now,
    });
    if (!validated.ok) return NextResponse.json({ error: validated.error, markets: [], rejected: [] }, { status: 422 });

    const { data: existingMarkets, error: existingError } = await admin
      .from("markets")
      .select("question,source_article_slugs,pre_match_analysis,status,market_classification")
      .in("status", ["open", "draft", "stale"])
      .eq("market_classification", "general_news");
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

    const plan = buildDailyDraftPlan({
      candidates: validated.candidates,
      existingMarkets: existingMarkets ?? [],
      now,
      audienceArticles: sourceArticles,
      requireMassAudience: true,
      nonSportOnly: true,
    });
    const noPublishReason = dailyDraftPublicationReason(plan);
    if (noPublishReason) return NextResponse.json({ markets: [], rejected: plan.rejected, no_publish_reason: noPublishReason });

    const rows = plan.rows.map((draft, index) => ({
      ...draft,
      status: "draft" as const,
      slug: `${slugifyQuestion(draft.question) || "treg"}-${Date.now().toString(36)}-${index + 1}`,
    }));
    const { data, error } = await admin.from("markets").insert(rows).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ markets: data ?? [], rejected: plan.rejected, no_publish_reason: null });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
