import { NextResponse, type NextRequest } from "next/server";
import { MEMBER_COLOURS, NAME_MAX, ROOM_NAME_MAX, cleanText, newRoomCode, normalizeProgress, score } from "@/lib/xhep/rooms.mjs";
import { NO_STORE, allow, hashToken, newToken, roomsDb } from "@/lib/xhep/rooms-server";

export const runtime = "nodejs";

/**
 * Create a trip room: { roomName, displayName, progress } in, the room code
 * and this device's member id and secret token out. The token is shown to
 * the device once; the database keeps only its hash.
 */
export async function POST(request: NextRequest) {
  const db = roomsDb();
  if (!db) return NextResponse.json({ ok: false, code: "unavailable" }, { status: 503, headers: NO_STORE });
  if (!allow(request, "room-create", 10)) return NextResponse.json({ ok: false, code: "rate_limited" }, { status: 429, headers: NO_STORE });
  let body: { roomName?: unknown; displayName?: unknown; progress?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400, headers: NO_STORE });
  }
  const displayName = cleanText(body.displayName, NAME_MAX);
  const roomName = cleanText(body.roomName, ROOM_NAME_MAX) || `${displayName}'s trip`;
  if (!displayName) return NextResponse.json({ ok: false, code: "name_required" }, { status: 422, headers: NO_STORE });

  // A fresh code; retry the rare collision.
  let code = "";
  for (let i = 0; i < 5 && !code; i++) {
    const candidate = newRoomCode();
    const { error } = await db.from("xhep_rooms").insert({ code: candidate, name: roomName.slice(0, ROOM_NAME_MAX) });
    if (!error) code = candidate;
    else if (error.code !== "23505") {
      console.log(`[xhep] room_create_failed ${error.code}`);
      return NextResponse.json({ ok: false, code: "failed" }, { status: 500, headers: NO_STORE });
    }
  }
  if (!code) return NextResponse.json({ ok: false, code: "failed" }, { status: 500, headers: NO_STORE });

  const token = newToken();
  const progress = normalizeProgress(body.progress);
  const { data: member, error } = await db
    .from("xhep_room_members")
    .insert({ room_code: code, token_hash: hashToken(token), display_name: displayName, colour: MEMBER_COLOURS[0], progress, score: score(progress) })
    .select("id")
    .single();
  if (error || !member) {
    console.log(`[xhep] room_member_failed ${error?.code}`);
    return NextResponse.json({ ok: false, code: "failed" }, { status: 500, headers: NO_STORE });
  }
  await db.from("xhep_room_moments").insert({ room_code: code, member_id: member.id, kind: "join" });
  return NextResponse.json({ ok: true, code, roomName, memberId: member.id, token }, { headers: NO_STORE });
}
