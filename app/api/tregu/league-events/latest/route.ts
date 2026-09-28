import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { describeEvent } from "@/lib/tregu-rivalry-server";

export const dynamic = "force-dynamic";

/**
 * The newest unseen league event for the signed-in user, worded for a
 * notification. The service worker calls this when an (empty) push arrives,
 * with the user's cookies, so the push itself never carries anything.
 */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("tregu_my_league_events", { p_limit: 1 });
  const event = (data as { kind: string; actor: string | null; data: Record<string, unknown>; league_id: string | null; seen: boolean }[] | null)?.[0];
  const headers = { "Cache-Control": "private, no-store" };
  if (!event || event.seen) {
    return NextResponse.json({ title: "383 Ligat", body: "Diçka ndryshoi në ligat e tua.", url: "/tregu" }, { headers });
  }
  return NextResponse.json({ ...describeEvent(event), url: event.league_id ? `/tregu/ligat/${event.league_id}` : "/tregu" }, { headers });
}
