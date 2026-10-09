import { notFound } from "next/navigation";
import { Inbox } from "lucide-react";
import { getArticles, getArticlesBefore } from "@/lib/db";
import type { Article } from "@/lib/mock-data";
import { CATEGORY_TO_SLUG, RESOLVABLE_SLUGS } from "@/lib/category-map";
import { getCategoryColor, getCategoryGradient, CATEGORY_LIGHT_BG } from "@/lib/category-colors";
import { dateKeyInKosovo } from "@/lib/reagimi-data";
import { cityOfArticle, hasCities, sectionCities, sectionCityById } from "@/lib/section-cities.mjs";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import CategoryBanner from "@/components/category-banner";
import LatestStrip from "@/components/home/latest-strip";
import Footer from "@/components/footer";
import KategoriLead from "@/components/kategori/lead";
import CityPicker, { type PickerCity } from "@/components/kategori/city-picker";
import KategoriTimeline, { type TimelineCity, type TimelineItem } from "@/components/kategori/timeline";
import { pickFrontPage } from "@/lib/front-page.mjs";

export const revalidate = 3600;

/** Rows the timeline renders before it starts paging. */
const FIRST_PAGE = 40;
/** The recent stories a city section counts and filters its cities over. */
const CITY_POOL = 150;
/** "Only the main cities": the busiest ones with news, never a wall of chips. */
const MAX_CITY_CHIPS = 10;

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
  searchParams?: Promise<{ qyteti?: string | string[] }>;
}) {
  const { category } = await params;
  const categoryName = RESOLVABLE_SLUGS[category];
  if (!categoryName) notFound();
  const slug = CATEGORY_TO_SLUG[categoryName];
  const byCity = hasCities(categoryName);

  const [rankedArticles, recentArticles] = await Promise.all([
    getArticles(50, categoryName, { withBody: false }),
    // Newest first: the timeline's spine, and the pool a city is counted over.
    getArticlesBefore({ limit: byCity ? CITY_POOL : FIRST_PAGE, category: categoryName }),
  ]);

  // One city per story, decided once for everything this render can show.
  const cityOf = new Map<string, string | null>();
  for (const article of [...rankedArticles, ...recentArticles]) {
    if (article?.id && !cityOf.has(article.id)) cityOf.set(article.id, cityOfArticle(article, categoryName));
  }
  const cities: Record<string, TimelineCity> = Object.fromEntries(
    sectionCities(categoryName).map((c) => [c.id, { name: c.name, emblem: c.emblem }])
  );

  // Chips count the dated pool, so a number means "recent stories from here".
  const counts = new Map<string, number>();
  for (const article of recentArticles) {
    const id = cityOf.get(article.id);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const pickerCities: PickerCity[] = sectionCities(categoryName)
    .map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_CITY_CHIPS);

  const query = searchParams ? await searchParams : {};
  const selected = byCity && typeof query.qyteti === "string" ? sectionCityById(categoryName, query.qyteti) : null;

  // A city is a filter over the pool; the whole section reads the ranked list
  // for its lead and pages on through the archive below it.
  const leadPool = selected
    ? recentArticles.filter((a) => cityOf.get(a.id) === selected.id)
    : [...rankedArticles, ...recentArticles];
  const lead: Article | undefined = pickFrontPage(leadPool, 1)[0];
  const timelineSource = selected ? leadPool : recentArticles.slice(0, FIRST_PAGE);
  const timeline: TimelineItem[] = timelineSource
    .filter((a) => a.id !== lead?.id && a.slug && a.title && a.publishedAt)
    .map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      imageUrl: a.imageUrl ?? null,
      publishedAt: a.publishedAt,
      cityId: cityOf.get(a.id) ?? null,
    }));

  const accent = getCategoryColor(categoryName);
  const [gradFrom, gradTo] = getCategoryGradient(categoryName);
  const lightBg = CATEGORY_LIGHT_BG.has(categoryName);
  // Stories this section published today, Kosovo time.
  const todayKey = dateKeyInKosovo();
  const todayCount = recentArticles.filter(
    (a) => a.publishedAt && dateKeyInKosovo(new Date(a.publishedAt)) === todayKey
  ).length;
  const leadCityId = lead ? cityOf.get(lead.id) : null;

  return (
    <>
      <TextureBg />
      <Navbar />

      <div style={{ paddingTop: "var(--nav-h)", position: "relative", zIndex: 1 }}>
        <LatestStrip />
        <CategoryBanner
          categoryName={categoryName}
          from={gradFrom}
          to={gradTo}
          lightBg={lightBg}
          todayCount={todayCount}
        />
      </div>

      <main className="kat" style={{ ["--kat" as string]: accent }}>
        {byCity && (
          <CityPicker section={categoryName} slug={slug} cities={pickerCities} selected={selected?.id} />
        )}

        {!lead && (
          <div className="kat-empty">
            <Inbox size={40} strokeWidth={1.5} aria-hidden="true" />
            <p>
              {selected ? (
                <>Asnjë lajm i fundit nga <strong>{selected.name}</strong>.</>
              ) : (
                <>Asnjë artikull në kategorinë <strong>{categoryName}</strong> tani për tani.</>
              )}
            </p>
          </div>
        )}

        {lead && <KategoriLead article={lead} city={leadCityId ? cities[leadCityId] : undefined} />}

        <KategoriTimeline
          // A new city is a new list: remount so paging state never carries over.
          key={selected?.id ?? "all"}
          items={timeline}
          cities={cities}
          todayKey={todayKey}
          loadMore={selected ? undefined : { category: slug, seenIds: [lead?.id, ...timeline.map((t) => t.id)].filter((id): id is string => Boolean(id)) }}
          endNote={selected ? `Këto janë lajmet e fundit nga ${selected.name}.` : undefined}
        />
      </main>

      <Footer />
    </>
  );
}
