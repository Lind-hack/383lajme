import { notFound } from "next/navigation";
import { getArticles } from "@/lib/db";
import { SLUG_TO_CATEGORY } from "@/lib/category-map";
import { getCategoryColor } from "@/lib/category-colors";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import HeroDispatch from "@/components/hero-dispatch";
import NewsGrid from "@/components/news-grid";
import DispatchList from "@/components/dispatch-list";
import Footer from "@/components/footer";

export const revalidate = 7200;

export function generateStaticParams() {
  return Object.keys(SLUG_TO_CATEGORY).map((slug) => ({ category: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { category: string };
}) {
  const categoryName = SLUG_TO_CATEGORY[params.category];
  return { title: categoryName ? `${categoryName} — 383 Lajme` : "383 Lajme" };
}

export default async function CategoryPage({
  params,
}: {
  params: { category: string };
}) {
  const categoryName = SLUG_TO_CATEGORY[params.category];
  if (!categoryName) notFound();

  const articles = getArticles(50, categoryName);
  const accent = getCategoryColor(categoryName);

  const hero = articles[0];
  const gridArticles = articles.slice(hero ? 1 : 0, 7);
  const listArticles = articles.slice(7);

  return (
    <>
      <TextureBg />
      <Navbar />

      <main
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "96px 24px 64px",
        }}
      >
        {/* Category header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "48px",
          }}
        >
          <div
            style={{
              width: "6px",
              height: "36px",
              background: accent,
              borderRadius: "3px",
              flexShrink: 0,
            }}
          />
          <h1
            style={{
              fontSize: "13px",
              fontWeight: 800,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#111111",
              margin: 0,
            }}
          >
            {categoryName}
          </h1>
          <div style={{ flex: 1, height: "1px", background: "#E8E3DB" }} />
        </div>

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
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
            <p style={{ margin: 0 }}>
              Asnjë artikull në kategorinë <strong>{categoryName}</strong> tani për tani.
            </p>
          </div>
        )}

        {/* Hero */}
        {hero && (
          <div style={{ marginBottom: "72px" }}>
            <HeroDispatch article={hero} />
          </div>
        )}

        {/* Grid */}
        {gridArticles.length > 0 && (
          <div style={{ marginBottom: "72px" }}>
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
