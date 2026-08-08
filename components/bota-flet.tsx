// BOTA FLET — foreign-media coverage of Kosovo, pulled from the same
// tone-scraper pipeline that feeds "Toni i Mediave" below. This used to be
// three random articles.slice(2, 5) from the site's own general pool (not
// foreign coverage at all); now it's the actual foreign-desk feed, and the
// sentiment color on each card is the same one the chart uses — the two
// sections read as one system instead of two unrelated blocks.

import SectionLabel from "./section-label";
import type { ForeignCoverageItem } from "@/lib/tone-data";

const SENTIMENT_COLOR: Record<ForeignCoverageItem["sentiment"], string> = {
  positive: "#3ED484",
  neutral: "#8A8578",
  negative: "#FF5B4A",
};

const SENTIMENT_LABEL: Record<ForeignCoverageItem["sentiment"], string> = {
  positive: "Pozitiv",
  neutral: "Neutral",
  negative: "Kritik",
};

function CoverageCard({
  item,
  size,
}: {
  item: ForeignCoverageItem;
  size: "lead" | "row";
}) {
  const color = SENTIMENT_COLOR[item.sentiment];
  const isLead = size === "lead";

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="world-card"
      style={{
        textDecoration: "none",
        display: "flex",
        gap: isLead ? 0 : "16px",
        flexDirection: isLead ? "column" : "row",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        // Row cards size to their own content — height:"100%" here (combined
        // with overflow:hidden, needed for the rounded-corner stripe on both
        // sizes) could resolve shorter than a 2-line headline needs inside
        // the stacked list's flex column, silently clipping the second line.
        height: isLead ? "100%" : "auto",
      }}
    >
      <div
        style={{
          width: isLead ? "100%" : "3px",
          height: isLead ? "3px" : "auto",
          background: color,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          padding: isLead ? "28px 28px 26px" : "16px 18px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          position: "relative",
          // Only the lead card has the watermark this clips — on row cards
          // it was cutting the second line of -webkit-line-clamp headlines
          // before the clamp could render it (regression from adding the
          // watermark to the shared content wrapper below).
          overflow: isLead ? "hidden" : "visible",
        }}
      >
        {/* Decorative watermark — fills the lead card's extra height (it's
            grid-stretched to match the stacked list) without inventing copy;
            it's the outlet's own real name, just restated at display scale —
            the same device big editorial sites use on a sparse hero card. */}
        {isLead && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: "-4px",
              right: "-4px",
              bottom: "14px",
              fontSize: "clamp(30px, 6vw, 46px)",
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "-0.01em",
              color: "rgba(255,255,255,0.05)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "clip",
              pointerEvents: "none",
            }}
          >
            {item.outlet}
          </span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: isLead ? "16px" : "8px", flexWrap: "wrap", position: "relative" }}>
          {item.flag && <span style={{ fontSize: isLead ? "18px" : "14px" }}>{item.flag}</span>}
          <span
            style={{
              fontSize: isLead ? "13px" : "12px",
              fontWeight: 800,
              color: "rgba(255,255,255,0.78)",
              letterSpacing: "0.02em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: isLead ? "none" : "120px",
            }}
          >
            {item.outlet}
          </span>
          <span
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color,
              flexShrink: 0,
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color }} />
            {SENTIMENT_LABEL[item.sentiment]}
          </span>
        </div>

        <h3
          style={{
            fontSize: isLead ? "clamp(20px, 2.6vw, 27px)" : "15px",
            fontWeight: 700,
            color: "#FFFFFF",
            margin: "0 0 8px",
            lineHeight: 1.32,
            display: "-webkit-box",
            WebkitLineClamp: isLead ? 3 : 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.title}
        </h3>

        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: "8px", paddingTop: isLead ? "10px" : "4px" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>
            {item.date || item.country}
          </span>
        </div>
      </div>
    </a>
  );
}

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
    <section
      style={{
        background: "#1A1A1A",
        padding: "64px 24px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <SectionLabel
          label="BOTA FLET"
          accent="#F59E0B"
          dark
          marginBottom={12}
          right={
            <a
              href="/toni"
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "rgba(255,255,255,0.55)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Shiko analizën e plotë →
            </a>
          }
        />
        <p style={{ margin: "0 0 32px", maxWidth: "60ch", fontSize: "13.5px", color: "rgba(255,255,255,0.5)" }}>
          {totalArticles} artikuj për Kosovën, mbledhur sot nga media në {countryCount} vende.
          Titujt në gjuhën origjinale — ngjyra tregon tonin, njësoj si te grafiku më poshtë.
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
    </section>
  );
}
