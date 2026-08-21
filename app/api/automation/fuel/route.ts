import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { automationSecret, isAutomationAuthorized } from "@/lib/tregu-automation.mjs";
import { fetchNaftaSotStations, getDailyFuelSnapshot } from "@/lib/home-market-data";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Does the fuel feed reach production?
 *
 * The card served hardcoded 29 July prices under a "Rifreskim ditor" label for
 * weeks while the same request answered 200 from a laptop. That gap is not
 * diagnosable from outside — the page renders either way — so this reports
 * what the render path actually gets.
 *
 * Gated by the automation secret, like the other routes here, because it says
 * something about the deployment rather than about the news.
 */
function authorized(request: NextRequest) {
  const secrets = [automationSecret(), process.env.CRON_SECRET ?? ""].filter(Boolean);
  const header = request.headers.get("authorization") ?? "";
  return secrets.some((secret) => isAutomationAuthorized(header, secret));
}

/**
 * Receive a snapshot read somewhere Cloudflare allows.
 *
 * Nothing in the deployment can fetch NaftaSot — the render path and CI both
 * get a 403 challenge, and an Origin header returns 500 — so the prices arrive
 * by push instead. scripts/push-fuel-prices.mjs is the sender.
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const snapshot = body?.snapshot;
  const brands = snapshot?.brands;

  if (!Array.isArray(brands) || brands.length === 0) {
    return NextResponse.json({ error: "snapshot.brands is required" }, { status: 422 });
  }
  // A snapshot with no diesel anywhere is a shape change upstream, and would
  // blank the card more convincingly than the stale prices it replaces.
  if (!brands.some((b: { diesel?: number | null }) => typeof b?.diesel === "number")) {
    return NextResponse.json(
      { error: "no diesel price on any brand — refusing to publish" },
      { status: 422 },
    );
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is required" }, { status: 500 });
  }

  const { error } = await supabase.from("fuel_prices").insert({
    snapshot: { ...snapshot, fallback: false },
    fetched_at: body?.fetchedAt ?? new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Without this the card keeps rendering the previous prices for up to an
  // hour: the homepage is statically generated and revalidates on its own
  // schedule, which has nothing to do with when a push arrives. A daily job
  // whose result appears an hour later is not a daily refresh.
  revalidatePath("/");

  return NextResponse.json({ ok: true, brands: brands.length, revalidated: "/" });
}

export async function GET(request: NextRequest) {
  const secrets = [automationSecret(), process.env.CRON_SECRET ?? ""].filter(Boolean);
  const header = request.headers.get("authorization") ?? "";
  if (!secrets.some((secret) => isAutomationAuthorized(header, secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const raw = await fetchNaftaSotStations();
  const snapshot = await getDailyFuelSnapshot();

  return NextResponse.json(
    {
      upstream: raw.ok
        ? { ok: true, stations: raw.stations.length }
        : { ok: false, reason: raw.reason },
      ms: Date.now() - started,
      // What the homepage would render right now.
      serving: snapshot.fallback ? "FALLBACK (hardcoded)" : "live",
      fallbackReason: snapshot.fallbackReason ?? null,
      brands: snapshot.brands.map((b) => ({
        brand: b.brand,
        station: b.station,
        diesel: b.diesel,
        petrol: b.petrol,
        gas: b.gas,
        oldest: b.updatedAt?.slice(0, 10) ?? null,
        newest: b.freshestAt?.slice(0, 10) ?? null,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
