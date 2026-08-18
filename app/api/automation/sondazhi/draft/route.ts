import { NextResponse, type NextRequest } from "next/server";
import { automationSecret, isAutomationAuthorized } from "@/lib/tregu-automation.mjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { getArticles } from "@/lib/db";
import { llmJSON } from "@/lib/llm";
import { dateKeyInKosovo } from "@/lib/reagimi-data";
import {
  DRAFT_SYSTEM_PROMPT,
  REPEAT_WINDOW,
  buildDraftPrompt,
  draftDateKey,
  groundSlug,
  validateDraft,
} from "@/lib/sondazhi-draft.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Drafts tomorrow's Sondazhi i Ditës from today's articles.
 *
 * Writes with status 'draft' — nothing generated here reaches a reader until it
 * is approved in /admin/poll. If this never runs, the static bank in
 * lib/polls-data.ts still carries the day, so the homepage has no dependency on
 * the job firing.
 */

function authorized(request: NextRequest) {
  const secret = automationSecret();
  if (!secret) {
    return {
      error: NextResponse.json(
        { error: "TREGU_AUTOMATION_SECRET (or CRON_SECRET) is required." },
        { status: 500 }
      ),
    };
  }
  if (!isAutomationAuthorized(request.headers.get("authorization") ?? "", secret)) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return {};
}

async function recentQuestions(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  beforeKey: string
): Promise<string[]> {
  const { data } = await supabase
    .from("daily_polls")
    .select("question")
    .lte("poll_date", beforeKey)
    .order("poll_date", { ascending: false })
    .limit(REPEAT_WINDOW);
  return (data ?? [])
    .map((r) => (typeof r.question === "string" ? r.question : ""))
    .filter(Boolean);
}

/** Read-only context, so a caller can see what a draft would be built from. */
export async function GET(request: NextRequest) {
  const auth = authorized(request);
  if (auth.error) return auth.error;

  const todayKey = dateKeyInKosovo();
  const articles = await getArticles(30);
  const supabase = createAdminClient();

  return NextResponse.json({
    todayKey,
    draftFor: draftDateKey(todayKey),
    articles: articles.slice(0, 20).map(({ slug, category, title, publishedAt }) => ({
      slug,
      category,
      title,
      publishedAt,
    })),
    recentQuestions: supabase ? await recentQuestions(supabase, todayKey) : [],
  });
}

export async function POST(request: NextRequest) {
  const auth = authorized(request);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is required to write a draft." },
      { status: 500 }
    );
  }

  const todayKey = dateKeyInKosovo();
  const pollDate = draftDateKey(todayKey);

  // Never overwrite a question that has already been reviewed and approved.
  const { data: existing } = await supabase
    .from("daily_polls")
    .select("poll_date, status")
    .eq("poll_date", pollDate)
    .maybeSingle();

  if (existing?.status === "approved") {
    return NextResponse.json(
      { ok: false, skipped: "approved", pollDate },
      { status: 200 }
    );
  }

  const articles = await getArticles(30);
  if (articles.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Asnjë artikull për të ndërtuar pyetjen." },
      { status: 422 }
    );
  }

  const recent = await recentQuestions(supabase, todayKey);

  let raw: unknown;
  try {
    raw = await llmJSON(DRAFT_SYSTEM_PROMPT, buildDraftPrompt(articles, recent), {
      maxTokens: 600,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }

  const validated = validateDraft(raw, { recentQuestions: recent });
  if (!validated.ok) {
    // Refused rather than repaired: a bad draft is cheap to regenerate and
    // expensive to publish.
    return NextResponse.json({ ok: false, error: validated.reason, raw }, { status: 422 });
  }

  const draft = groundSlug(validated.draft, articles);

  const { error } = await supabase.from("daily_polls").upsert(
    {
      poll_date: pollDate,
      question: draft.question,
      options: draft.options,
      context_line: draft.contextLine,
      source_article_slug: draft.sourceArticleSlug,
      status: "draft",
    },
    { onConflict: "poll_date" }
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pollDate, draft });
}
