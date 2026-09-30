import { NextResponse, type NextRequest } from "next/server";
import { automationDenied } from "@/lib/require-automation";
import { createAdminClient } from "@/lib/supabase/admin";
import { dateKeyInKosovo, shiftDateKey } from "@/lib/reagimi-data";
import { EDUCATIONAL_PUBLISHERS, EDUCATIONAL_ROLE, educationalVideoId, educationRow, validateEducationInput, verifyEducationalVideo } from "@/lib/reagimi-education.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = automationDenied(request);
  if (denied) return denied;
  const client = createAdminClient();
  if (!client) return NextResponse.json({ error: "Publishing database is unavailable." }, { status: 503 });
  const date = dateKeyInKosovo();
  const { data, error } = await client.from("reagimi_daily")
    .select("reagimi_date,quote,speaker_name,speaker_role,video_url")
    .gte("reagimi_date", shiftDateKey(date, -30)).lte("reagimi_date", date)
    .order("reagimi_date", { ascending: false });
  if (error) return NextResponse.json({ error: "Cannot read recent selections." }, { status: 503 });
  return NextResponse.json({ date, publishers: EDUCATIONAL_PUBLISHERS, recent: data ?? [] });
}

export async function POST(request: NextRequest) {
  const denied = automationDenied(request);
  if (denied) return denied;
  const client = createAdminClient();
  if (!client) return NextResponse.json({ error: "Publishing database is unavailable." }, { status: 503 });
  const date = dateKeyInKosovo();
  let selection;
  let verified;
  try {
    selection = validateEducationInput(await request.json(), date);
    verified = await verifyEducationalVideo(selection.videoUrl);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid video." }, { status: 422 });
  }
  const { data: recent, error: readError } = await client.from("reagimi_daily")
    .select("reagimi_date,speaker_role,video_url,updated_at")
    .gte("reagimi_date", shiftDateKey(date, -30)).lte("reagimi_date", date);
  if (readError) return NextResponse.json({ error: "Cannot verify selection history." }, { status: 503 });
  const today = recent?.find(row => row.reagimi_date === date);
  if (today?.speaker_role === EDUCATIONAL_ROLE) {
    try {
      await verifyEducationalVideo(today.video_url);
      return NextResponse.json({ date, alreadyPublished: true, videoUrl: today.video_url });
    } catch { /* Replace an unverified legacy/manual selection with this verified one. */ }
  }
  if (recent?.some(row => row.reagimi_date !== date && educationalVideoId(row.video_url) === verified.id)) {
    return NextResponse.json({ error: "Choose a different video: this one appeared in the last 30 days." }, { status: 409 });
  }
  const row = educationRow(selection, verified);
  // Compare-and-set when replacing a legacy row; first daily insert is unique.
  const result = today
    ? await client.from("reagimi_daily").update(row).eq("reagimi_date", date).eq("updated_at", today.updated_at).select("reagimi_date").maybeSingle()
    : await client.from("reagimi_daily").insert(row).select("reagimi_date").single();
  if (result.error?.code === "23505" || (!result.error && !result.data)) {
    return NextResponse.json({ error: "Another run published today. Read context again." }, { status: 409 });
  }
  if (result.error) return NextResponse.json({ error: "Failed to store today's video." }, { status: 503 });
  return NextResponse.json({ date, published: true, videoUrl: verified.embedUrl, publisher: verified.publisher });
}
