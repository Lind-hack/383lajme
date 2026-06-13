import { BREAKING_ITEMS } from "@/lib/mock-data";
import { getArticles } from "@/lib/db";
import { MoveHorizontal } from "lucide-react";
import TextureBg from "@/components/aurora-bg";
import SectionLabel from "@/components/section-label";
import Navbar from "@/components/navbar";
import BreakingTicker from "@/components/breaking-ticker";
import HeroDispatch from "@/components/hero-dispatch";
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
import RobotHero from "@/components/robot-hero";

export const revalidate = 3600;

function titleKws(text: string) {
  return new Set(text.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
}

/** Convert an emoji flag (regional indicator pair) to a two-letter country code. */
function flagToCode(flag: string): string {
  const letters = Array.from(flag)
    .map((c) => c.codePointAt(0) ?? 0)
    .filter((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff)
    .map((cp) => String.fromCharCode(cp - 0x1f1e6 + 65));
  return letters.length === 2 ? letters.join("") : "";
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

      {/* Robot hero — article left, 3D robot right */}
      <RobotHero article={hero} />

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
        {/* "383" large watermark behind hero */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "-20px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "clamp(120px, 16vw, 220px)",
            fontWeight: 800,
            color: "transparent",
            WebkitTextStroke: "1px rgba(17,17,17,0.05)",
            letterSpacing: "-0.08em",
            lineHeight: 1,
            pointerEvents: "none",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          383
        </div>

        {/* Hero dispatch */}
        <div style={{ marginBottom: "var(--space-section)", position: "relative" }}>
          <HeroDispatch article={hero} />
        </div>

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

      {/* Charcoal world news section */}
      <section
        style={{
          background: "#1A1A1A",
          padding: "64px 24px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <SectionLabel label="BOTA FLET" accent="#F59E0B" dark marginBottom={36} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "20px",
            }}
          >
            {articles.slice(2, 5).map((article) => {
              const catColor = "#F59E0B";
              return (
                <a
                  key={article.id}
                  href={`/article/${article.slug}`}
                  style={{ textDecoration: "none", display: "block", height: "100%" }}
                >
                  <div
                    className="world-card"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "var(--radius-md)",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      height: "100%",
                    }}
                  >
                    <div style={{ height: "3px", background: catColor, flexShrink: 0 }} />
                    <div style={{ padding: "24px", flex: 1, display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
                        {flagToCode(article.sourceFlag) && (
                          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}>
                            {flagToCode(article.sourceFlag)}
                          </span>
                        )}
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em" }}>
                          {article.source}
                        </span>
                      </div>
                      <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#FFFFFF", margin: "0 0 10px", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {article.title}
                      </h3>
                      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {article.excerpt}
                      </p>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

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
