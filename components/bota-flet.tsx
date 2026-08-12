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

            {/* Hook first, mechanism second, legend as scannable chips —
                the old version buried "jeshile/kuq/gri" inside a run-on
                sentence, which reads as prose nobody actually parses. */}
            <p style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 800, color: "#111111", lineHeight: 1.32 }}>
              Kosova, siç e sheh bota.
            </p>
            <p style={{ margin: "0 0 18px", maxWidth: "62ch", fontSize: "15.5px", color: "rgba(17,17,17,0.62)", lineHeight: 1.55 }}>
              Çdo ditë mbledhim si shkruajnë për Kosovën mediat gjermane, amerikane, britanike,
              franceze dhe italiane, dhe i përkthejmë në shqip sapo botohen.
            </p>

            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {LEGEND.map((item) => (
                  <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: 700, color: "#4A463F" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                    {item.label}
                  </span>
                ))}
              </div>
              <span style={{ fontSize: "11.5px", color: "rgba(17,17,17,0.4)" }}>
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
