import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** Public leagues, newest first, with their member counts. */
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { data, error } = await admin
    .from("tregu_leagues")
    .select("id, name, starts_at, ends_at, prizes, settled_at, tregu_league_members(count)")
    .eq("kind", "public")
    .order("ends_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const leagues = (data ?? []).map(({ tregu_league_members, ...league }) => ({
    ...league,
    members: (tregu_league_members as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
  return NextResponse.json({ leagues });
}

/**
 * POST { name, starts_at, ends_at, prizes: [first, second, third] }
 *
 * Creates a public league that 383 pays for. Its prizes go through the same
 * pending → Konfirmo email → approval path as the leaderboard when it ends.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    starts_at?: unknown;
    ends_at?: unknown;
    prizes?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const startsAt = new Date(String(body?.starts_at ?? ""));
  const endsAt = new Date(String(body?.ends_at ?? ""));
  const prizes = Array.isArray(body?.prizes) ? body.prizes.slice(0, 3).map((p) => Math.round(Number(p) || 0)) : [];

  if (name.length < 3 || name.length > 40) {
    return NextResponse.json({ error: "Emri duhet të ketë 3 deri në 40 shkronja." }, { status: 400 });
  }
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return NextResponse.json({ error: "Datat nuk vlejnë: mbarimi duhet të jetë pas fillimit." }, { status: 400 });
  }
  if (endsAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Liga duhet të mbarojë në të ardhmen." }, { status: 400 });
  }
  if (prizes.length !== 3 || prizes.some((p) => p < 0 || p > 100_000) || prizes[0] <= 0) {
    return NextResponse.json({ error: "Shpërblimet: tre numra, i pari më i madh se 0." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("tregu_leagues")
    .insert({
      name,
      kind: "public",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      prizes,
      max_members: 500,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data.id });
}
