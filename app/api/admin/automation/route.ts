import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const client = createAdminClient();
  if (!client) return NextResponse.json({ error: "Statusi nuk është i disponueshëm." }, { status: 503, headers });
  const { data, error } = await client.storage.from("automation-status").download("latest.json");
  if (error || !data) return NextResponse.json({ error: "Në pritje të raportit nga serveri." }, { status: 503, headers });
  try {
    const snapshot = JSON.parse(await data.text());
    if (!snapshot.generated_at || !Array.isArray(snapshot.jobs)) throw new Error("Invalid snapshot");
    return NextResponse.json(snapshot, { headers });
  } catch {
    return NextResponse.json({ error: "Raporti i serverit nuk mund të lexohet." }, { status: 503, headers });
  }
}
