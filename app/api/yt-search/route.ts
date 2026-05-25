import { NextRequest, NextResponse } from "next/server";

const NEWS_BLOCK = [
  'euronews','cnn','bbc','reuters','ap news','associated press',
  'sky news','al jazeera','fox news','msnbc','nbc news','abc news',
  'cbs news','france 24','dw news','dw ','bloomberg','channel 4',
  'itv news','rt ','rt.com','cgtn','trt world','wion','ndtv',
  'times now','nhk world','arirang','inside edition','vice news',
  'the guardian','independent','afp','politico','axios',
];

function isNewsChannel(name: string): boolean {
  const lower = name.toLowerCase();
  return NEWS_BLOCK.some(block => lower.includes(block));
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q) return NextResponse.json({ embedUrl: null });
  try {
    const r = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } }
    );
    const html = await r.text();

    // Walk videoRenderer occurrences — each is one search result.
    // Extract a 3000-char chunk per result to pull out videoId + ownerText without JSON parsing.
    const vrRe = /"videoRenderer":\{/g;
    let m: RegExpExecArray | null;
    let checked = 0;
    while ((m = vrRe.exec(html)) !== null && checked < 20) {
      checked++;
      const chunk = html.slice(m.index, m.index + 3000);
      const vidMatch = chunk.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
      const chanMatch = chunk.match(/"ownerText":\{"runs":\[\{"text":"([^"]+)"/);
      if (!vidMatch) continue;
      const videoId = vidMatch[1];
      const channel = chanMatch?.[1] ?? "";
      if (!isNewsChannel(channel)) {
        return NextResponse.json({ embedUrl: `https://www.youtube.com/embed/${videoId}` });
      }
    }

    // Fallback: first videoId in HTML (may be from a news channel)
    const fallback = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
    return NextResponse.json({ embedUrl: fallback ? `https://www.youtube.com/embed/${fallback[1]}` : null });
  } catch {
    return NextResponse.json({ embedUrl: null });
  }
}
