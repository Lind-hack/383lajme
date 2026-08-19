import { NextResponse, type NextRequest } from "next/server";
import { automationSecret, isAutomationAuthorized } from "@/lib/tregu-automation.mjs";
import { fetchNaftaSotStations, getDailyFuelSnapshot } from "@/lib/home-market-data";

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
