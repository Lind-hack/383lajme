import { NextResponse } from "next/server";
import { getCityWeather } from "@/lib/weather";

/**
 * The homepage's Moti card polls this every 30 minutes, so a tab left open
 * (or restored from a phone's memory) shows current weather instead of the
 * reading baked into the page when it was rendered. getCityWeather caches
 * Open-Meteo for 30 minutes, so polling costs the free service nothing extra.
 */
export async function GET() {
  const cities = await getCityWeather().catch(() => []);
  return NextResponse.json(
    { cities },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" } },
  );
}
