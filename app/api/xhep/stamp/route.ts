import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { checkStamp, signStamp } from "@/lib/xhep/stamps.mjs";

export const runtime = "nodejs";

// Without a configured secret, stamps are valid for this server process only.
const processSecret = randomBytes(32).toString("hex");
const secret = () => process.env.XHEP_STAMP_SECRET ?? process.env.CRON_SECRET ?? processSecret;

type Body = { placeId?: unknown; seed?: unknown; latitude?: unknown; longitude?: unknown; accuracy?: unknown };

/**
 * One fresh position in, one signed stamp out. Privacy contract: the
 * position and the request body are never stored or logged — failures log
 * a reason code only.
 */
export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  }
  const seed = typeof body.seed === "string" && /^[a-z0-9]{6,32}$/.test(body.seed) ? body.seed : null;
  if (!seed || typeof body.placeId !== "string") {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  }
  const result = checkStamp({
    placeId: body.placeId,
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
    accuracy: Number(body.accuracy),
  });
  if (!result.ok) {
    console.log(`[xhep] stamp_refused ${result.code}`);
    return NextResponse.json(result, { status: result.code === "unknown_place" ? 404 : 422, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    { ok: true, stamp: signStamp(secret(), result.placeId, seed) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
