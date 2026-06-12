import { BREAKING_ITEMS } from "@/lib/mock-data";
import { getArticles } from "@/lib/db";
import { MoveHorizontal } from "lucide-react";
import TextureBg from "@/components/aurora-bg";
import SectionLabel from "@/components/section-label";
import Navbar from "@/components/navbar";
import BreakingTicker from "@/components/breaking-ticker";
import HeroScrollArticle from "@/components/hero-scroll-article";
import DispatchRow from "@/components/dispatch-row";
import NewsGrid from "@/components/news-grid";
import DispatchList from "@/components/dispatch-list";
import ColorSpotlight from "@/components/color-spotlight";
import GradientCta from "@/components/gradient-cta";
import Footer from "@/components/footer";
import ReagimiDites from "@/components/reagimi-dites";
import ToneDashboard from "@/components/tone-dashboard";
import DiasporaSeries from "@/components/diaspora-series";
import ThrowbackSection from "@/components/throwback-section";
import AlertsCta from "@/components/alerts-cta";
import DailyPoll from "@/components/daily-poll";
import BotaFlet from "@/components/bota-flet";

export const revalidate = 3600;

function titleKws(text: string) {
  return new Set(text.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
}


export default async function HomePage() {
  const articles = getArticles(60);

  // Tier 1: hero — featured (score ≥ 9 or breaking), fallback to highest scored
  const hero = articles.find((a) => a.featured) ?? articles[0];
  const heroId = hero?.id;

  // Reagimi i Ditës — highest-scored non-hero article (≥ 8), fallback to second article
  const reagimiArticle =
    articles.find((a) => a.id !== heroId && (a.engagementScore ?? 0) >= 8) ??
    articles.find((a) => a.id !== heroId) ??
    hero;

  // Tier 2: NJOFTIME — score ≥ 7.0, not hero, up to 10, deduped by keyword overlap
  const njoftimePool = articles.filter((a) => a.id !== heroId && (a.engagementScore ?? 0) >= 7.0);
  const njoftimeArticles: typeof articles = [];
  const njoftimeKws: Set<string>[] = [];
  for (const a of njoftimePool) {
    const kws = titleKws(a.title);
    if (njoftimeKws.some((rk) => [...kws].filter((w) => rk.has(w)).length >= 3)) continue;
    njoftimeArticles.push(a);
    njoftimeKws.push(kws);
    if (njoftimeArticles.length >= 10) break;
  }

  // Tier 3: KRYESORE — remaining after hero + njoftime, first 6
  const njoftimeIds = new Set(njoftimeArticles.map((a) => a.id));
  const afterHero = articles.filter((a) => a.id !== heroId && !njoftimeIds.has(a.id));
  const kryesoreArticles = afterHero.slice(0, 6);

  // Tier 4: LAJMET E FUNDIT — everything remaining, capped at 20
  const kryesoreIds = new Set(kryesoreArticles.map((a) => a.id));
  const listArticles = afterHero.filter((a) => !kryesoreIds.has(a.id)).slice(0, 20);

  const politikeArticles = articles.filter((a) => a.category === "Politikë");

  return (
    <>
      <TextureBg />

      {/* Fixed nav */}
      <Navbar />

      {/* Breaking ticker — sits just under nav */}
      <div style={{ position: "relative", zIndex: 10, paddingTop: "var(--nav-h)" }}>
        <BreakingTicker />
      </div>

      {/* Full-viewport scroll hero — outside constrained main */}
      <HeroScrollArticle article={hero} />

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
        <ReagimiDites article={reagimiArticle} />

        {/* Section label: NJOFTIME */}
        <SectionLabel
          label="NJOFTIME"
          right={
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#6B6B6B", fontWeight: 500 }}>
              tërhiq <MoveHorizontal size={14} strokeWidth={2} />
            </span>
          }
        />

        {/* Horizontal scroll row */}
        <div style={{ marginBottom: "var(--space-section)" }}>
          <DispatchRow articles={njoftimeArticles} />
        </div>

        {/* Daily poll */}
        <DailyPoll />

        {/* News grid */}
        <div style={{ marginBottom: "var(--space-section)" }}>
          <NewsGrid articles={kryesoreArticles} title="KRYESORE" />
        </div>

        {/* Dispatch list */}
        <div style={{ marginBottom: "0", paddingBottom: "var(--space-section)" }}>
          <DispatchList articles={listArticles} />
        </div>
      </main>

      <BotaFlet articles={articles.slice(2, 5)} />

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
        <ToneDashboard />
        <DiasporaSeries />
      </div>

      {/* Blue Politikë spotlight */}
      {politikeArticles.length > 0 && (
        <ColorSpotlight
          articles={politikeArticles}
          category="Politikë"
          label="POLITIKË"
        />
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
