import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dateKeyInKosovo, viewFromRecord } from "@/lib/reagimi-data";
import { EDUCATIONAL_ROLE, verifyEducationalVideo } from "@/lib/reagimi-education.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A safe read path also excludes legacy editor rows and rival-news videos.
export async function GET() {
  const date = dateKeyInKosovo();
  const headers = { "Cache-Control": "no-store" };
  const client = createAdminClient();
  if (!client) return NextResponse.json({ date, view: null }, { status: 503, headers });
  const { data: row, error } = await client.from("reagimi_daily")
    .select("reagimi_date,quote,speaker_name,speaker_role,context_line,article_slug,video_url")
    .eq("reagimi_date", date).eq("speaker_role", EDUCATIONAL_ROLE).maybeSingle();
  if (error) return NextResponse.json({ date, view: null }, { status: 503, headers });
  if (!row) return NextResponse.json({ date, view: null }, { headers });
  try {
    const verified = await verifyEducationalVideo(row.video_url);
    const view = viewFromRecord({
      reagimiDate: row.reagimi_date, quote: row.quote, speakerName: verified.publisher,
      speakerRole: EDUCATIONAL_ROLE, contextLine: row.context_line,
      articleSlug: null, videoUrl: verified.embedUrl,
    });
    return NextResponse.json({ date, view }, { headers });
  } catch { return NextResponse.json({ date, view: null }, { headers }); }
}
