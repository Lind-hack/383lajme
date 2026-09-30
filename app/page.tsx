// Sot — the shared public homepage.
//
// News first, then one plain-language introduction to each thing 383 can do
// that a Kosovo news reader cannot get elsewhere, then a lot more news.
//
// The first pass of this redesign cut too far. It answered "what is this site?"
// and then ran out of page: a reader who understood 383 in ten seconds had
// nothing left to do, which is the opposite of what a news site wants. This
// version keeps the clear opening and puts the volume back — the topic
// carousel, the NJOFTIME drag rail, and a longer tail — so there is always
// another story within a flick.
//
// Reference data (weather, lek rate, diesel) sits in one thin strip at the very
// top. It used to be two 374px cards flanking the lead story, which gave a
// currency converter the same weight as the day's main development.

import { existsSync } from "node:fs";
import path from "node:path";

import { getArticles, getLatestArticles } from "@/lib/db";
import { njoftimeBudget, selectHomeTail } from "@/lib/home-news-sections.mjs";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import Toaster from "@/components/ui/toast";
import SectionLabel from "@/components/section-label";
import SectionBoundary from "@/components/ui/section-boundary";
import { MoveHorizontal } from "lucide-react";

import BreakingBar from "@/components/home/breaking-bar";
import TrustBar from "@/components/home/trust-bar";
import LeadBlock from "@/components/home/lead-block";
import FeatureCards, { type BotaFinding, type BorderSummary } from "@/components/home/feature-cards";
import PerTyBlock, { type PreviewArticle } from "@/components/home/per-ty-block";
import CategoryChips from "@/components/home/category-chips";
import LatestStrip from "@/components/home/news-tail";

import ImageAccordion, { type AccordionSlide } from "@/components/image-accordion";
import DispatchRow from "@/components/dispatch-row";
import DispatchList from "@/components/dispatch-list";
import ReagimiDites from "@/components/reagimi-dites";
import DailyPoll from "@/components/daily-poll";

import { getDailyExchangeSnapshot, getDailyFuelSnapshot } from "@/lib/home-market-data";
import { getCityWeather } from "@/lib/weather";
import { getToneArticleCache, getForeignCoverage } from "@/lib/tone-data";
import { fetchOfficialBorderWaits } from "@/lib/visit-border-server";
import { dateKeyInKosovo, resolveView } from "@/lib/reagimi-data";
import { getSondazhiData } from "@/lib/sondazhi-server";
import { NAV_CATEGORIES } from "@/lib/category-map";
import { CATEGORY_COLORS } from "@/lib/category-colors";

// Publication notifications invalidate the cached page; allow regeneration
// after five minutes when that notification is missed.
export const revalidate = 300;

