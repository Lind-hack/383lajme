import { NextResponse, type NextRequest } from "next/server";
import { automationSecret, isAutomationAuthorized } from "@/lib/tregu-automation.mjs";
import { previewDailyDraftAutomation, runDailyDraftAutomation } from "@/lib/tregu-automation-server";
import { getArticles } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = automationSecret();
  if (!secret) return { error: NextResponse.json({ error: "TREGU_AUTOMATION_SECRET (or CRON_SECRET) is required." }, { status: 500 }) };
  if (!isAutomationAuthorized(request.headers.get("authorization") ?? "", secret)) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return {};
}

// Read-only context for the root/container Hermes Codex OAuth caller.
export async function GET(request: NextRequest) {
  const auth = authorized(request);
  if (auth.error) return auth.error;
  const articles = await getArticles(30);
  const admin = createAdminClient();
  const { data: futureTemplates, error: futureError } = admin ? await admin.from("markets").select("id,slug,question,description,closes_at,live_event,sport_outcomes,status,market_classification,market_type").eq("status", "draft").in("market_classification", ["live_f1", "live_football"]).gt("closes_at", new Date().toISOString()) : { data: [], error: null };
  if (futureError) return NextResponse.json({ error: `Could not load future sport templates: ${futureError.message}` }, { status: 500 });
  return NextResponse.json({
    articles: articles.slice(0, 20).map(({ slug, category, title, excerpt, publishedAt }) => ({ slug, category, title, excerpt, publishedAt })),
    futureTemplates: (futureTemplates ?? []).filter((market) => !(market.live_event as Record<string, unknown> | null)?.review_email_sent_at),
  });
}

export async function POST(request: NextRequest) {
  const auth = authorized(request);
  if (auth.error) return auth.error;
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
