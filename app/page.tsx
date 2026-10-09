import { getArticles, getArticlesBefore, getLatestArticles } from "@/lib/db";
import { MoveHorizontal } from "lucide-react";
import TextureBg from "@/components/aurora-bg";
import SectionLabel from "@/components/section-label";
import Navbar from "@/components/navbar";
import BreakingBar from "@/components/home/breaking-bar";
import CategoryRail from "@/components/category-rail";
import DispatchRow from "@/components/dispatch-row";
import KryesoreFront, { MostReadRail } from "@/components/kryesore-front";
import DispatchList from "@/components/dispatch-list";
import ColorSpotlight from "@/components/color-spotlight";
import GradientCta from "@/components/gradient-cta";
import Footer from "@/components/footer";
import ReagimiDites from "@/components/reagimi-dites";
import BotaHome from "@/components/home/bota-home";
import HomeVisitPreview from "@/components/visit/home-visit-preview";
import XhepBanner from "@/components/visit/xhep-banner";
import ThrowbackSection from "@/components/throwback-section";
import AlertsCta from "@/components/alerts-cta";
import DailyPoll from "@/components/daily-poll";
import TopFive from "@/components/home/top-five";
import UtilityRail from "@/components/home/utility-rail";
import { freshNews } from "@/lib/fresh-news.mjs";
import {
  CurrencyExchangeCard,
  FuelPricesCard,
  WeatherCard,
} from "@/components/home-market-cards";
import {
  getDailyExchangeSnapshot,
  getDailyFuelSnapshot,
} from "@/lib/home-market-data";
import { getCategoryColor } from "@/lib/category-colors";
import { CATEGORY_TO_SLUG, type NavCategory } from "@/lib/category-map";
import { getCityWeather } from "@/lib/weather";
import { getDailyStories, getToneHistory, getToneOutlets, summarizeToday } from "@/lib/tone-data";
import { dateKeyInKosovo, resolveView } from "@/lib/reagimi-data";
import { getSondazhiData } from "@/lib/sondazhi-server";
import { pickFrontPage, pickMostRead } from "@/lib/front-page.mjs";
import { buildHomeSections, claim, createLedger } from "@/lib/home-sections.mjs";
import { sharpFirst, withImageSizes } from "@/lib/image-size.mjs";
import CategoryBlock from "@/components/home/category-block";
import SectionJump from "@/components/home/section-jump";
import TreguHome from "@/components/home/tregu-home";
import AdSlot from "@/components/home/ad-slot";
import PerTyHome from "@/components/home/per-ty-home";

// Refresh rankings every ten minutes between hourly publication batches.
export const revalidate = 600;

