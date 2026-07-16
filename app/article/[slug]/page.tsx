import { notFound } from "next/navigation";
import { getArticleBySlug, getArticles } from "@/lib/db";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import ArticleContent from "@/components/article-content";
import Footer from "@/components/footer";
import type { AccordionSlide } from "@/components/image-accordion";
import { getCategoryColor, getCategoryBg } from "@/lib/category-colors";

export const revalidate = 7200;

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
  const allArticles = await getArticles(50);

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
    { category: "Politikë",   label: "Politikë"   },
    { category: "Showbiz",    label: "Showbiz"    },
    { category: "Botë",       label: "Botë"       },
    { category: "Teknologji", label: "Teknologji" },
    { category: "Sport",      label: "Sport"      },
  ];
  const usedAccordionIds = new Set<string>();
  const categorySlides: AccordionSlide[] = accordionCats.map(({ category, label }) => {
    const a =
      allArticles.find((x) => x.category === category && !usedAccordionIds.has(x.id)) ??
      allArticles.find((x) => !usedAccordionIds.has(x.id)) ??
      allArticles[0];
    usedAccordionIds.add(a.id);
    return { article: a, category, label };
  });

  return (
    <>
      <TextureBg />
      <Navbar />
      <ArticleContent
        article={article}
        related={related}
        catColor={catColor}
        catBg={catBg}
        categorySlides={categorySlides}
      />
      <Footer />
    </>
  );
}
