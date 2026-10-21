import { notFound } from "next/navigation";
import { jsonLdString } from "@/lib/json-ld";
import type { Metadata } from "next";
import { getArticleBySlug, getArticles, getArticlesBefore } from "@/lib/db";
import { isSameStory } from "@/lib/front-page.mjs";
import { rankRelated } from "@/lib/related-articles.mjs";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import ArticleContent from "@/components/article-content";
import LatestStrip from "@/components/home/latest-strip";
import { probeImageSize } from "@/lib/image-size.mjs";
import Footer from "@/components/footer";
import ReadingAffinity from "@/components/reading-affinity";
import { countWords } from "@/lib/reading-engagement.mjs";
import type { AccordionSlide } from "@/components/image-accordion";
import { getCategoryColor, getCategoryBg } from "@/lib/category-colors";
import { topicForArticle } from "@/lib/topics.mjs";
import { dosjeFor, dosjeUniverse } from "@/lib/dosje-entries";

export const revalidate = 7200;

const SITE = "https://www.383ks.com";

/** Branded card for articles without an image, rendered by /api/og. */
function fallbackOgUrl(title: string, category?: string): string {
  const params = new URLSearchParams({ title });
  if (category) params.set("category", category);
  return `${SITE}/api/og?${params.toString()}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};

  const url = `${SITE}/article/${slug}`;
  const title = article.title;
  const description =
    article.excerpt || article.body.replace(/\s+/g, " ").trim().slice(0, 160);
  // Platforms can strip image credits/captions. Export an original 383 title
  // card rather than redistributing an unlabelled archival photograph.
  const image = fallbackOgUrl(title, article.category);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: "383",
      title,
      description,
      ...(article.publishedAt ? { publishedTime: article.publishedAt } : {}),
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = await getArticleBySlug(slug);
  if (!found) notFound();
  // The hero is shown at no more than the photo's own width, so it needs to
  // know that width; a failed probe leaves it undefined and the hero fills.
  const heroSize = await probeImageSize(found.imageUrl);
  const article = heroSize ? { ...found, imageWidth: heroSize.width, imageHeight: heroSize.height } : found;

  const catColor = getCategoryColor(article.category);
  const catBg = getCategoryBg(article.category, 0.08);
  // The dossier's archive half reads the fifty most-read; everything a reader
  // is offered next — related stories, the section and latest lists, the
  // category row — comes from the newest 150, so it is about now. Neither list
  // carries bodies: the article being read has its own from getArticleBySlug.
  const [allArticles, recentArticles] = await Promise.all([
    getArticles(50, undefined, { withBody: false }),
    getArticlesBefore({ limit: 150 }),
  ]);

  const canonicalUrl = `${SITE}/article/${slug}`;
  const ogImage = article.imageUrl
    ? article.imageUrl.startsWith("http")
      ? article.imageUrl
      : `${SITE}${article.imageUrl}`
    : fallbackOgUrl(article.title, article.category);

  // Google News / Discover eligibility: per-article structured data. The
  // sitewide Organization graph in layout.tsx covers identity; this covers the
  // story itself.
  const newsArticleJsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title.slice(0, 110),
    description:
      article.excerpt || article.body.replace(/\s+/g, " ").trim().slice(0, 160),
    image: [ogImage],
    ...(article.publishedAt
      ? { datePublished: article.publishedAt, dateModified: article.publishedAt }
      : {}),
    author: [{ "@type": "Organization", name: "383", url: SITE }],
    publisher: {
      "@type": "NewsMediaOrganization",
      name: "383",
      logo: { "@type": "ImageObject", url: `${SITE}/logo-512.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
  };

  // Which standing dossier this story belongs to, resolved from its own words
  // rather than a tag, so every article joins one without editorial work. Null
  // when nothing matches, and the dossier simply does not render.
  // Matched over every subject both halves know, so the rail beside a story and
  // the dossier it links to can never disagree about which file the story is in.
  const universe = await dosjeUniverse();
  const topic = topicForArticle(article, universe);
  const file = topic ? await dosjeFor(topic.slug, allArticles, article.slug, article) : null;
  const dosje =
    topic && file
      ? {
          topicSlug: topic.slug,
          topicTitle: file.title,
          blurb: file.blurb,
          primer: file.primer ?? null,
          videos: file.videos ?? [],
          entries: file.entries,
          sourced: file.sourced,
        }
      : null;

  // Related means about the same thing: shared people, places and words,
  // fresher first (lib/related-articles.mjs). Stories already in this dossier
  // get a lift. The three closest go beside the story, the next three below
  // it; every slot needs a photograph, and a weak match leaves a slot empty
  // rather than filling it with something unrelated.
  const pool = [...recentArticles, ...allArticles];
  const topicSlugs = (dosje?.entries ?? []).flatMap((e) => (e.slug ? [e.slug] : []));
  const closest = rankRelated(article, pool, { limit: 6, requireImage: true, topicSlugs });
  const sidebarRelated = closest.slice(0, 3);
  const related = closest.slice(3, 6);

  // Where to go next, once the story is read: the newest from its section,
  // then the newest from everywhere else. Neither repeats this story, a
  // related story, or a second write-up of either, and each needs a photo so
  // the two lists line up row for row.
  const shownTitles = [article.title, ...closest.map((a) => a.title)];
  const shownIds = new Set([article.id, ...closest.map((a) => a.id)]);
  const nextUp = (count: number, keep: (a: (typeof recentArticles)[number]) => boolean) => {
    const picked: typeof recentArticles = [];
    for (const a of recentArticles) {
      if (picked.length >= count) break;
      if (!a.imageUrl || shownIds.has(a.id) || !keep(a)) continue;
      if (shownTitles.some((t) => isSameStory(t, a.title))) continue;
      picked.push(a);
      shownIds.add(a.id);
      shownTitles.push(a.title);
    }
    return picked;
  };
  const moreFromCategory = nextUp(6, (a) => a.category === article.category);
  const latestElsewhere = nextUp(6, (a) => a.category !== article.category);

  // One card per section for "Eksploro sipas kategorisë": that section's
  // newest story with a photograph. A section with nothing recent is left out
  // rather than filled with another section's story.
  const exploreCats = ["Kosovë", "Shqipëri", "Botë", "Sport", "Teknologji", "Showbiz"];
  const categorySlides: AccordionSlide[] = exploreCats.flatMap((category) => {
    const a = recentArticles.find(
      (x) =>
        x.category === category &&
        x.imageUrl &&
        !shownIds.has(x.id) &&
        !shownTitles.some((t) => isSameStory(t, x.title))
    );
    if (!a) return [];
    shownIds.add(a.id);
    shownTitles.push(a.title);
    return [{ article: a, category, label: category }];
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(newsArticleJsonLd) }}
      />
      <TextureBg />
      <Navbar />
      <ArticleContent
        latestStrip={<LatestStrip />}
        article={article}
        related={related}
        sidebarRelated={sidebarRelated}
        moreFromCategory={moreFromCategory}
        latestElsewhere={latestElsewhere}
        catColor={catColor}
        catBg={catBg}
        categorySlides={categorySlides}
        dosje={dosje}
      />
      {/* Device-only: lets Për ty learn from what the reader stays to read. */}
      <ReadingAffinity
        slug={article.slug}
        title={article.title}
        excerpt={article.excerpt}
        category={article.category}
        city={article.city}
        words={countWords(article.body)}
      />
      <Footer />
    </>
  );
}
