import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q) return NextResponse.json({ embedUrl: null });
  try {
    const r = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } }
    );
    const html = await r.text();
    const m = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
    return NextResponse.json({ embedUrl: m ? `https://www.youtube.com/embed/${m[1]}` : null });
  } catch {
    return NextResponse.json({ embedUrl: null });
  }
}
