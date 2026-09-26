import { getArticles, getArticlesBefore, getLatestArticles } from "@/lib/db";
import { MoveHorizontal } from "lucide-react";
import TextureBg from "@/components/aurora-bg";
import SectionLabel from "@/components/section-label";
import Navbar from "@/components/navbar";
import BreakingBar from "@/components/home/breaking-bar";
import DispatchRow from "@/components/dispatch-row";
import KryesoreFront, { MostReadRail } from "@/components/kryesore-front";
import DispatchList from "@/components/dispatch-list";
import ColorSpotlight from "@/components/color-spotlight";
import GradientCta from "@/components/gradient-cta";
import Footer from "@/components/footer";
import ReagimiDites from "@/components/reagimi-dites";
import ToneDashboard from "@/components/tone-dashboard";
import BotaFlet from "@/components/bota-flet";
import HomeVisitPreview from "@/components/visit/home-visit-preview";
import ThrowbackSection from "@/components/throwback-section";
import AlertsCta from "@/components/alerts-cta";
import DailyPoll from "@/components/daily-poll";
import ImageAccordion, { type AccordionSlide } from "@/components/image-accordion";
import {
  CurrencyExchangeCard,
  FuelPricesCard,
  WeatherCard,
} from "@/components/home-market-cards";
import {
  getDailyExchangeSnapshot,
  getDailyFuelSnapshot,
} from "@/lib/home-market-data";
import { CATEGORY_COLORS, getCategoryColor } from "@/lib/category-colors";
import { CATEGORY_TO_SLUG, type NavCategory } from "@/lib/category-map";
import { getCityWeather } from "@/lib/weather";
import { getToneHistory, getToneArticleCache, summarizeToneHistory, getForeignCoverage, getTopics, getToneTopics } from "@/lib/tone-data";
import { dateKeyInKosovo, resolveView } from "@/lib/reagimi-data";
import { getSondazhiData } from "@/lib/sondazhi-server";
import { pickFrontPage } from "@/lib/front-page.mjs";
import { buildHomeSections, claim, createLedger } from "@/lib/home-sections.mjs";
import CategoryBlock from "@/components/home/category-block";
import SectionJump from "@/components/home/section-jump";
import TreguHome from "@/components/home/tregu-home";
import AdSlot from "@/components/home/ad-slot";

// Ten minutes, not an hour: the pipeline publishes nine times a day and the
// news sections below the front block now run as deep as the day does.
export const revalidate = 600;

