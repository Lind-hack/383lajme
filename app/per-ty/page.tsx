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
import { getArticles } from "@/lib/db";
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

export default async function PerTyPage() {
  const articles = await getArticles(100, undefined, { withBody: false });

  const pool: FeedArticle[] = articles.map((a) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt ?? "",
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
