import { NextResponse, type NextRequest } from "next/server";
import { cityById } from "@/lib/cities.mjs";
import { getWeatherAt } from "@/lib/weather";
import { fetchOfficialBorderWaits } from "@/lib/visit-border-server";

/**
 * The home-city panel at the top of Për ty.
 *
 * GET /api/per-ty/city?id=<city id>
 *
 * A town gets its weather; Diaspora, which is not a place, gets the official
 * border waits instead — the one live number a reader driving home needs. The
 * city id is the only input and it is public (one of lib/cities.mjs), so the
 * answer is the same for everyone who asks and is shared at the edge.
 */
export async function GET(request: NextRequest) {
  const city = cityById(request.nextUrl.searchParams.get("id"));
  if (!city) return NextResponse.json({ error: "unknown city" }, { status: 400 });

  const weather =
    typeof city.lat === "number" && typeof city.lon === "number"
      ? await getWeatherAt({ city: city.name, lat: city.lat, lon: city.lon }).catch(() => null)
      : null;

  let border = null;
  if (city.id === "diaspora") {
    const waits = await fetchOfficialBorderWaits().catch(() => []);
    const current = waits.filter((w) => w.status === "current");
    // A range across the crossings, not one number: the worst alone would send
    // a driver the long way round for nothing, the best alone would be wrong
    // for three of the four. The per-crossing table lives on /visit.
    const range = (pick: (w: (typeof current)[number]) => number) => {
      const values = current.map(pick).filter((n) => Number.isFinite(n));
      return values.length ? { lo: Math.min(...values), hi: Math.max(...values) } : null;
    };
    border = current.length
      ? {
          entry: range((w) => w.entry.max),
          exit: range((w) => w.exit.max),
          updatedAt: current.find((w) => w.updatedAt)?.updatedAt ?? null,
        }
      : null;
  }

  return NextResponse.json(
    { id: city.id, name: city.name, weather, border },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } }
  );
}
