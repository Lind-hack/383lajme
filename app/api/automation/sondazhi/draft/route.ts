import { NextResponse, type NextRequest } from "next/server";
import { automationDenied } from "@/lib/require-automation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getArticles } from "@/lib/db";
import { llmJSON } from "@/lib/llm";
import { dateKeyInKosovo } from "@/lib/reagimi-data";
import {
  DRAFT_SYSTEM_PROMPT,
  REPEAT_WINDOW,
  isLocalArticle,
  selectDraftArticles,
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
  const denied = automationDenied(request);
  if (denied) return denied;

  const todayKey = dateKeyInKosovo();
  // Wider than the 20 the prompt shows: the regional source runs a day or
  // two behind the wires, so a 30-article window can contain none of it.
  const articles = await getArticles(80);
  const supabase = createAdminClient();

  return NextResponse.json({
    todayKey,
    draftFor: draftDateKey(todayKey),
    articles: selectDraftArticles(articles, { limit: 20, localSlots: 12 }).map(
      ({ slug, category, title, publishedAt }) => ({
        slug,
        category,
        title,
        publishedAt,
        local: isLocalArticle({ slug, category, title }),
      })
    ),
    recentQuestions: supabase ? await recentQuestions(supabase, todayKey) : [],
    // Which provider variables the function can actually see. NAMES ONLY — no
    // value is ever returned. Vercel listed GOOGLE_AI_API_KEY as present for
    // Production while the runtime reported it unset, and a stray character in
    // a re-typed name looks identical in the dashboard. This is the only way to
    // tell those apart from outside, and it is behind the same secret gate.
    providerEnv: Object.keys(process.env)
      .filter((k) => /GOOGLE|GROQ|GEMINI/i.test(k))
      .map((k) => `${JSON.stringify(k)}: ${process.env[k] ? "set" : "empty"}`),
  });
}

export async function POST(request: NextRequest) {
  const denied = automationDenied(request);
  if (denied) return denied;

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

  const articles = await getArticles(80);
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
      // Gemini leads here. Groq has no usable model left on this account —
      // both llama builds 404 and gpt-oss-120b returns an empty content field —
      // while both Gemini keys are verified working. Groq still backs it up.
      prefer: "gemini",
      // Warmer than the 0.4 default: a poll question that reads like every
      // other poll question is the thing this feature exists to avoid.
      temperature: 0.85,
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
