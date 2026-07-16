import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { automationSecret, isAutomationAuthorized } from "@/lib/tregu-automation.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isIsoTimestamp(value: unknown) {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function validateOpenMarket(draft: Record<string, unknown>) {
  if (draft.status !== "open" || draft.market_type !== "three_outcome" || draft.slug !== "england-argentina-full-time-result-20260715") {
    return "Only the fixed open Argentina–England three-outcome market is accepted.";
  }
  const claims = (draft.analysis as { claims?: unknown } | undefined)?.claims;
  if (!Array.isArray(claims) || claims.length !== 0) return "Opening analysis claims are not accepted without separately cited sources.";
  const analysis = draft.pre_match_analysis as { opening_probabilities?: Record<string, unknown>; sources?: Array<Record<string, unknown>> } | undefined;
  const probabilities = analysis?.opening_probabilities;
  const values = [probabilities?.england, probabilities?.draw, probabilities?.argentina].map(Number);
  if (values.some((value) => !Number.isFinite(value) || value <= 0) || Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 1e-9) {
    return "A verified normalized England/Draw/Argentina opening probability is required.";
  }
  const sources = analysis?.sources;
  const espn = sources?.find((source) => source.kind === "espn_schedule_score");
  const draftKings = sources?.find((source) => source.kind === "draftkings_full_time_1x2");
  const model = sources?.find((source) => source.kind === "groq_pre_match_reference_model");
  const validBookmaker = draftKings && isIsoTimestamp(draftKings.fetched_at) && typeof draftKings.url === "string" && draftKings.url.startsWith("https://sportsbook.draftkings.com/");
  const validModel = model && model.source === "Groq" && Array.isArray(model.cited_sources) && model.cited_sources.length > 0;
  if (!espn || !isIsoTimestamp(espn.fetched_at) || typeof espn.url !== "string" || !espn.url.startsWith("https://site.api.espn.com/") || (!validBookmaker && !validModel)) {
    return "Timestamped official ESPN source plus verified full-time 1X2 or labeled cited Groq model reference is required.";
  }
  return null;
}

export async function POST(request: NextRequest) {
  const secret = automationSecret();
  if (!secret) return NextResponse.json({ error: "TREGU_AUTOMATION_SECRET (or CRON_SECRET) is required." }, { status: 500 });
  if (!isAutomationAuthorized(request.headers.get("authorization") ?? "", secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { draft?: Record<string, unknown>; dryRun?: boolean; open?: boolean } | null;
  if (!body?.draft) return NextResponse.json({ error: "Argentina–England draft payload is required." }, { status: 400 });
  const violation = validateOpenMarket(body.draft);
  if (violation) return NextResponse.json({ error: violation }, { status: 400 });
  if (body.dryRun || body.open !== true) return NextResponse.json({ ok: true, preview: true, created: 0, draft: body.draft });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service-role configuration is required." }, { status: 500 });
  const { data: existing, error: existingError } = await admin.from("markets").select("*").eq("slug", body.draft.slug).maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existing) return NextResponse.json({ ok: true, skipped: true, created: 0, market: existing });

  const row = {
    slug: body.draft.slug,
    question: body.draft.question,
    description: body.draft.description,
    resolution_criteria: body.draft.resolution_criteria,
    category: body.draft.category,
    status: "open",
    market_type: "three_outcome",
    outcomes: body.draft.outcomes,
    q_england: body.draft.q_england,
    q_draw: body.draft.q_draw,
    q_argentina: body.draft.q_argentina,
    sport_outcomes: body.draft.sport_outcomes,
    outcome_quantities: body.draft.outcome_quantities,
    reference_probabilities: body.draft.reference_probabilities,
    closes_at: body.draft.closes_at,
    source_article_slugs: [],
    ai_generated: false,
    live_event: body.draft.live_event,
    pre_match_analysis: body.draft.pre_match_analysis,
  };
  const { data, error } = await admin.from("markets").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, skipped: false, created: 1, market: data });
}