export default async function HomePage() {
  const [rawArticles, rawTickerArticles, rawRecentArticles, exchangeSnapshot, fuelSnapshot, toneHistory, toneOutlets, cityWeather] = await Promise.all([
    getArticles(60),
    getLatestArticles(10),
    // The day's run for the sections below the front block: newest first, no
    // bodies. The front block keeps reading the sixty above, unchanged.
    getArticlesBefore({ limit: 120 }),
    getDailyExchangeSnapshot(),
    getDailyFuelSnapshot(),
    getToneHistory(),
    // Bota për Kosovën reads the rebuilt outlets file: its stories are already
    // filtered to editorial sources and filed under the right country.
    getToneOutlets().catch(() => null),
    // Keyless and individually caught: a weather outage costs the rail one
    // card, never the page.
    getCityWeather().catch(() => []),
  ]);

  // Each story's photo width, so the large slots below can go to photos big
  // enough to fill them (lib/image-size.mjs). Probes are shared per URL, so a
  // story in two of these lists is measured once.
  const [articles, tickerArticles, recentArticles] = await Promise.all([
    withImageSizes(rawArticles),
    withImageSizes(rawTickerArticles),
    withImageSizes(rawRecentArticles),
  ]);

  // Bota për Kosovën: today's index and its stories, ranked the way the full
  // page ranks them (lib/tone-data.ts, stance v4).
  const toneToday = summarizeToday(toneHistory);
  const botaStories = getDailyStories(toneOutlets, toneToday.date);

  // Tier 1: KRYESORE lead + secondary — claimed before NJOFTIME so the
  // front-page hierarchy always renders even when the article pool is small
  // (production automation often yields ~11 fresh articles).
  // Four photo cards beside the lead, then the two-up below it. This claims
  // seven of the pool instead of three, which on a thin automation day (~11
  // fresh articles) leaves NJOFTIME visibly shorter — the stack degrades to
  // however many it gets rather than starving the rail below it.
  // Ranked with age counted against the score and one card per story, so the
  // block leads with today's news instead of yesterday's high scorers. The ten
  // newest join the pool: getArticles ranks without a clock, so a story from
  // the last hour may not be in its top sixty yet. There is no separate hero
  // any more: it used to be taken out of the pool and then rendered nowhere,
  // which hid the day's top story from the front block.
  // The lead is the largest photo on the page; it goes to the best-ranked story
  // whose photo can fill it without stretching.
  const homeNow = Date.now();
  const freshPool = freshNews([...articles, ...recentArticles, ...tickerArticles], { now: homeNow, count: 200 });
  const kryesore = sharpFirst(pickFrontPage(freshPool, 7, homeNow), 1);
  const kryesoreLead = kryesore[0];
  const kryesoreStack = kryesore.slice(1, 5);
  const kryesoreSecondary = kryesore.slice(5, 7);
  const kryesoreTopIds = new Set(kryesore.map((a) => a.id));

  // Reagimi i Ditës — the auto fallback is restricted to articles published TODAY.
  // The previous rule ("highest-scored non-hero article") had no date constraint, so
  // a quiet news week left a days-old article under a heading that promises daily.
  // A curated row wins when one exists; it loads client-side, where the clock is
  // authoritative (this page is statically revalidated hourly).
  const reagimiDateKey = dateKeyInKosovo();
  const reagimiFallback = resolveView(null, articles, reagimiDateKey, kryesoreLead?.id);

  // One ledger for the whole page below the front block: every section claims
  // through it, so no story is shown twice. Më të lexuarat is the exception —
  // a ranking legitimately repeats — and is never recorded here.
  const reagimiArticle = reagimiFallback?.articleSlug
    ? articles.find((a) => a.slug === reagimiFallback.articleSlug)
    : undefined;
  const ledger = createLedger([...kryesore, ...(reagimiArticle ? [reagimiArticle] : [])]);

  // Every section below reads the front block's sixty plus the day's newest,
  // once each.
  const belowPool = [...articles, ...recentArticles];

  // The poll's question and yesterday's outcome are both settled at request
  // time, so they are rendered on the server rather than fetched after
  // hydration — the card used to show an empty loading box for the several
  // seconds this page takes to hydrate. Only the live tally is left to the
  // client. Shares reagimiDateKey so the two adjacent cards cannot disagree
  // about what day it is.
  const sondazhi = await getSondazhiData(reagimiDateKey);

  // Fresh, age-weighted notices get priority over the longer category shelves.
  const njoftimeArticles = freshNews(freshPool, { now: homeNow, exclude: ledger.ids, count: 12 });
  const njoftimeShown = claim(ledger, njoftimeArticles, 12);

  // A ranking may repeat the lead: Top 5 is today's strongest news, rather
  // than leftovers after every category shelf has claimed its stories.
  const topFive = freshNews(freshPool, { now: homeNow, diverse: true, count: 5 });

  const mostRead = pickMostRead(freshPool, 5, { exclude: kryesoreTopIds, now: homeNow });

  // Category shelves follow the fresh notices. Each takes its best remaining
  // stories; thin sections are omitted by their existing display threshold.
  const sections = buildHomeSections(belowPool, ledger, [
    // Kosovë and Shqipëri: a lead, its rail of four and a row of four more.
    { key: "Kosovë", count: 9, category: "Kosovë" },
    { key: "Shqipëri", count: 9, category: "Shqipëri" },
    { key: "Botë", count: 7, category: "Botë" },
    { key: "Ekonomi", count: 7, category: "Ekonomi" },
    { key: "Sport", count: 7, category: "Sport" },
    { key: "Teknologji", count: 7, category: "Teknologji" },
    { key: "Showbiz", count: 7, category: "Showbiz" },
  ]);
  const block = (category: NavCategory) => sections[category] ?? [];

  // Lajmet e fundit claims last and takes the newest of what is left: it is
  // the one section that can show any story, so it gives way to the rest.
  const latest = buildHomeSections(belowPool, ledger, [{ key: "latest", count: 12 }]).latest ?? [];

  // Everything the page shows, so "Shfaq më shumë" never brings one back.
  const seenIds = [...new Set([...ledger.ids, ...mostRead.map((a) => a.id), ...tickerArticles.map((a) => a.id)])];

  // "Kalo te" takes the reader to the whole section, not further down this page.
  const jumpLinks = (["Kosovë", "Shqipëri", "Botë", "Ekonomi", "Sport", "Teknologji", "Showbiz"] as NavCategory[]).map(
    (category) => ({
      href: `/kategori/${CATEGORY_TO_SLUG[category]}`,
      label: category,
      color: getCategoryColor(category),
    })
  );

  return (
    <>
      <TextureBg />

      {/* Fixed nav */}
      <Navbar />

      {/* Latest headlines — a quiet bar under the nav, stepped through at the
          reader's pace. It replaced an orange marquee that out-shouted the lead
          story. The lead is left out: it is already the biggest thing on screen. */}
      <div style={{ position: "relative", zIndex: 10, paddingTop: "var(--nav-h)" }}>
        <BreakingBar
          latest={tickerArticles
            .filter((a) => a.id !== kryesoreLead?.id)
            .slice(0, 6)
            .map((a) => ({
              slug: a.slug,
              title: a.title,
              category: a.category,
              publishedAt: a.publishedAt,
            }))}
          weather={cityWeather[0] ?? null}
        />
        <CategoryRail />
      </div>

      {/* Kryesore now opens the editorial page instead of arriving after utility modules. */}
      {/* Three columns. The two outer ones are reference — money, weather,
          fuel, the day's ranking — and share one warm-paper material so they
          read as a pair of rails. News, and every photograph, lives only in the
          middle. The grid-area names are historical: each side column now
          carries two cards, not the single one it was named for. */}
      {kryesoreLead && (
        <div className="home-front-layout">
          <UtilityRail>
            <FuelPricesCard snapshot={fuelSnapshot} />
            <CurrencyExchangeCard snapshot={exchangeSnapshot} />
            <WeatherCard cities={cityWeather} />
          </UtilityRail>
          <div className="home-front-editorial">
            <KryesoreFront
              lead={kryesoreLead}
              stack={kryesoreStack}
              secondary={kryesoreSecondary}
            />
          </div>
          <div className="home-front-ranking">
            <MostReadRail articles={mostRead} />
          </div>
        </div>
      )}

      {/* Phones: Kosova në xhep right after the lead story. */}
      <XhepBanner />

      {/* From here down: news, then a module, then news. Each news section is
          filled from the page's ledger (see above), so nothing repeats, and the
          modules sit between them as pauses rather than in one run at the end.
          One <main> landmark covers the whole run, full-bleed bands included. */}
      <main>
      <Contained first>
        <SectionLabel
          label="NJOFTIME"
          marginBottom={12}
          right={
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#6B6B6B", fontWeight: 500 }}>
              tërhiq <MoveHorizontal size={14} strokeWidth={2} />
            </span>
          }
        />

        <p style={{ margin: "0 0 18px", maxWidth: "60ch", color: "#5F5B56", fontSize: "14.5px", lineHeight: 1.55 }}>
          Titujt e shpejtë të orëve të fundit. Tërhiq anash për të parë më shumë.
        </p>

        <div style={{ marginBottom: "var(--space-section)" }}>
          <DispatchRow articles={njoftimeShown} />
        </div>

        {/* Top 5 sot — one story per topic, ranked */}
        <div style={{ marginBottom: "var(--space-section)" }}>
          <TopFive articles={topFive} />
        </div>

        {/* Gazeta jote: one line pointing to Për ty, decided on the device. */}
        <div className="pth-strip-wrap">
          <PerTyHome />
        </div>

        {/* Lajmet e fundit — the day's run, one story to a row, and the way
            back through the archive. "Kalo te" above it opens each section. */}
        <SectionJump links={jumpLinks} />
        {latest.length > 0 && (
          <div className="home-latest">
            <DispatchList
              id="lajmet-e-fundit"
              articles={latest}
              max={12}
              size="lg"
              loadMore={{ seenIds }}
            />
            <AdSlot />
          </div>
        )}

        <ReagimiDites fallbackView={reagimiFallback} serverDateKey={reagimiDateKey} />
      </Contained>

      {/* Kosovë and Shqipëri on the page's own paper: a lead, its rail, and a
          row of four more. */}
      {block("Kosovë").length > 0 && (
        <div id="seksioni-kosove" className="home-anchor">
          <ColorSpotlight articles={block("Kosovë")} category="Kosovë" label="KOSOVË" plain more={4} />
        </div>
      )}

      {/* Bota për Kosovën straight after the Kosovo news, then Sondazhi i
          ditës: a pause in the run of Kosovo and Albania news. Bota për
          Kosovën is one daily reading — the index and the stories behind it. */}
      <Contained>
        <BotaHome today={toneToday} stories={botaStories} />
        <DailyPoll data={sondazhi} />
      </Contained>
      {block("Shqipëri").length > 0 && (
        <div id="seksioni-shqiperi" className="home-anchor">
          <ColorSpotlight articles={block("Shqipëri")} category="Shqipëri" label="SHQIPËRI" plain more={4} />
        </div>
      )}

      <Contained>
        <CategoryBlock category="Botë" articles={block("Botë")} layout="bento" />
        <CategoryBlock category="Ekonomi" articles={block("Ekonomi")} layout="overlay" />
      </Contained>

      <Contained first>
        <CategoryBlock category="Sport" articles={block("Sport")} layout="mosaic" />

        {/* 383 Tregu in its own cards, a new set every day. */}
        <TreguHome />

        <CategoryBlock category="Teknologji" articles={block("Teknologji")} layout="overlay" />
        <CategoryBlock category="Showbiz" articles={block("Showbiz")} layout="bento" />

        <HomeVisitPreview />
      </Contained>

      {/* Throwback + Alerts CTA */}
      <Contained first>
        <ThrowbackSection />
        <AlertsCta />
      </Contained>
      </main>

      {/* Gradient CTA */}
      <GradientCta />

      <Footer />
    </>
  );
}

/** The page's centred column. `first` opens a run after a full-bleed band. */
function Contained({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        maxWidth: "1280px",
        margin: "0 auto",
        padding: first ? "64px 24px 0" : "0 24px",
      }}
    >
      {children}
    </div>
  );
}
