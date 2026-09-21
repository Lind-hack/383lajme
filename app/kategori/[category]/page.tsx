import { notFound } from "next/navigation";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { getArticles } from "@/lib/db";
import { RESOLVABLE_SLUGS } from "@/lib/category-map";
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
  // Retired slugs are prerendered too, so an old link or an indexed search
  // result lands on the section that absorbed it instead of a 404.
  return Object.keys(RESOLVABLE_SLUGS).map((slug) => ({ category: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const categoryName = RESOLVABLE_SLUGS[category];
  return categoryName ? { title: categoryName } : {};
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams?: Promise<{ city?: string | string[] }>;
}) {
  const { category } = await params;
  const categoryName = RESOLVABLE_SLUGS[category];
  if (!categoryName) notFound();

  const allArticles = await getArticles(50, categoryName);
  const query = searchParams ? await searchParams : {};
  const requestedCity = typeof query.city === "string" ? query.city : undefined;
  const isCityCategory = categoryName === "Kosovë" || categoryName === "Shqipëri";
  const availableCities = isCityCategory
    ? [...new Set(allArticles.map((article) => article.city).filter((city): city is string => Boolean(city)))]
    : [];
  const selectedCity = requestedCity && availableCities.includes(requestedCity) ? requestedCity : undefined;
  const articles = selectedCity
    ? allArticles.filter((article) => article.city === selectedCity)
    : allArticles;
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

      <div style={{ paddingTop: "64px", position: "relative", zIndex: 1 }}>
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

        {isCityCategory && availableCities.length > 0 && (
          <nav
            aria-label={`Filtro sipas qytetit për ${categoryName}`}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "8px",
              marginBottom: "28px",
              padding: "12px 14px",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.72)",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#777" }}>
              Qyteti
            </span>
            <Link
              href={`/kategori/${category}`}
              aria-current={!selectedCity ? "page" : undefined}
              style={{ fontSize: "13px", fontWeight: !selectedCity ? 800 : 600, color: "#222", textDecoration: "none" }}
            >
              Të gjitha ({allArticles.length})
            </Link>
            {availableCities.map((city) => (
              <Link
                key={city}
                href={`/kategori/${category}?city=${encodeURIComponent(city)}`}
                aria-current={selectedCity === city ? "page" : undefined}
                style={{ fontSize: "13px", fontWeight: selectedCity === city ? 800 : 600, color: selectedCity === city ? accent : "#555", textDecoration: "none" }}
              >
                {city} ({allArticles.filter((article) => article.city === city).length})
              </Link>
            ))}
          </nav>
        )}

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