/** Words long enough to be worth comparing when de-duplicating two headlines. */
function titleKws(text: string) {
  return new Set(text.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
}

/**
 * Section budgets.
 *
 * Every prominent section claims its stories exclusively, so nothing is printed
 * twice — but that means a fixed rail length starves whatever comes after it.
 * The article pool is not reliably 60: when Supabase is unavailable the page
 * falls back to the committed batches, and one batch is about 21 stories. A
 * hard 16-card rail would take all of them and leave the bottom of the page
 * empty, which is the exact failure this redesign is meant to fix.
 *
 * The rail takes up to 16 while preserving eight stories for the tail. Small
 * batches get a shorter rail, or no rail, rather than an empty archive.
 */

/**
 * The border photograph is supplied by the editor, not generated. Until the
 * file exists the Diaspora card falls back to the authored Kosovo map, which is
 * a true depiction of the four crossings rather than a stock photo of a border
 * somewhere else. The file now exists at public/images/home/kufi.png.
 */
const BORDER_IMAGE = "/images/home/kufi.png";
function borderImageIfPresent(): string | null {
  try {
    return existsSync(path.join(process.cwd(), "public", "images", "home", "kufi.png"))
      ? BORDER_IMAGE
      : null;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  // Every third-party read is individually caught. A bank rate, a fuel table, a
  // weather service or a border scrape failing costs its own chip — never the
  // day's news.
  const [articles, latest, toneCache, exchange, fuel, weather, borderWaits] =
    await Promise.all([
      getArticles(60, undefined, { withBody: false }),
      getLatestArticles(12),
      getToneArticleCache().catch(() => null),
      getDailyExchangeSnapshot().catch(() => null),
      getDailyFuelSnapshot().catch(() => null),
      getCityWeather().catch(() => []),
      fetchOfficialBorderWaits().catch(() => []),
    ]);

  const reagimiDateKey = dateKeyInKosovo();

  // ── Tier 1: the lead and its three supporting stories ────────────────────
  const lead = articles.find((a) => a.featured) ?? articles[0];
  // Five. The shell is much wider than it was, so the hero is taller and the
  // headline column has to run further to finish level beside it.
  const supporting = articles.filter((a) => a.id !== lead?.id).slice(0, 5);
  const claimed = new Set([lead?.id, ...supporting.map((a) => a.id)].filter(Boolean));

  const reagimiFallback = resolveView(null, articles, reagimiDateKey, lead?.id);
  const sondazhi = await getSondazhiData(reagimiDateKey).catch(() => null);

  // ── Tier 2: "Sot në pak fjalë" — one story per topic, as photo cards ─────
  // A card always names the category its article actually has. The old version
  // kept the category we had *asked* for, so a quiet Teknologji day put a purple
  // TEKNOLOGJI badge on a Sport story.
  const accordionOrder = ["Kosovë", "Shqipëri", "Showbiz", "Botë", "Teknologji"];
  const usedAccordionIds = new Set<string>();
  const usedAccordionCats = new Set<string>();
  const accordionSlides: AccordionSlide[] = [];

  for (const category of accordionOrder) {
    const exact = articles.find(
      (a) => a.category === category && !usedAccordionIds.has(a.id) && !claimed.has(a.id)
    );
    const article =
      exact ??
      articles.find(
        (a) =>
          !usedAccordionIds.has(a.id) &&
          !claimed.has(a.id) &&
          !usedAccordionCats.has(a.category) &&
          // Some stored rows carry a mangled category ("Bot?"), which would
          // otherwise surface verbatim as a card label.
          a.category in CATEGORY_COLORS
      );
    if (!article) continue;

    usedAccordionIds.add(article.id);
    usedAccordionCats.add(article.category);
    accordionSlides.push({ article, category: article.category, label: article.category });
  }
  accordionSlides.forEach((s) => claimed.add(s.article.id));

  // ── Tier 3: NJOFTIME — the drag rail ─────────────────────────────────────
  const unclaimed = articles.filter((a) => !claimed.has(a.id)).length;
  const njoftimeTarget = njoftimeBudget(unclaimed);

  const njoftime: typeof articles = [];
  const njoftimeKws: Set<string>[] = [];
  const pushNjoftime = (pool: typeof articles) => {
    for (const a of pool) {
      if (njoftime.length >= njoftimeTarget) return;
      if (claimed.has(a.id) || njoftime.some((n) => n.id === a.id)) continue;
      const kws = titleKws(a.title);
      if (njoftimeKws.some((rk) => [...kws].filter((w) => rk.has(w)).length >= 3)) continue;
      njoftime.push(a);
      njoftimeKws.push(kws);
    }
  };
  // Prefer the strongest stories, then widen the floor rather than repeat one.
  pushNjoftime(articles.filter((a) => (a.engagementScore ?? 0) >= 7));
  pushNjoftime(articles);
  njoftime.forEach((a) => claimed.add(a.id));

  // ── Feature-card data ────────────────────────────────────────────────────
  const coverage = getForeignCoverage(toneCache, 1);
  const coveragePool = Object.values(toneCache?.articles ?? {}).filter((a) => a.imageUrl && a.translated);
  const bota: BotaFinding = coverage[0]
    ? {
        outlet: coverage[0].outlet,
        line: coverage[0].title,
        articleCount: coveragePool.length,
        countryCount: new Set(coveragePool.map((a) => a.country)).size,
      }
    : null;

  // A range across the crossings, not a single number: "10 min" would be wrong
  // for three of the four, and the worst case alone would send someone the long
  // way round for no reason. The per-crossing table lives on /visit.
  const range = (pick: (w: (typeof borderWaits)[number]) => number) => {
    const values = borderWaits.map(pick).filter((n) => Number.isFinite(n));
    if (values.length === 0) return null;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    return { lo, hi };
  };
  const border: BorderSummary = borderWaits.length
    ? {
        entry: range((w) => w.entry.max),
        exit: range((w) => w.exit.max),
        updatedAt: borderWaits.find((w) => w.updatedAt)?.updatedAt ?? null,
      }
    : null;

  // ── Tail: the rest of the day ────────────────────────────────────────────
  // Deliberately the WHOLE pool, not the unclaimed remainder. "Already shown
  // above" and "matches what this reader follows" are different questions, and
  // filtering by the first makes the second lie: with the carousels claiming
  // ~25 stories, a reader who follows Sport would be told there is no sport
  // news today while a sport headline sits higher up the same page.
  const perTyPool: PreviewArticle[] = articles
    .slice(0, 40)
    .map((a) => ({ slug: a.slug, title: a.title, category: a.category, source: a.source }));

  // Editorial engagement scores rank recommendations, not measured page views.
  // Recommendations may repeat the lead and do not consume the archive pool.
  const recommended = articles
    .slice()
    .sort((a, b) => (b.engagementScore ?? 0) - (a.engagementScore ?? 0))
    .slice(0, 5);

  const counts = NAV_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat.label] = articles.filter((a) => a.category === cat.label).length;
    return acc;
  }, {});

  const { recent: teFundit, story: storyOfDay, archive: listArticles } =
    selectHomeTail(articles, latest, claimed);

  return (
    <>
      <TextureBg />
      <Navbar />

      <div style={{ position: "relative", zIndex: 10, paddingTop: "var(--nav-h)" }}>
        <BreakingBar
          latest={latest.map((a) => ({ slug: a.slug, title: a.title, category: a.category, publishedAt: a.publishedAt }))}
          weather={weather[0] ?? null}
        />
      </div>

      <main className="home-shell" style={{ position: "relative", zIndex: 1 }}>
        {lead && (
          <LeadBlock
            lead={lead}
            supporting={supporting}
            weather={weather}
            exchange={exchange}
            fuel={fuel}
            recommended={recommended}
          />
        )}

        {/* Sot në pak fjalë — the top five, as the photo cards this section had
            before. A numbered text list was more readable and much emptier; on
            a news homepage the picture is doing work, not decorating. */}
        {/* Sot në pak fjalë — the top five, as the photo cards this section
            had before. A numbered text list read as more legible and much
            emptier; on a news homepage the picture is doing work, not
            decorating. The carousel carries its own heading, so there is no
            SectionLabel above it saying the same thing twice. */}
        {accordionSlides.length > 0 && <ImageAccordion slides={accordionSlides} />}

        {/* NJOFTIME — the drag rail, restored. Sixteen headlines cost scroll
            distance inside the rail rather than page height. */}
        {njoftime.length > 0 && (
          <section aria-labelledby="home-njoftime-title">
            <SectionLabel
              label={<span id="home-njoftime-title">Njoftime</span>}
              marginBottom={12}
              right={
                <span className="home-drag-hint">
                  tërhiq <MoveHorizontal size={14} strokeWidth={2} aria-hidden="true" />
                </span>
              }
            />
            <p className="home-brief-lede">
              Titujt e shpejtë të orëve të fundit. Tërhiq anash për të parë më shumë.
            </p>
            <div className="home-dispatch-rail">
              <DispatchRow articles={njoftime} />
            </div>
          </section>
        )}

        <SectionBoundary label="Veçoritë">
          <FeatureCards
            bota={bota}
            border={border}
            borderImage={borderImageIfPresent()}
          />
        </SectionBoundary>

        <SectionBoundary label="Lajmet sipas interesave">
          <PerTyBlock pool={perTyPool} />
        </SectionBoundary>

        <CategoryChips counts={counts} />

        <LatestStrip latest={teFundit} story={storyOfDay} />

        {/* The archive tail. This is the page's floor: a reader who has read
            everything above still has a dozen stories left before they run out. */}
        {listArticles.length > 0 && (
          <section id="lajmet-e-fundit">
            <DispatchList articles={listArticles} />
          </section>
        )}

        <TrustBar
          sourceCount={new Set(articles.map((a) => a.source).filter(Boolean)).size}
          articleCount={articles.length}
        />

        <section aria-labelledby="home-more-title">
          <SectionLabel label={<span id="home-more-title">Më shumë nga 383</span>} />

          <SectionBoundary label="Reagimi i ditës">
            <ReagimiDites fallbackView={reagimiFallback} serverDateKey={reagimiDateKey} />
          </SectionBoundary>

          {sondazhi && (
            <SectionBoundary label="Sondazhi i ditës">
              <DailyPoll data={sondazhi} />
            </SectionBoundary>
          )}
        </section>
      </main>

      <Toaster />
      <Footer />
    </>
  );
}
