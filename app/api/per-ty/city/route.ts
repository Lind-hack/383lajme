import { NextResponse, type NextRequest } from "next/server";
import { cityById } from "@/lib/cities.mjs";
import { getWeatherAt } from "@/lib/weather";
import { fetchOfficialBorderWaits } from "@/lib/visit-border-server";
import { getDailyFuelSnapshot } from "@/lib/home-market-data";

/**
 * "Qyteti yt sot", the reader's town at the top of Për ty.
 *
 * GET /api/per-ty/city?id=<city id>
 *
 * A town gets its weather; Diaspora, which is not a place, leads with the
 * official border waits instead — the one live number a reader driving home
 * needs. Every town also gets the border range and today's cheapest fuel, both
 * national, as the small print under it. The city id is the only input and it
 * is public (one of lib/cities.mjs), so the answer is the same for everyone who
 * asks and is shared at the edge.
 */
export async function GET(request: NextRequest) {
  const city = cityById(request.nextUrl.searchParams.get("id"));
  if (!city) return NextResponse.json({ error: "unknown city" }, { status: 400 });

  const [weather, waits, fuelSnapshot] = await Promise.all([
    typeof city.lat === "number" && typeof city.lon === "number"
      ? getWeatherAt({ city: city.name, lat: city.lat, lon: city.lon }).catch(() => null)
      : Promise.resolve(null),
    fetchOfficialBorderWaits().catch(() => []),
    getDailyFuelSnapshot().catch(() => null),
  ]);

  const current = waits.filter((w) => w.status === "current");
  // A range across the crossings, not one number: the worst alone would send
  // a driver the long way round for nothing, the best alone would be wrong
  // for three of the four. The per-crossing table lives on /visit.
  const range = (pick: (w: (typeof current)[number]) => number) => {
    const values = current.map(pick).filter((n) => Number.isFinite(n));
    return values.length ? { lo: Math.min(...values), hi: Math.max(...values) } : null;
  };
  const border = current.length
    ? {
        entry: range((w) => w.entry.max),
        exit: range((w) => w.exit.max),
        updatedAt: current.find((w) => w.updatedAt)?.updatedAt ?? null,
      }
    : null;

  // The cheapest of the three brands, per fuel. The hardcoded fallback is a
  // weeks-old price, so it is not shown as today's.
  const cheapest = (pick: (b: NonNullable<typeof fuelSnapshot>["brands"][number]) => number | null) => {
    const values = (fuelSnapshot?.brands ?? []).map(pick).filter((n): n is number => typeof n === "number" && n > 0);
    return values.length ? Math.min(...values) : null;
  };
  const fuel =
    fuelSnapshot && !fuelSnapshot.fallback
      ? { diesel: cheapest((b) => b?.diesel ?? null), petrol: cheapest((b) => b?.petrol ?? null) }
      : null;

  return NextResponse.json(
    {
      id: city.id,
      name: city.name,
      weather,
      border,
      fuel: fuel && (fuel.diesel !== null || fuel.petrol !== null) ? fuel : null,
    },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } }
  );
}
