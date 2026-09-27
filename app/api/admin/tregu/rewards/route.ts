import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** Leaderboard prizes, newest period first. Pending ones wait for the admin. */
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { data, error } = await admin
    .from("tregu_leaderboard_rewards")
    .select("*")
    .order("period_end", { ascending: false })
    .order("period_kind", { ascending: true })
    .order("place", { ascending: true })
    .limit(120);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rewards: data ?? [] });
}

/**
 * POST { ids: string[], status: "approved" | "rejected" }
 *
 * Approving does not move coins: it only makes the gift visible to the winner,
 * who collects it themselves (tregu_claim_leaderboard_reward). Only pending rows
 * change, so a double click or a stale tab cannot un-claim or re-open a prize.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const body = (await request.json().catch(() => null)) as { ids?: unknown; status?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [];
  const status = body?.status;
  if (!ids.length || (status !== "approved" && status !== "rejected")) {
    return NextResponse.json({ error: "Kërkesë e pavlefshme" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("tregu_leaderboard_rewards")
    .update({ status, approved_at: status === "approved" ? new Date().toISOString() : null })
    .in("id", ids)
    .eq("status", "pending")
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: data?.length ?? 0 });
}
