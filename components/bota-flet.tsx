// BOTA FLET — foreign-media coverage of Kosovo, pulled from the tone-scraper
// pipeline (tools/tone_scraper.py) that also feeds "Toni i Mediave" below.
// Headlines are translated to Albanian and every card carries a real image
// (scraped from the source publisher, never AI-generated) — see
// lib/tone-data.ts:getForeignCoverage() for the selection/filtering rules.

import SectionLabel from "./section-label";
import { HeroCard, StripCard } from "./bota-flet-card";
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
        <div className="bota-flet-supercard">
          {/* Real marching-dash border — see app/globals.css for why this
              is an SVG rect and not a CSS pseudo-element. */}
          <svg className="bota-flet-border" style={{ overflow: "visible" }} aria-hidden focusable="false">
            <defs>
              <linearGradient id="bota-flet-border-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF4422" />
                <stop offset="100%" stopColor="#F43F5E" />
              </linearGradient>
            </defs>
            {/* overflow:visible on the svg lets the 3px stroke (centered on
                the path) bleed a hair past the exact 100% box instead of
                getting clipped at the edge — avoids relying on calc() inside
                an SVG geometry attribute, which has patchier support than
                CSS calc(). */}
            <rect x="0" y="0" width="100%" height="100%" rx="22" />
          </svg>

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

          {/* Hook first, mechanism second, legend as scannable chips — the
              old version buried "jeshile/kuq/gri" inside a run-on sentence,
              which reads as prose nobody actually parses. */}
          <p style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: 800, color: "#111111", lineHeight: 1.35 }}>
            Kosova, siç e sheh bota.
          </p>
          <p style={{ margin: "0 0 16px", maxWidth: "62ch", fontSize: "13.5px", color: "rgba(17,17,17,0.62)", lineHeight: 1.55 }}>
            Çdo ditë mbledhim si shkruajnë për Kosovën mediat gjermane, amerikane, britanike,
            franceze dhe italiane, dhe i përkthejmë në shqip sapo botohen.
          </p>

          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "28px" }}>
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

          {rest.length > 0 && (
            <div className="bota-flet-strip-wrap" style={{ marginTop: "16px" }}>
              <div className="bota-flet-strip">
                {rest.map((item) => (
                  <StripCard key={item.url} item={item} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
