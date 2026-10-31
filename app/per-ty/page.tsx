// Për ty — the reader's personal feed.
//
// A distinct route from `/`: Sot stays the shared public homepage and is never
// silently replaced by a personalised one, and both stay one tap apart.
//
// The page is a thin server shell. It sends every reader the same public pool
// of recent stories; the client ranks it against the choices stored on the
// reader's own device (lib/per-ty-rank.mjs). No personalised response is ever
// rendered on the server, so nothing here can land in a shared cache and leak
// one reader's feed to another.

import type { Metadata } from "next";
import { getArticles, getArticlesBefore } from "@/lib/db";
import { getCoverArtMap } from "@/lib/cover-art-server";
import { getSummaryMap } from "@/lib/story-summary-server";
import { withImageSizes } from "@/lib/image-size.mjs";
import { storyTags } from "@/lib/per-ty-rank.mjs";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import PerTyFeed, { type FeedArticle } from "./per-ty-feed";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Për ty",
  description:
    "Lajmet për njerëzit, qytetin dhe temat që ndjek. Pa llogari — zgjedhjet ruhen në pajisjen tënde.",
  // The feed differs per device, so there is nothing stable here to index.
  robots: { index: false, follow: true },
};

/** How far back the feed looks. The newsroom publishes 45–110 stories a day. */
const WINDOW_DAYS = 7;
const PAGE = 150;
/**
 * At most this many pages of PAGE to cover the window; reading stops at the
 * window's edge. Two pages (the old fixed limit) only reached about three and
 * a half days back on a busy week, so a follow covered on Monday was "quiet"
 * by Thursday. Six cover a week at the newsroom's busiest pace (~110 a day).
 */
const MAX_PAGES = 6;

export default async function PerTyPage() {
  // The whole of the last week, newest first, plus the day's top-ranked
  // stories. It used to be the top 100 alone: two days of mostly Botë and
  // Kosovë, so a reader who followed a smaller city or a less-covered person
  // was matched against almost nothing that had ever named them.
  const since = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  // With bodies, so every story is tagged from its whole text below; the
  // bodies themselves never leave the server.
  const [top, newest, covers, summaries] = await Promise.all([
    getArticles(100, undefined, { withBody: false }),
    getArticlesBefore({ limit: PAGE, withBody: true }),
    getCoverArtMap(),
    getSummaryMap(),
  ]);
  const older: typeof newest = [];
  let last = newest;
  for (let page = 1; page < MAX_PAGES; page++) {
    const edge = last[last.length - 1]?.publishedAt;
    if (last.length < PAGE || !(Date.parse(edge ?? "") > since)) break;
    last = await getArticlesBefore({ before: edge, limit: PAGE, withBody: true });
    older.push(...last);
  }

  const seen = new Set<string>();
  // Measured so the big lead slot can prefer a photo that stays sharp in it
  // (lib/image-size.mjs); widths are remembered per photo across renders.
  const articles = await withImageSizes(
    // Rows with bodies first: the first copy of a story wins, and the top list
    // carries no body to tag from.
    [...newest, ...older, ...top].filter((a) => {
      if (!a?.slug || seen.has(a.slug)) return false;
      seen.add(a.slug);
      return Date.parse(a.publishedAt) >= since;
    })
  );

  const toFeed = (a: (typeof articles)[number]): FeedArticle => ({
    slug: a.slug,
    title: a.title,
    // The card shows two lines of it; the ranker reads names in it. More is
    // only weight on every reader's page.
    excerpt: (a.excerpt ?? "").slice(0, 240),
    category: a.category,
    city: a.city,
    // Every listed person and town the full text names (lib/per-ty-rank storyTags).
    tags: storyTags({ title: a.title, body: a.body || a.excerpt, city: a.city }),
    source: a.source,
    publishedAt: a.publishedAt,
    imageUrl: a.imageUrl,
    ...(a.imageWidth ? { imageWidth: a.imageWidth } : {}),
    engagementScore: a.engagementScore,
    // Dardani's two or three sentences (lib/story-summary), once written.
    ...(summaries[a.slug] ? { summary: summaries[a.slug].text, summaryByDardani: summaries[a.slug].byDardani } : {}),
    // The clay plate, when the story is one of the day's leads (lib/cover-art).
    ...(covers[a.slug] ? { coverArt: covers[a.slug] } : {}),
  });
  const pool = articles.map(toFeed);

  return (
    <>
      <TextureBg />
      <Navbar />
      <div className="perty-page">
        <PerTyFeed pool={pool} />
      </div>
      <Footer />
    </>
  );
}
