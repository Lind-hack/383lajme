import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOfficialBorderWaits } from "@/lib/visit-border-server";
import { getAcceptedMemoryReports } from "@/lib/visit-community-store";
import { reporterModeFromHash } from "@/lib/visit-reporting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CommunityRow = { crossing_id: string; direction: string; wait_minutes: number; created_at: string; confidence?: string; device_hash?: string };

function communitySummary(rows: CommunityRow[]) {
  const grouped = new Map<string, CommunityRow[]>();
  for (const row of rows) {
    const key = `${row.crossing_id}:${row.direction}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return Object.fromEntries([...grouped].map(([key, values]) => {
    const sorted = values.map((value) => value.wait_minutes).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return [key, { median, sampleSize: sorted.length, confidence: sorted.length >= 5 ? "high" : sorted.length >= 2 ? "medium" : "low" }];
  }));
}

export async function GET() {
  try {
    const official = await fetchOfficialBorderWaits();
    const admin = createAdminClient();
    let rows: CommunityRow[] = getAcceptedMemoryReports();
    if (admin) {
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data } = await admin
        .from("visit_border_reports")
        .select("crossing_id,direction,wait_minutes,created_at,confidence,device_hash")
        .eq("status", "accepted")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(24);
      rows = [...rows, ...((data ?? []) as CommunityRow[])];
    }
    const community = communitySummary(rows);
    const recentReports = rows
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 12)
      .map((row) => ({
        crossingId: row.crossing_id,
        direction: row.direction,
        waitMinutes: row.wait_minutes,
        createdAt: row.created_at,
        confidence: row.confidence ?? "low",
        reporterMode: reporterModeFromHash(row.device_hash),
      }));
    return NextResponse.json(
      { official, community, recentReports, refreshSeconds: 600, generatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { official: [], community: {}, recentReports: [], refreshSeconds: 600, generatedAt: new Date().toISOString(), error: "Official border data is temporarily unavailable.", detail: String(error instanceof Error ? error.message : error) },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
