import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fetchOfficialBorderWaits, haversineKm } from "@/lib/visit-border-server";
import { BORDER_CROSSINGS, type BorderCrossingId, type BorderDirection } from "@/lib/visit-v2-data";
import { addMemoryReport, hasRecentMemoryReport } from "@/lib/visit-community-store";
import { classifyCommunityReport, hashReportIdentity, resolveReporterMode } from "@/lib/visit-reporting";

export const runtime = "nodejs";

type ReportBody = {
  crossingId?: BorderCrossingId;
  direction?: BorderDirection;
  waitMinutes?: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  deviceId?: string;
  anonymous?: boolean;
};

export async function POST(request: NextRequest) {
  const admin = createAdminClient();

  let body: ReportBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  }

  const crossing = BORDER_CROSSINGS.find((item) => item.id === body.crossingId);
  const waitMinutes = Number(body.waitMinutes);
  const accuracy = Number(body.accuracy);
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!crossing || !["entry", "exit"].includes(body.direction ?? "") || !Number.isInteger(waitMinutes) || waitMinutes < 0 || waitMinutes > 240) {
    return NextResponse.json({ error: "Choose a crossing, direction and a wait between 0 and 240 minutes." }, { status: 400 });
  }
  if (![latitude, longitude, accuracy].every(Number.isFinite) || accuracy <= 0 || accuracy > 1000) {
    return NextResponse.json({ error: "Vendndodhja duhet të jetë e freskët dhe me saktësi brenda 1 km." }, { status: 400 });
  }

  const distanceKm = haversineKm({ latitude, longitude }, crossing);
  if (distanceKm > 1) {
    return NextResponse.json({ error: `Duhet të jesh brenda 1 km nga ${crossing.name} për të raportuar.`, distanceKm: Math.round(distanceKm * 10) / 10 }, { status: 422 });
  }

  let userId: string | undefined;
  if (body.anonymous === false && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id;
  }
  const reporterMode = resolveReporterMode(body.anonymous, userId);
  if (!reporterMode) {
    return NextResponse.json({ error: "Hyr në llogari ose zgjidh raportimin anonim." }, { status: 401 });
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const deviceHash = hashReportIdentity({ mode: reporterMode, userId, deviceId: body.deviceId, forwarded });

  const recentSince = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  let count = 0;
  if (admin) {
    const response = await admin
      .from("visit_border_reports")
      .select("id", { count: "exact", head: true })
      .eq("device_hash", deviceHash)
      .gte("created_at", recentSince);
    count = response.count ?? 0;
  }
  if (count > 0 || hasRecentMemoryReport(deviceHash)) {
    return NextResponse.json({ error: "Prit 10 minuta para se të dërgosh një raport tjetër." }, { status: 429 });
  }

  let officialMinutes: number | null = null;
  try {
    const official = (await fetchOfficialBorderWaits()).find((item) => item.crossingId === crossing.id);
    const range = body.direction === "entry" ? official?.entry : official?.exit;
    officialMinutes = range ? Math.round((range.min + range.max) / 2) : null;
  } catch {
    // A geofenced report can still be retained at low confidence when the official source is down.
  }

  const { status, confidence } = classifyCommunityReport(waitMinutes, officialMinutes);

  const report = {
    crossing_id: crossing.id,
    direction: body.direction,
    wait_minutes: waitMinutes,
    status,
    confidence,
    geofence_verified: true,
    distance_bucket_m: Math.ceil((distanceKm * 1000) / 100) * 100,
    accuracy_bucket_m: Math.ceil(accuracy / 100) * 100,
    official_minutes: officialMinutes,
    device_hash: deviceHash,
  };

  if (admin) {
    const { error } = await admin.from("visit_border_reports").insert(report);
    if (error) return NextResponse.json({ error: "Raporti nuk mund të ruhej. Provo sërish." }, { status: 500 });
  } else {
    addMemoryReport({
      crossing_id: report.crossing_id,
      direction: report.direction!,
      wait_minutes: report.wait_minutes,
      status,
      confidence,
      device_hash: deviceHash,
      created_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    accepted: status === "accepted",
    confidence,
    reporterMode,
    message: status === "accepted"
      ? "Raporti u verifikua dhe u shtua te pritja e komunitetit."
      : "Raporti u mor, por nuk u publikua sepse ndryshonte shumë nga pritja aktuale.",
  });
}
