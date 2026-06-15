import { notFound } from "next/navigation";
import { Inbox } from "lucide-react";
import { getArticles } from "@/lib/db";
import { SLUG_TO_CATEGORY } from "@/lib/category-map";
import { getCategoryColor, getCategoryGradient, CATEGORY_LIGHT_BG } from "@/lib/category-colors";
import { resolveCategoryFigures } from "@/lib/category-figures";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import CategoryBanner from "@/components/category-banner";
import HeroDispatch from "@/components/hero-dispatch";
import NewsGrid from "@/components/news-grid";
import DispatchList from "@/components/dispatch-list";
import Footer from "@/components/footer";

export const revalidate = 3600;

export function generateStaticParams() {
  return Object.keys(SLUG_TO_CATEGORY).map((slug) => ({ category: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const categoryName = SLUG_TO_CATEGORY[category];
  return { title: categoryName ? `${categoryName} — 383 Lajme` : "383 Lajme" };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const categoryName = SLUG_TO_CATEGORY[category];
  if (!categoryName) notFound();

  const articles = getArticles(50, categoryName);
  const accent = getCategoryColor(categoryName);
  const [gradFrom, gradTo] = getCategoryGradient(categoryName);
  const lightBg = CATEGORY_LIGHT_BG.has(categoryName);
  const figures = await resolveCategoryFigures(categoryName);

  const hero = articles[0];
  const gridArticles = articles.slice(hero ? 1 : 0, 7);
  const listArticles = articles.slice(7);

  return (
    <>
      <TextureBg />
      <Navbar />

      <div style={{ paddingTop: "var(--nav-h)", position: "relative", zIndex: 1 }}>
        <CategoryBanner
          categoryName={categoryName}
          from={gradFrom}
          to={gradTo}
          articleCount={articles.length}
          lightBg={lightBg}
          figures={figures}
        />
      </div>

      <main
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "var(--space-section) 24px",
        }}
      >

        {/* Empty state */}
        {articles.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "120px 24px",
              color: "#999",
              fontSize: "15px",
            }}
          >
            <Inbox
              size={40}
              strokeWidth={1.5}
              style={{ color: "#CCCCCC", marginBottom: "16px", display: "block", margin: "0 auto 16px" }}
            />
            <p style={{ margin: 0 }}>
              Asnjë artikull në kategorinë <strong>{categoryName}</strong> tani për tani.
            </p>
          </div>
        )}

        {/* Hero */}
        {hero && (
          <div style={{ marginBottom: "var(--space-section)" }}>
            <HeroDispatch article={hero} />
          </div>
        )}

        {/* Grid */}
        {gridArticles.length > 0 && (
          <div style={{ marginBottom: "var(--space-section)" }}>
            <NewsGrid articles={gridArticles} title={categoryName.toUpperCase()} />
          </div>
        )}

        {/* List */}
        {listArticles.length > 0 && (
          <DispatchList articles={listArticles} />
        )}
      </main>

      <Footer />
    </>
  );
}
