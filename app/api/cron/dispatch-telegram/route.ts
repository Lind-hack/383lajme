import { NextResponse, type NextRequest } from "next/server";
import { automationDenied } from "@/lib/require-automation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  renderCaption,
  replyMarkup,
  selectCandidates,
  MAX_AGE_HOURS,
} from "@/lib/telegram-dispatch.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Telegram channel dispatcher — the messaging counterpart of the news
 * pipeline. Deliberately decoupled from codex-cloud-news: a messaging outage
 * must never block publishing, and a publishing outage must never resend old
 * messages. Idempotency lives in the telegram_posts ledger; the service-role
 * key is required because the ledger is invisible to every other role.
 *
 * Schedule: any 15–30 min ping (cron-job.org or GitHub Actions backup) with
 * `Authorization: Bearer $CRON_SECRET`.
 */

type TelegramResponse = {
  ok: boolean;
  description?: string;
  error_code?: number;
  transportFailed?: boolean;
  result?: { message_id?: number };
};

type Candidate = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  featured: boolean;
};

async function callTelegram(
  method: string,
  token: string,
  body: Record<string, unknown>
): Promise<TelegramResponse> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    try {
      return (await res.json()) as TelegramResponse;
    } catch {
      return { ok: false, description: `non-JSON response (${res.status})` };
    }
  } catch {
    return { ok: false, transportFailed: true, description: "Telegram request failed or timed out" };
  }
}

export async function GET(request: NextRequest) {
  const denied = automationDenied(request);
  if (denied) return denied;

  const token = process.env.TELEGRAM_NEWS_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const channel = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !channel) {
    return NextResponse.json(
      { configured: false, posted: 0, note: "Telegram news token / TELEGRAM_CHANNEL_ID not set." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is required for the telegram_posts ledger." },
      { status: 503 }
    );
  }

  const nowMs = Date.now();
  const freshSince = new Date(nowMs - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();
  const ledgerSince = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error: readError } = await supabase
    .from("news_articles")
    .select("slug, title, excerpt, published_at, featured,raw_article->originality_review")
    .eq("featured", true)
    .gte("published_at", freshSince)
    .order("published_at", { ascending: false })
    .limit(30);

  if (readError) {
    return NextResponse.json({ error: "article read failed", message: readError.message }, { status: 500 });
  }

  const { data: ledger, error: ledgerError } = await supabase
    .from("telegram_posts")
    .select("article_slug")
    .eq("channel", channel)
    .gte("posted_at", ledgerSince);

  if (ledgerError) {
    return NextResponse.json({ error: "ledger read failed", message: ledgerError.message }, { status: 500 });
  }

  const articles: Candidate[] = (rows ?? []).filter((row) => {
    const proof = row.originality_review as { policy?: string } | null;
    return proof?.policy === "383-original-composition-v1";
  }).map((row) => ({
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    excerpt: String(row.excerpt ?? ""),
    publishedAt: String(row.published_at ?? ""),
    featured: row.featured === true,
  }));

  const candidates = selectCandidates({
    articles,
    postedSlugs: (ledger ?? []).map((row) => String(row.article_slug)),
    nowMs,
  });

  let posted = 0;
  const failed: { slug: string; error: string }[] = [];

  for (const article of candidates) {
    if (posted >= 3) break;

    const caption = renderCaption(article);
    // Do not redistribute archive photos without their rights/context, or
    // let cached platform previews revive old publisher photographs.
    const response = await callTelegram("sendMessage", token, {
      chat_id: channel,
      text: caption,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: replyMarkup(article),
    });

    if (response.ok) {
      posted += 1;
      const { error: insertError } = await supabase.from("telegram_posts").insert({
        article_slug: article.slug,
        channel,
        message_id: response.result?.message_id ?? null,
      });
      if (insertError) {
        // The message is out; a ledger gap only risks a resend on the next
        // run, which the unique constraint then blocks. Surface it, don't stop.
        failed.push({ slug: article.slug, error: `ledger: ${insertError.message}` });
      }
    } else {
      failed.push({ slug: article.slug, error: response.description ?? "unknown Telegram error" });
      // Flood control: back off for the rest of the run instead of hammering.
      if (response.error_code === 429) break;
    }
  }

  return NextResponse.json(
    {
      configured: true,
      checked: candidates.length,
      posted,
      failed,
    },
    { status: failed.length ? 502 : 200, headers: { "Cache-Control": "no-store" } }
  );
}
