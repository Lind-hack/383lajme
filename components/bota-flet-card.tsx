"use client";

// Client component (needs useState for the image onError fallback) — split
// out of bota-flet.tsx so the section itself can stay server-rendered.
// Every item in the pool is guaranteed to have imageUrl (see
// lib/tone-data.ts:getForeignCoverage), but the URL is a live third-party
// image that can still 404/rot/hotlink-block after the fact — the gradient
// fallback below is a real, reachable path, not just defensive theater.

import { useState } from "react";
import type { ForeignCoverageItem } from "@/lib/tone-data";

const SENTIMENT_COLOR: Record<ForeignCoverageItem["sentiment"], string> = {
  positive: "#16A34A",
  neutral: "#9CA3AF",
  negative: "#E41E20",
};

const SENTIMENT_LABEL: Record<ForeignCoverageItem["sentiment"], string> = {
  positive: "Pozitiv",
  neutral: "Neutral",
  negative: "Kritik",
};

export default function CoverageCard({
  item,
  size,
}: {
  item: ForeignCoverageItem;
  size: "lead" | "row";
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const color = SENTIMENT_COLOR[item.sentiment];
  const isLead = size === "lead";
  const showImage = !imgFailed;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="world-card"
      style={{
        textDecoration: "none",
        display: "flex",
        flexDirection: isLead ? "column" : "row",
        gap: isLead ? 0 : "14px",
        background: "#FFFFFF",
        border: "1px solid #EFE9DF",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        // Row cards size to their own content — see the same reasoning as
        // the pre-image version of this component: forcing height:100% here
        // (needed for the lead card's grid-stretch) could clip a 2-line
        // headline shorter than the tallest neighboring card.
        height: isLead ? "100%" : "auto",
        boxShadow: "0 1px 3px rgba(17,17,17,0.05)",
      }}
    >
      {showImage ? (
        <img
          src={item.imageUrl}
          alt=""
          onError={() => setImgFailed(true)}
          style={{
            width: isLead ? "100%" : "92px",
            height: isLead ? undefined : "92px",
            aspectRatio: isLead ? "16 / 9" : undefined,
            objectFit: "cover",
            flexShrink: 0,
            display: "block",
          }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            width: isLead ? "100%" : "92px",
            height: isLead ? undefined : "92px",
            aspectRatio: isLead ? "16 / 9" : undefined,
            flexShrink: 0,
            background: `linear-gradient(135deg, ${color}CC 0%, ${color}33 100%)`,
          }}
        />
      )}

      <div
        style={{
          padding: isLead ? "20px 24px 22px" : "10px 16px 10px 0",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: isLead ? "12px" : "6px", flexWrap: "wrap" }}>
          {item.flag && <span style={{ fontSize: isLead ? "18px" : "13px" }}>{item.flag}</span>}
          <span
            style={{
              fontSize: isLead ? "13px" : "11px",
              fontWeight: 800,
              color: "#6B6B6B",
              letterSpacing: "0.02em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: isLead ? "none" : "110px",
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

        {/* Lead headline gets the site's existing glossy-orange shine (the
            hero moment); row headlines stay a static solid color — five
            simultaneously-shimmering headlines would read as noise, not
            polish. .glossy-orange supplies its own text color via
            background-clip, so no `color` here when it's applied. */}
        <h3
          className={isLead ? "glossy-orange" : undefined}
          style={{
            fontSize: isLead ? "clamp(19px, 2.4vw, 25px)" : "14.5px",
            fontWeight: 800,
            color: isLead ? undefined : "#E41E20",
            margin: "0 0 6px",
            lineHeight: 1.32,
            display: "-webkit-box",
            WebkitLineClamp: isLead ? 3 : 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.title}
        </h3>

        <div style={{ marginTop: "auto", paddingTop: isLead ? "8px" : "2px" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "#B4B0A6" }}>
            {item.date || item.country}
          </span>
        </div>
      </div>
    </a>
  );
}
