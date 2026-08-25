import { NextResponse, type NextRequest } from "next/server";
import { automationSecret, isAutomationAuthorized } from "@/lib/tregu-automation.mjs";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  renderCaption,
  replyMarkup,
  selectCandidates,
  MAX_AGE_HOURS,
} from "@/lib/telegram-dispatch.mjs";
import { remoteImageSrc } from "@/lib/remote-image.mjs";

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
 * `Authorization: Bearer $CRON_SECRET` or `?secret=`.
 */

type TelegramResponse = {
  ok: boolean;
  description?: string;
  error_code?: number;
  result?: { message_id?: number };
};

type Candidate = {
  slug: string;
  title: string;
  excerpt: string;
  imageUrl?: string | null;
  publishedAt: string;
  featured: boolean;
};

async function callTelegram(
  method: string,
  token: string,
  body: Record<string, unknown>
): Promise<TelegramResponse> {
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
}

function absoluteImage(url?: string | null): string | null {
  if (!url) return null;
  return /^https?:\/\//.test(url) ? url : null;
}

export async function GET(request: NextRequest) {
  const secret = automationSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET or TREGU_AUTOMATION_SECRET is required." },
      { status: 500 }
    );
  }
  if (!isAutomationAuthorized(request.headers.get("authorization") ?? "", secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channel = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !channel) {
    // Soft state: pings before the bot exists are expected, not errors.
    return NextResponse.json(
      { configured: false, posted: 0, note: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID not set." },
      { headers: { "Cache-Control": "no-store" } }
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
    .select("slug, title, excerpt, image_url, published_at, featured")
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

  const articles: Candidate[] = (rows ?? []).map((row) => ({
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    excerpt: String(row.excerpt ?? ""),
    imageUrl: row.image_url ? remoteImageSrc(String(row.image_url), 1200) : null,
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
    const image = absoluteImage(article.imageUrl);
    // Every send path carries the button, including the text fallback: a photo
    // that Telegram cannot fetch should not silently cost the post its CTA.
    const markup = replyMarkup(article);

    let response: TelegramResponse | null = null;
    if (image) {
      response = await callTelegram("sendPhoto", token, {
        chat_id: channel,
        photo: image,
        caption,
        parse_mode: "HTML",
        reply_markup: markup,
      });
      if (!response.ok) {
        // Remote hosts sometimes block Telegram's fetcher; the text message
        // with a large link preview carries the same story.
        response = await callTelegram("sendMessage", token, {
          chat_id: channel,
          text: caption,
          parse_mode: "HTML",
          link_preview_options: { prefer_large_media: true },
          reply_markup: markup,
        });
      }
    } else {
      response = await callTelegram("sendMessage", token, {
        chat_id: channel,
        text: caption,
        parse_mode: "HTML",
        link_preview_options: { prefer_large_media: true },
        reply_markup: markup,
      });
    }

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
    { headers: { "Cache-Control": "no-store" } }
  );
}