function titleKws(text: string) {
  return new Set(text.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
}

export default async function HomePage() {
  // tone-outlets.json (today's per-country snapshot, used only by
  // ToneDashboard's client-side hover drill-down via its own fetch()) isn't
  // read here — Bota Flet now sources from the article cache below instead.
  const [articles, tickerArticles, recentArticles, exchangeSnapshot, fuelSnapshot, toneHistory, toneCache, pipelineTopics, cityWeather] = await Promise.all([
    getArticles(60),
    getLatestArticles(10),
    // The day's run for the sections below the front block: newest first, no
    // bodies. The front block keeps reading the sixty above, unchanged.
    getArticlesBefore({ limit: 120 }),
    getDailyExchangeSnapshot(),
    getDailyFuelSnapshot(),
    getToneHistory(),
    getToneArticleCache(),
    getToneTopics(),
    // Keyless and individually caught: a weather outage costs the rail one
    // card, never the page.
    getCityWeather().catch(() => []),
  ]);

  const toneSummary = summarizeToneHistory(toneHistory);
  // Bota Flet reads the cache (72h rolling pool, refreshed 9x/day), not
  // today's outlets snapshot — see getForeignCoverage()'s doc comment.
  const foreignCoverage = getForeignCoverage(toneCache, 6);
  // What the world wrote about, not only how it sounded. Pure function over
  // the cache that is already in memory — no extra read, no API call. Five
  // chips is what fits one or two rows on a phone without pushing the module
  // past its height budget.
  // The pipeline's labelled topics when they exist, the runtime clustering
  // when they don't (fresh checkout, failed run). Five is what fits the
  // module's height budget on a phone.
  const toneTopics = (pipelineTopics ?? getTopics(toneCache, { limit: 5 })).slice(0, 5);
  const botaFletPool = Object.values(toneCache?.articles ?? {}).filter(
    (a) => a.imageUrl && a.translated
  );
  const botaFletCountries = new Set(botaFletPool.map((a) => a.country)).size;

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
  const kryesore = pickFrontPage([...articles, ...tickerArticles], 7);
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

  // Category blocks claim first. The pipeline publishes a handful of Sport,
  // Ekonomi, Teknologji or Showbiz stories a day, and anything claimed earlier
  // by a general list would leave those sections too thin to show. Each block
  // takes its best-ranked; one with fewer than three is left out, not shown
  // half-empty.
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

  // The poll's question and yesterday's outcome are both settled at request
  // time, so they are rendered on the server rather than fetched after
  // hydration — the card used to show an empty loading box for the several
  // seconds this page takes to hydrate. Only the live tally is left to the
  // client. Shares reagimiDateKey so the two adjacent cards cannot disagree
  // about what day it is.
  const sondazhi = await getSondazhiData(reagimiDateKey);

  // NJOFTIME carries at least 12 headlines. It is a horizontally dragged rail, so
  // the extra cards cost scroll distance inside the rail rather than page height.
  const NJOFTIME_TARGET = 12;

  // Tier 2: NJOFTIME — score ≥ 7.0, not in kryesore, deduped by keyword overlap
  const njoftimePool = articles.filter(
    (a) => !ledger.ids.has(a.id) && (a.engagementScore ?? 0) >= 7.0
  );
  const njoftimeArticles: typeof articles = [];
  const njoftimeKws: Set<string>[] = [];
  for (const a of njoftimePool) {
    const kws = titleKws(a.title);
    if (njoftimeKws.some((rk) => [...kws].filter((w) => rk.has(w)).length >= 3)) continue;
    njoftimeArticles.push(a);
    njoftimeKws.push(kws);
    if (njoftimeArticles.length >= NJOFTIME_TARGET) break;
  }

  // Top up if the score-gated pool could not reach the target. Keyword dedupe
  // still applies, so this widens the score floor rather than repeating a story.
  if (njoftimeArticles.length < NJOFTIME_TARGET) {
    const already = new Set(njoftimeArticles.map((a) => a.id));
    for (const a of articles) {
      if (already.has(a.id) || ledger.ids.has(a.id)) continue;
      const kws = titleKws(a.title);
      if (njoftimeKws.some((rk) => [...kws].filter((w) => rk.has(w)).length >= 3)) continue;
      njoftimeArticles.push(a);
      njoftimeKws.push(kws);
      already.add(a.id);
      if (njoftimeArticles.length >= NJOFTIME_TARGET) break;
    }
  }

  // Më të lexuarat — engagement ranking across everything outside the kryesore
  // top; may overlap NJOFTIME (a most-read rail legitimately repeats stories)
  const mostRead = articles
    .filter((a) => !kryesoreTopIds.has(a.id))
    .sort((a, b) => (b.engagementScore ?? 0) - (a.engagementScore ?? 0))
    .slice(0, 5);

  // NJOFTIME is claimed before the sections below so they cannot repeat it.
  // The claim also drops a second write-up of a story the front block leads
  // with, so the rail renders what it claimed.
  const njoftimeShown = claim(ledger, njoftimeArticles, njoftimeArticles.length);

  // Image accordion — top article per category, fallback to best unused
  const accordionCats = [
    { category: "Kosovë",    label: "Kosovë"    },
    { category: "Shqipëri",  label: "Shqipëri"  },
    { category: "Botë",      label: "Botë"      },
    { category: "Sport",     label: "Sport"     },
    { category: "Showbiz",   label: "Showbiz"   },
  ];
  // Five, as the heading promises: "5 tema, 5 lajme" carried six cards.
  // The old fallback took an article from any category but kept the category we
  // had *asked* for as the card's label and colour, so a quiet Teknologji day
  // put a purple TEKNOLOGJI badge on a Sport story. A card now always names the
  // category its article actually has; when a topic has nothing, the slot is
  // filled from a topic not already on the row rather than mislabelled.
  const usedAccordionCats = new Set<string>();
  const accordionSlides: AccordionSlide[] = [];

  for (const { category } of accordionCats) {
    const [exact] = claim(ledger, belowPool, 1, { predicate: (a) => a.category === category });
    const article =
      exact ??
      claim(ledger, belowPool, 1, {
        predicate: (a) =>
          !usedAccordionCats.has(a.category) &&
          // Some stored rows carry a mangled category ("Bot?"), which would
          // otherwise surface verbatim as a card label.
          a.category in CATEGORY_COLORS,
      })[0] ??
      // A thin day can leave no fresh topic at all once the category sections
      // have claimed theirs; the row still shows five stories, from a topic
      // already on it, rather than four.
      claim(ledger, belowPool, 1, { predicate: (a) => a.category in CATEGORY_COLORS })[0];
    if (!article) continue;

    usedAccordionCats.add(article.category);
    accordionSlides.push({
      article,
      category: article.category,
      label: article.category,
    });
  }

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
      </div>

      {/* Kryesore now opens the editorial page instead of arriving after utility modules. */}
      {/* Three columns. The two outer ones are reference — money, weather,
          fuel, the day's ranking — and share one warm-paper material so they
          read as a pair of rails. News, and every photograph, lives only in the
          middle. The grid-area names are historical: each side column now
          carries two cards, not the single one it was named for. */}
      {kryesoreLead && (
        <div className="home-front-layout">
          <div className="home-front-currency">
            <CurrencyExchangeCard snapshot={exchangeSnapshot} />
            <WeatherCard cities={cityWeather} />
          </div>
          <div className="home-front-editorial">
            <KryesoreFront
              lead={kryesoreLead}
              stack={kryesoreStack}
              secondary={kryesoreSecondary}
            />
          </div>
          <div className="home-front-fuel">
            <FuelPricesCard snapshot={fuelSnapshot} />
            <MostReadRail articles={mostRead} />
          </div>
        </div>
      )}

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

        {/* 5 tema, 5 lajme — one story per topic */}
        <div style={{ marginBottom: "var(--space-section)" }}>
          <ImageAccordion slides={accordionSlides} />
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

        {/* The page's two "what do you think" pieces, together. */}
        <ReagimiDites fallbackView={reagimiFallback} serverDateKey={reagimiDateKey} />
        <DailyPoll data={sondazhi} />
      </Contained>

      {/* Kosovë and Shqipëri on the page's own paper: a lead, its rail, and a
          row of four more. */}
      {block("Kosovë").length > 0 && (
        <div id="seksioni-kosove" className="home-anchor">
          <ColorSpotlight articles={block("Kosovë")} category="Kosovë" label="KOSOVË" plain more={4} />
        </div>
      )}
      {block("Shqipëri").length > 0 && (
        <div id="seksioni-shqiperi" className="home-anchor">
          <ColorSpotlight articles={block("Shqipëri")} category="Shqipëri" label="SHQIPËRI" plain more={4} />
        </div>
      )}

      <Contained>
        <CategoryBlock category="Botë" articles={block("Botë")} layout="bento" />
        <CategoryBlock category="Ekonomi" articles={block("Ekonomi")} layout="overlay" />
      </Contained>

      {/* Si flet bota për Kosovën: the foreign coverage and its tone read as one
          topic, so they sit together. Bota Flet is full-bleed. */}
      <BotaFlet
        items={foreignCoverage}
        totalArticles={botaFletPool.length}
        countryCount={botaFletCountries}
      />

      <Contained first>
        <ToneDashboard summary={toneSummary} topics={toneTopics} />

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
