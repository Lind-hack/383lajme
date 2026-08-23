import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_PLATFORM_API_KEY;
  const name = request.nextUrl.searchParams.get("name") ?? "";
  if (!apiKey || !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(name)) {
    return NextResponse.json({ error: "Photo is unavailable." }, { status: 404 });
  }
  try {
    const params = new URLSearchParams({ key: apiKey, maxWidthPx: "900", maxHeightPx: "600", skipHttpRedirect: "true" });
    const response = await fetch(`https://places.googleapis.com/v1/${name}/media?${params}`, { cache: "no-store", signal: AbortSignal.timeout(6_000) });
    if (!response.ok) throw new Error(`Google Place Photos returned ${response.status}`);
    const payload = await response.json() as { photoUri?: string };
    if (!payload.photoUri?.startsWith("https://")) throw new Error("Photo URI missing");
    return NextResponse.redirect(payload.photoUri, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Photo is temporarily unavailable." }, { status: 502 });
  }
}
