import { getLatestArticles } from "@/lib/db";
import { getCityWeather } from "@/lib/weather";
import BreakingBar from "./breaking-bar";

/**
 * The orange "Lajmi i fundit" strip for pages other than the homepage, which
 * builds its own from the lists it already has. Category and article pages
 * used to open without it, so a reader who landed on one from search or a
 * share never saw what had just broken.
 */
export default async function LatestStrip() {
  const [latest, weather] = await Promise.all([
    getLatestArticles(6),
    getCityWeather().catch(() => []),
  ]);
  return (
    <BreakingBar
      latest={latest.map((a) => ({
        slug: a.slug,
        title: a.title,
        category: a.category,
        publishedAt: a.publishedAt,
      }))}
      weather={weather[0] ?? null}
    />
  );
}
