import { notFound } from "next/navigation";
import { getArticleBySlug, getArticles } from "@/lib/db";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import ArticleContent from "@/components/article-content";
import Footer from "@/components/footer";
import { getCategoryColor, getCategoryBg } from "@/lib/category-colors";

export const revalidate = 7200;

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const catColor = getCategoryColor(article.category);
  const catBg = getCategoryBg(article.category, 0.08);
  const allArticles = getArticles(50);
  const related = allArticles
    .filter((a) => a.slug !== slug && a.category === article.category)
    .slice(0, 3);

  return (
    <>
      <TextureBg />
      <Navbar />
      <ArticleContent
        article={article}
        related={related}
        catColor={catColor}
        catBg={catBg}
      />
      <Footer />
    </>
  );
}
