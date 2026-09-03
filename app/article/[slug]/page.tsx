import { notFound } from "next/navigation";
import { jsonLdString } from "@/lib/json-ld";
import type { Metadata } from "next";
import { getArticleBySlug, getArticles } from "@/lib/db";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import ArticleContent from "@/components/article-content";
import Footer from "@/components/footer";
import type { AccordionSlide } from "@/components/image-accordion";
import { getCategoryColor, getCategoryBg } from "@/lib/category-colors";
import { topicForArticle } from "@/lib/topics.mjs";
import { dosjeFor } from "@/lib/dosje-entries";

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
  const image = article.imageUrl
    ? article.imageUrl.startsWith("http")
      ? article.imageUrl
      : `${SITE}${article.imageUrl}`
    : fallbackOgUrl(title, article.category);

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

function titleKws(text: string) {
  return new Set(text.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const catColor = getCategoryColor(article.category);
  const catBg = getCategoryBg(article.category, 0.08);
  // Related cards, the dossier's archive half and the accordion — all of which
  // show a headline and an image. The article being read has its own body from
  // getArticleBySlug; these fifty do not need theirs.
  const allArticles = await getArticles(50, undefined, { withBody: false });

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

  const related: typeof allArticles = [];
  const relatedKws: Set<string>[] = [];
  for (const a of allArticles) {
    if (a.slug === slug || a.category !== article.category) continue;
    const kws = titleKws(a.title);
    if (relatedKws.some((rk) => [...kws].filter((w) => rk.has(w)).length >= 3)) continue;
    related.push(a);
    relatedKws.push(kws);
    if (related.length >= 3) break;
  }

  // Category cards (no image) — one top article per category, deduped
  const accordionCats = [
    { category: "Kosovë",     label: "Kosovë"     },
    { category: "Shqipëri",   label: "Shqipëri"   },
    { category: "Showbiz",    label: "Showbiz"    },
    { category: "Botë",       label: "Botë"       },
    { category: "Teknologji", label: "Teknologji" },
    { category: "Sport",      label: "Sport"      },
  ];
  const usedAccordionIds = new Set<string>();
  // Every branch here ended at allArticles[0], which is undefined once the
  // archive is empty — and the next line read .id off it.
  // Which standing dossier this story belongs to, resolved from its own words
  // rather than a tag, so every article joins one without editorial work. Null
  // when nothing matches, and the rail simply does not render.
  const topic = topicForArticle(article);
  const file = topic ? await dosjeFor(topic.slug, allArticles, article.slug, article) : null;
  const dosje =
    topic && file
      ? {
          topicSlug: topic.slug,
          topicTitle: file.title,
          blurb: file.blurb,
          videos: file.videos ?? [],
          entries: file.entries,
          sourced: file.sourced,
        }
      : null;

  const categorySlides: AccordionSlide[] = accordionCats.flatMap(({ category, label }) => {
    const a =
      allArticles.find((x) => x.category === category && !usedAccordionIds.has(x.id)) ??
      allArticles.find((x) => !usedAccordionIds.has(x.id)) ??
      allArticles[0];
    if (!a) return [];
    usedAccordionIds.add(a.id);
    return [{ article: a, category, label }];
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
        article={article}
        related={related}
        catColor={catColor}
        catBg={catBg}
        categorySlides={categorySlides}
        dosje={dosje}
      />
      <Footer />
    </>
  );
}
