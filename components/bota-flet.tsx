// BOTA FLET — foreign-media coverage of Kosovo, pulled from the tone-scraper
// pipeline (tools/tone_scraper.py) that also feeds "Toni i Mediave" below.
// Headlines are translated to Albanian and every card carries a real image
// (scraped from the source publisher, never AI-generated) — see
// lib/tone-data.ts:getForeignCoverage() for the selection/filtering rules.

import SectionLabel from "./section-label";
import CoverageCard from "./bota-flet-card";
import type { ForeignCoverageItem } from "@/lib/tone-data";

export default function BotaFlet({
  items,
  totalArticles,
  countryCount,
}: {
  items: ForeignCoverageItem[];
  totalArticles: number;
  countryCount: number;
}) {
  if (items.length === 0) return null;

  const [lead, ...rest] = items;

  return (
    <section style={{ padding: "64px 24px", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div className="bota-flet-supercard">
          <SectionLabel
            label={<span className="glossy-orange">BOTA FLET</span>}
            accent="#F59E0B"
            marginBottom={10}
            right={
              <a
                href="/toni"
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#6B6B6B",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Shiko analizën e plotë →
              </a>
            }
          />

          {/* Explains what the section actually is, in plain language, for
              a first-time visitor — the old copy was just a stat line. */}
          <p style={{ margin: "0 0 6px", maxWidth: "68ch", fontSize: "14px", color: "rgba(17,17,17,0.72)", lineHeight: 1.6 }}>
            <strong style={{ color: "#111111" }}>Bota Flet</strong> përmbledh si e shohin Kosovën mediat e
            huaja — gjermane, amerikane, britanike, franceze dhe italiane. Çdo artikull përkthehet në
            shqip dhe ngjyroset sipas tonit: <strong style={{ color: "#16A34A" }}>jeshile</strong> kur
            media shkruan pozitivisht, <strong style={{ color: "#E41E20" }}>kuq</strong> kur është
            kritike, <strong style={{ color: "#6B6B6B" }}>gri</strong> kur është thjesht raportim neutral.
          </p>
          <p style={{ margin: "0 0 28px", fontSize: "13px", color: "rgba(17,17,17,0.45)" }}>
            {totalArticles} artikuj nga {countryCount} vende, të përditësuar gjatë gjithë ditës.
          </p>

          <div className="bota-flet-grid">
            <CoverageCard item={lead} size="lead" />
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {rest.slice(0, 4).map((item) => (
                <CoverageCard key={item.url} item={item} size="row" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
