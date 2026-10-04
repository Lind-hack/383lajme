import { NextResponse, type NextRequest } from "next/server";
import { PACK_CITIES } from "@/lib/xhep/packs.mjs";
import {
  MAX_MEMBERS,
  MEMBER_COLOURS,
  MOMENT_MAX,
  MOMENTS_PER_DAY,
  NAME_MAX,
  ROOM_CODE_RE,
  cleanText,
  normalizeProgress,
  progressEvents,
  score,
} from "@/lib/xhep/rooms.mjs";
import { NO_STORE, allow, hashToken, isToken, newToken, roomsDb } from "@/lib/xhep/rooms-server";

export const runtime = "nodejs";

type Params = { params: Promise<{ code: string }> };
const fail = (code: string, status: number) => NextResponse.json({ ok: false, code }, { status, headers: NO_STORE });

/** The room as everyone in it sees it: name, members ranked, the latest moments. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { code } = await params;
  if (!ROOM_CODE_RE.test(code)) return fail("not_found", 404);
  const db = roomsDb();
  if (!db) return fail("unavailable", 503);
  const { data: room } = await db.from("xhep_rooms").select("code, name, created_at").eq("code", code).maybeSingle();
  if (!room) return fail("not_found", 404);
  const [{ data: members }, { data: moments }] = await Promise.all([
    db.from("xhep_room_members").select("id, display_name, colour, progress, score, updated_at").eq("room_code", code).order("score", { ascending: false }).order("joined_at"),
    db.from("xhep_room_moments").select("id, member_id, kind, city_id, body, created_at").eq("room_code", code).order("created_at", { ascending: false }).limit(40),
  ]);
  return NextResponse.json(
    {
      ok: true,
      room: { code: room.code, name: room.name, createdAt: room.created_at },
      members: (members ?? []).map((m) => ({ id: m.id, name: m.display_name, colour: m.colour, progress: normalizeProgress(m.progress), score: m.score, updatedAt: m.updated_at })),
      moments: (moments ?? []).map((m) => ({ id: m.id, memberId: m.member_id, kind: m.kind, cityId: m.city_id, body: m.body, createdAt: m.created_at })),
    },
    { headers: NO_STORE },
  );
}

/**
 * Everything a member does, by `action`:
 *   join     { displayName, progress }      → { memberId, token }
 *   progress { token, progress }            → posts pack/complete moments for what is new
 *   moment   { token, body, cityId? }       → a short line in the feed
 *   leave    { token }                      → removes the member and their moments
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { code } = await params;
  if (!ROOM_CODE_RE.test(code)) return fail("not_found", 404);
  const db = roomsDb();
  if (!db) return fail("unavailable", 503);
  let body: { action?: unknown; token?: unknown; displayName?: unknown; progress?: unknown; body?: unknown; cityId?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("invalid", 400);
  }
  const { data: room } = await db.from("xhep_rooms").select("code").eq("code", code).maybeSingle();
  if (!room) return fail("not_found", 404);
  const touch = () => db.from("xhep_rooms").update({ last_active_at: new Date().toISOString() }).eq("code", code);

  if (body.action === "join") {
    if (!allow(request, "room-join", 30)) return fail("rate_limited", 429);
    const displayName = cleanText(body.displayName, NAME_MAX);
    if (!displayName) return fail("name_required", 422);
    const { count } = await db.from("xhep_room_members").select("id", { count: "exact", head: true }).eq("room_code", code);
    if ((count ?? 0) >= MAX_MEMBERS) return fail("room_full", 409);
    const token = newToken();
    const progress = normalizeProgress(body.progress);
    const { data: member, error } = await db
      .from("xhep_room_members")
      .insert({ room_code: code, token_hash: hashToken(token), display_name: displayName, colour: MEMBER_COLOURS[(count ?? 0) % MEMBER_COLOURS.length], progress, score: score(progress) })
      .select("id")
      .single();
    if (error || !member) return fail("failed", 500);
    await db.from("xhep_room_moments").insert({ room_code: code, member_id: member.id, kind: "join" });
    await touch();
    return NextResponse.json({ ok: true, memberId: member.id, token }, { headers: NO_STORE });
  }

  // Every other action is by a member: find them by their token.
  if (!isToken(body.token)) return fail("not_member", 403);
  const { data: member } = await db.from("xhep_room_members").select("id, progress").eq("room_code", code).eq("token_hash", hashToken(body.token)).maybeSingle();
  if (!member) return fail("not_member", 403);

  if (body.action === "progress") {
    const before = normalizeProgress(member.progress);
    const after = normalizeProgress(body.progress);
    const events = progressEvents(before, after);
    await db.from("xhep_room_members").update({ progress: after, score: score(after), updated_at: new Date().toISOString() }).eq("id", member.id);
    if (events.length) await db.from("xhep_room_moments").insert(events.map((e) => ({ room_code: code, member_id: member.id, kind: e.kind, city_id: e.cityId })));
    await touch();
    return NextResponse.json({ ok: true, events: events.length }, { headers: NO_STORE });
  }

  if (body.action === "moment") {
    const text = cleanText(body.body, MOMENT_MAX);
    if (!text) return fail("empty", 422);
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await db.from("xhep_room_moments").select("id", { count: "exact", head: true }).eq("member_id", member.id).eq("kind", "moment").gte("created_at", since);
    if ((count ?? 0) >= MOMENTS_PER_DAY) return fail("rate_limited", 429);
    const cityId = typeof body.cityId === "string" && PACK_CITIES.includes(body.cityId) ? body.cityId : null;
    const { error } = await db.from("xhep_room_moments").insert({ room_code: code, member_id: member.id, kind: "moment", city_id: cityId, body: text });
    if (error) return fail("failed", 500);
    await touch();
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  if (body.action === "leave") {
    await db.from("xhep_room_members").delete().eq("id", member.id);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  return fail("invalid", 400);
}
