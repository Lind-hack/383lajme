import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRecentSend, MORNING_NOTE, validEndpoint } from "@/lib/perty-morning.mjs";

export const dynamic = "force-dynamic";

/**
 * Asked by the service worker (public/tregu-sw.js) when a push arrives:
 * "was this my morning edition?" Pushes arrive empty, and the same browser may
 * also get Tregu league alerts, so the worker sends its own push address and
 * this answers with the morning note if that address was just sent one.
 * Otherwise 204, and the worker shows the league alert as before.
 *
 * GET /api/per-ty/push/latest?endpoint=<push address>
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
  return NextResponse.json(MORNING_NOTE, { headers });
}
