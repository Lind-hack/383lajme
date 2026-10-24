import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getArticlesBefore } from "@/lib/db";
import { isRecentSend, kosovoNow, morningNote, validEndpoint } from "@/lib/perty-morning.mjs";
import { mustKnow } from "@/lib/per-ty-must-know.mjs";

export const dynamic = "force-dynamic";

/** Every subscribed device asks within the same minute: one lookup serves them all. */
const HEADLINE_MS = 10 * 60 * 1000;
let headlineCache: { at: number; headline: string | null } | null = null;

async function todaysHeadline(now = Date.now()) {
  if (headlineCache && now - headlineCache.at < HEADLINE_MS) return headlineCache.headline;
  let headline: string | null = null;
  try {
    headline = mustKnow(await getArticlesBefore({ limit: 80 }), { now })[0]?.title ?? null;
  } catch {
    // No headline is still a good morning.
  }
  headlineCache = { at: now, headline };
  return headline;
}

/**
 * Asked by the service worker (public/tregu-sw.js) when a push arrives:
 * "was this my morning edition?" Pushes arrive empty, and the same browser may
 * also get Tregu league alerts, so the worker sends its own push address and
 * this answers with the morning note if that address was just sent one.
 * Otherwise 204, and the worker shows the league alert as before.
 *
 * GET /api/per-ty/push/latest?endpoint=<push address>
 *
 * The note leads with the day's must-know headline, the same for everyone
 * (lib/per-ty-must-know), so it still says nothing about the reader.
 */
export async function GET(request: NextRequest) {
  const endpoint = validEndpoint(request.nextUrl.searchParams.get("endpoint"));
  const headers = { "Cache-Control": "no-store" };
  if (!endpoint) return new NextResponse(null, { status: 204, headers });
  const admin = createAdminClient();
  if (!admin) return new NextResponse(null, { status: 204, headers });
  const { data } = await admin
    .from("perty_push_subscriptions")
    .select("last_sent_at")
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (!isRecentSend(data?.last_sent_at ?? null)) return new NextResponse(null, { status: 204, headers });
  return NextResponse.json(morningNote({ headline: await todaysHeadline(), date: kosovoNow().date }), { headers });
}
