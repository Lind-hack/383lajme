import { NextResponse, type NextRequest } from "next/server";
import { PACK_CITIES } from "@/lib/xhep/packs.mjs";
import { getShowcase } from "@/lib/xhep/showcase";

export const runtime = "nodejs";

/** Approved trips for one city (the city's mural card), newest first. Public data only. */
export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city") ?? "";
  if (!PACK_CITIES.includes(city)) return NextResponse.json({ ok: false, trips: [] }, { status: 400 });
  const trips = await getShowcase({ cityId: city, limit: 12 });
  return NextResponse.json({ ok: true, trips }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
}
