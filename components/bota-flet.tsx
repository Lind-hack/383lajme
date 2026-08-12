// BOTA FLET — foreign-media coverage of Kosovo, pulled from the tone-scraper
// pipeline (tools/tone_scraper.py) that also feeds "Toni i Mediave" below.
// Headlines are translated to Albanian and every card carries a real image
// (scraped from the source publisher, never AI-generated) — see
// lib/tone-data.ts:getForeignCoverage() for the selection/filtering rules.

import SectionLabel from "./section-label";
import { HeroCard } from "./bota-flet-card";
import BotaFletStrip from "./bota-flet-strip";
import type { ForeignCoverageItem } from "@/lib/tone-data";

const LEGEND: Array<{ color: string; label: string }> = [
  { color: "#16A34A", label: "Pozitiv" },
  { color: "#9CA3AF", label: "Neutral" },
  { color: "#E41E20", label: "Kritik" },
];

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

  const [hero, ...rest] = items;

  return (
    <section style={{ padding: "64px 24px", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        {/* Border is pure CSS (solid line + an animated highlight sweep) —
            see .bota-flet-supercard in globals.css. Everything, including
            the hero, sits inside the same .bota-flet-padded inset now. */}
        <div className="bota-flet-supercard">
          <div className="bota-flet-padded">
            <SectionLabel
              label={<span className="glossy-orange">BOTA FLET</span>}
              accent="#F59E0B"
              marginBottom={16}
              right={
                <a
                  href="/toni"
                  style={{
                    fontSize: "14px",
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

            {/* Hook asks the question a first-time visitor actually has
                ("what does the world say about Kosovo?"); the body answers
                it in one breath — source, translation, and the color code —
                instead of describing the pipeline mechanically. Legend
                stays as scannable chips right under it so "jeshile/kuq/gri"
                is never just a claim, it's pointing at the actual colors. */}
            <p style={{ margin: "0 0 10px", fontSize: "24px", fontWeight: 800, color: "#111111", lineHeight: 1.3 }}>
              Si flet bota për Kosovën.
            </p>
            <p style={{ margin: "0 0 20px", maxWidth: "62ch", fontSize: "17px", color: "rgba(17,17,17,0.62)", lineHeight: 1.6 }}>
              Përditë mbledhim artikuj nga gazetat më të mëdha të botës — gjermane, amerikane,
              britanike, franceze e italiane — që shkruajnë për Kosovën. I përkthejmë në shqip
              dhe i ngjyrosim sipas tonit: jeshile kur janë pozitivë, kuq kur janë kritikë,
              gri kur janë thjesht neutralë.
            </p>

            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
              <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
                {LEGEND.map((item) => (
                  <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "13px", fontWeight: 700, color: "#4A463F" }}>
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                    {item.label}
                  </span>
                ))}
              </div>
              <span style={{ fontSize: "13px", color: "rgba(17,17,17,0.4)" }}>
                {totalArticles} artikuj · {countryCount} vende · gjatë gjithë ditës
              </span>
            </div>

            <HeroCard item={hero} />
          </div>

          {rest.length > 0 && (
            <div className="bota-flet-padded" style={{ marginTop: "16px" }}>
              <BotaFletStrip items={rest} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
