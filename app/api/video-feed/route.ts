import { NextResponse } from "next/server";
import { getVideoFeed, mixForHome, toVideoItem } from "@/lib/video-feed";
import { getCategoryColor } from "@/lib/category-colors";

/**
 * Every approved video, the sections in turn (the homepage's order). The
 * player fetches this when a row's own videos run out, so the feed goes on
 * into the other sections' videos instead of stopping. lib/video-feed caches
 * the list for five minutes.
 */
export async function GET() {
  const items = mixForHome(await getVideoFeed()).map((v) => toVideoItem(v, getCategoryColor(v.category)));
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
