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

/** How far back the feed looks. The newsroom publishes ~45 stories a day. */
const WINDOW_DAYS = 7;
const PAGE = 150;

export default async function PerTyPage() {
  // The whole of the last week, newest first, plus the day's top-ranked
  // stories. It used to be the top 100 alone: two days of mostly Botë and
  // Kosovë, so a reader who followed a smaller city or a less-covered person
  // was matched against almost nothing that had ever named them.
  const since = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const [top, newest] = await Promise.all([
    getArticles(100, undefined, { withBody: false }),
    getArticlesBefore({ limit: PAGE }),
  ]);
  const older =
    newest.length === PAGE && Date.parse(newest[PAGE - 1]?.publishedAt ?? "") > since
      ? await getArticlesBefore({ before: newest[PAGE - 1].publishedAt, limit: PAGE })
      : [];

  const seen = new Set<string>();
  const articles = [...top, ...newest, ...older].filter((a) => {
    if (!a?.slug || seen.has(a.slug)) return false;
    seen.add(a.slug);
    return Date.parse(a.publishedAt) >= since;
  });

  const pool: FeedArticle[] = articles.map((a) => ({
    slug: a.slug,
    title: a.title,
    // The card shows two lines of it; the ranker reads names in it. More is
    // only weight on every reader's page.
    excerpt: (a.excerpt ?? "").slice(0, 240),
    category: a.category,
    city: a.city,
    source: a.source,
    publishedAt: a.publishedAt,
    imageUrl: a.imageUrl,
    engagementScore: a.engagementScore,
  }));

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
