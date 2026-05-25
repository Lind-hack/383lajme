import { NextRequest, NextResponse } from "next/server";

const NEWS_BLOCK = [
  // International
  'euronews','cnn','bbc','reuters','ap news','associated press',
  'sky news','al jazeera','fox news','msnbc','nbc news','abc news',
  'cbs news','france 24','dw news','bloomberg','channel 4',
  'itv news','rt ','rt.com','cgtn','trt world','wion','ndtv',
  'times now','nhk world','arirang','inside edition','vice news',
  'the guardian','independent','afp','politico','axios',
  'wall street journal','washington post','new york times',
  // Albanian / Kosovo
  'euronews albania','klan','rtv klan','top channel','a2 cnn','ora news',
  'report tv','abc news albania','nsmtv','pamfleti','tvsh','rtk','bbc shqip',
  'zeri','koha','shekulli','news 24','tv 7','jeta ne kosove','express',
];

function isNewsChannel(name: string): boolean {
  const lower = name.toLowerCase();
  return NEWS_BLOCK.some(block => lower.includes(block));
}

function extractChannel(chunk: string): string {
  const patterns = [
    /"ownerText":\{"runs":\[\{"text":"([^"]+)"/,
    /"shortBylineText":\{"runs":\[\{"text":"([^"]+)"/,
    /"longBylineText":\{"runs":\[\{"text":"([^"]+)"/,
  ];
  for (const p of patterns) {
    const m = chunk.match(p);
    if (m) return m[1];
  }
  return "";
}

async function searchYouTube(query: string): Promise<string | null> {
  const r = await fetch(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } }
  );
  const html = await r.text();
  const vrRe = /"videoRenderer":\{/g;
  let m: RegExpExecArray | null;
  let checked = 0;
  while ((m = vrRe.exec(html)) !== null && checked < 20) {
    checked++;
    const chunk = html.slice(m.index, m.index + 8000);
    const vidMatch = chunk.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
    if (!vidMatch) continue;
    const channel = extractChannel(chunk);
    if (!isNewsChannel(channel)) return vidMatch[1];
  }
  return null;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q) return NextResponse.json({ embedUrl: null });
  try {
    // Primary search: full title
    let videoId = await searchYouTube(q);

    // Fallback: extract ASCII proper nouns (English names survive in Albanian titles)
    // e.g. "Gjyqi e hedh poshtë … Elon Muskit kundër OpenAI" → "Elon OpenAI Musk"
    if (!videoId) {
      const asciiTerms = q
        .split(/\s+/)
        .map(w => w.replace(/[^a-zA-Z0-9]/g, ""))
        .filter(w => w.length >= 3);
      if (asciiTerms.length > 0) {
        videoId = await searchYouTube(asciiTerms.join(" "));
      }
    }

    return NextResponse.json({ embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : null });
  } catch {
    return NextResponse.json({ embedUrl: null });
  }
}
