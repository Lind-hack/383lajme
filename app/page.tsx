import { getArticles, getLatestArticles } from "@/lib/db";
import { MoveHorizontal } from "lucide-react";
import TextureBg from "@/components/aurora-bg";
import SectionLabel from "@/components/section-label";
import Navbar from "@/components/navbar";
import BreakingTicker from "@/components/breaking-ticker";
import DispatchRow from "@/components/dispatch-row";
import KryesoreFront from "@/components/kryesore-front";
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
import TrendingStrip from "@/components/tregu/trending-strip";
import {
  CurrencyExchangeCard,
  FuelPricesCard,
} from "@/components/home-market-cards";
import {
  getDailyExchangeSnapshot,
  getDailyFuelSnapshot,
} from "@/lib/home-market-data";
import { CATEGORY_COLORS } from "@/lib/category-colors";
import { getToneHistory, getToneArticleCache, summarizeToneHistory, getForeignCoverage, getTopics, getToneTopics } from "@/lib/tone-data";
import { dateKeyInKosovo, resolveView } from "@/lib/reagimi-data";
import { getSondazhiData } from "@/lib/sondazhi-server";

export const revalidate = 3600;

function titleKws(text: string) {
  return new Set(text.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
}

export default async function HomePage() {
  // tone-outlets.json (today's per-country snapshot, used only by
  // ToneDashboard's client-side hover drill-down via its own fetch()) isn't
  // read here — Bota Flet now sources from the article cache below instead.
  const [articles, tickerArticles, exchangeSnapshot, fuelSnapshot, toneHistory, toneCache, pipelineTopics] = await Promise.all([
    getArticles(60),
    getLatestArticles(10),
    getDailyExchangeSnapshot(),
    getDailyFuelSnapshot(),
    getToneHistory(),
    getToneArticleCache(),
    getToneTopics(),
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

  // Tier 1: hero — featured (score ≥ 9 or breaking), fallback to highest scored
  const hero = articles.find((a) => a.featured) ?? articles[0];
  const heroId = hero?.id;

  // Reagimi i Ditës — the auto fallback is restricted to articles published TODAY.
  // The previous rule ("highest-scored non-hero article") had no date constraint, so
  // a quiet news week left a days-old article under a heading that promises daily.
  // A curated row wins when one exists; it loads client-side, where the clock is
  // authoritative (this page is statically revalidated hourly).
  const reagimiDateKey = dateKeyInKosovo();
  const reagimiFallback = resolveView(null, articles, reagimiDateKey, heroId);

  // The poll's question and yesterday's outcome are both settled at request
  // time, so they are rendered on the server rather than fetched after
  // hydration — the card used to show an empty loading box for the several
  // seconds this page takes to hydrate. Only the live tally is left to the
  // client. Shares reagimiDateKey so the two adjacent cards cannot disagree
  // about what day it is.
  const sondazhi = await getSondazhiData(reagimiDateKey);

  // Tier 2: KRYESORE lead + secondary — claimed before NJOFTIME so the
  // front-page hierarchy always renders even when the article pool is small
  // (production automation often yields ~11 fresh articles).
  const nonHero = articles.filter((a) => a.id !== heroId);
  const kryesoreLead = nonHero[0];
  const kryesoreSecondary = nonHero.slice(1, 3);
  const kryesoreTopIds = new Set(
    [kryesoreLead, ...kryesoreSecondary].filter(Boolean).map((a) => a.id)
  );

  // NJOFTIME carries at least 12 headlines. It is a horizontally dragged rail, so
  // the extra cards cost scroll distance inside the rail rather than page height.
  const NJOFTIME_TARGET = 12;

  // Tier 3: NJOFTIME — score ≥ 7.0, not hero/kryesore-top, deduped by keyword overlap
  const njoftimePool = nonHero.filter(
    (a) => !kryesoreTopIds.has(a.id) && (a.engagementScore ?? 0) >= 7.0
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
    for (const a of nonHero) {
      if (already.has(a.id) || kryesoreTopIds.has(a.id)) continue;
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
  const mostRead = nonHero
    .filter((a) => !kryesoreTopIds.has(a.id))
    .sort((a, b) => (b.engagementScore ?? 0) - (a.engagementScore ?? 0))
    .slice(0, 5);

  // Tier 4: LAJMET E FUNDIT — everything not used above, capped at 20
  const usedIds = new Set(
    [...njoftimeArticles, ...mostRead].map((a) => a.id)
  );
  for (const id of kryesoreTopIds) usedIds.add(id);
  const listArticles = nonHero.filter((a) => !usedIds.has(a.id)).slice(0, 20);

  // Compared against the canonical label: sanitizeArticle has already folded
  // "Politikë", "Siguri" and "Shoqëri" onto Kosovë by the time an article gets
  // here, so filtering on the stored string would miss most of the section.
  const kosovaArticles = articles.filter((a) => a.category === "Kosovë");
  const shqiperiArticles = articles.filter((a) => a.category === "Shqipëri");

  // Image accordion — top article per category, fallback to best unused
  const accordionCats = [
    { category: "Kosovë",    label: "Kosovë"    },
    { category: "Shqipëri",  label: "Shqipëri"  },
    { category: "Showbiz",   label: "Showbiz"   },
    { category: "Botë",      label: "Botë"      },
    { category: "Teknologji",label: "Teknologji"},
    { category: "Sport",     label: "Sport"     },
  ];
  // The old fallback took an article from any category but kept the category we
  // had *asked* for as the card's label and colour, so a quiet Teknologji day
  // put a purple TEKNOLOGJI badge on a Sport story. A card now always names the
  // category its article actually has; when a topic has nothing, the slot is
  // filled from a topic not already on the row rather than mislabelled.
  const usedAccordionIds = new Set<string>();
  const usedAccordionCats = new Set<string>();
  const accordionSlides: AccordionSlide[] = [];

  for (const { category } of accordionCats) {
    const exact = articles.find(
      (a) => a.category === category && !usedAccordionIds.has(a.id)
    );
    const article =
      exact ??
      articles.find(
        (a) =>
          !usedAccordionIds.has(a.id) &&
          !usedAccordionCats.has(a.category) &&
          // Some stored rows carry a mangled category ("Bot?"), which would
          // otherwise surface verbatim as a card label.
          a.category in CATEGORY_COLORS
      );
    if (!article) continue;

    usedAccordionIds.add(article.id);
    usedAccordionCats.add(article.category);
    accordionSlides.push({
      article,
      category: article.category,
      label: article.category,
    });
  }

  return (
    <>
      <TextureBg />

      {/* Fixed nav */}
      <Navbar />

      {/* Breaking ticker — sits just under nav */}
      <div style={{ position: "relative", zIndex: 10, paddingTop: "var(--nav-h)" }}>
        <BreakingTicker articles={tickerArticles} />
      </div>

      {/* Kryesore now opens the editorial page instead of arriving after utility modules. */}
      {kryesoreLead && (
        <div className="home-front-layout">
          <div className="home-front-currency">
            <CurrencyExchangeCard snapshot={exchangeSnapshot} />
          </div>
          <div className="home-front-editorial">
            <KryesoreFront
              lead={kryesoreLead}
              secondary={kryesoreSecondary}
              mostRead={mostRead}
            />
          </div>
          <div className="home-front-fuel">
            <FuelPricesCard snapshot={fuelSnapshot} />
          </div>
        </div>
      )}

      {/* Main content — cream section */}
      <main
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "64px 24px 0",
        }}
      >
        {/* Daily video reaction */}
        <ReagimiDites fallbackView={reagimiFallback} serverDateKey={reagimiDateKey} />

        {/* News before diversions: NJOFTIME and the topic leaders now sit directly
            under the daily reaction, and the poll and prediction markets follow
            them rather than interrupting the news run. */}
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

        <DispatchRow articles={njoftimeArticles} />

        {/* Breather — the two news blocks used to land back to back, which read
            as one long undifferentiated scroll of headlines. */}
        <div className="section-breather" aria-hidden>
          <span />
          <em>Përzgjedhja e redaksisë</em>
          <span />
        </div>

        {/* 5 tema, 5 lajme — topic leaders close the news run, before the poll */}
        <div style={{ marginBottom: "var(--space-section)" }}>
          <ImageAccordion slides={accordionSlides} />
        </div>

        {/* Daily poll */}
        <DailyPoll data={sondazhi} />
      </main>

      {/* Bota Flet — foreign-media coverage of Kosovo, from the tone-scraper
          pipeline. Full-bleed, so it closes the container above; Tregu and the
          latest-news archive share the container that reopens below it. */}
      <BotaFlet
        items={foreignCoverage}
        totalArticles={botaFletPool.length}
        countryCount={botaFletCountries}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "64px 24px 0",
        }}
      >
        {/* 383 Tregu — trending prediction markets */}
        <TrendingStrip />

        {/* Lajmet e fundit — the archive tail closes the page's news run */}
        {listArticles.length > 0 && (
          <div
            id="lajmet-e-fundit"
            style={{ marginBottom: "0", paddingBottom: "var(--space-section)" }}
          >
            <DispatchList articles={listArticles} />
          </div>
        )}
      </div>

      {/* Tone dashboard + Diaspora series */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "64px 24px 0",
        }}
      >
        <ToneDashboard summary={toneSummary} topics={toneTopics} />
        <HomeVisitPreview />
      </div>

      {/* The blue spotlight, on the section that replaced Politikë. */}
      {kosovaArticles.length > 0 && (
        <ColorSpotlight articles={kosovaArticles} category="Kosovë" label="KOSOVË" />
      )}

      {/* Shqipëri gets the same treatment in red, directly under it, so the two
          place sections read as a pair rather than as one feature and one
          afterthought. */}
      {shqiperiArticles.length > 0 && (
        <ColorSpotlight articles={shqiperiArticles} category="Shqipëri" label="SHQIPËRI" />
      )}

      {/* Throwback + Alerts CTA */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "64px 24px 0",
        }}
      >
        <ThrowbackSection />
        <AlertsCta />
      </div>

      {/* Gradient CTA */}
      <GradientCta />

      <Footer />
    </>
  );
}
