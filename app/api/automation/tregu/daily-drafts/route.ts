import { NextResponse, type NextRequest } from "next/server";
import { automationSecret, isAutomationAuthorized } from "@/lib/tregu-automation.mjs";
import { previewDailyDraftAutomation, runDailyDraftAutomation } from "@/lib/tregu-automation-server";
import { getArticles } from "@/lib/db";

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
  return NextResponse.json({
    articles: articles.slice(0, 20).map(({ slug, category, title, excerpt, publishedAt }) => ({ slug, category, title, excerpt, publishedAt })),
  });
}

export async function POST(request: NextRequest) {
  const auth = authorized(request);
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => null)) as { candidates?: unknown; dryRun?: boolean; runKey?: unknown } | null;
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
