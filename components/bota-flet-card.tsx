"use client";

// Client component (needs useState for the image onError fallback) — split
// out of bota-flet.tsx so the section itself can stay server-rendered.
// Every item in the pool is guaranteed to have imageUrl (see
// lib/tone-data.ts:getForeignCoverage), but the URL is a live third-party
// image that can still 404/rot/hotlink-block after the fact — the gradient
// fallback below is a real, reachable path, not just defensive theater.

import { useState, type CSSProperties } from "react";
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

function useImage() {
  const [failed, setFailed] = useState(false);
  return { showImage: !failed, onError: () => setFailed(true) };
}

/** Full-bleed text-over-image hero — the section's one dramatic moment. */
export function HeroCard({ item }: { item: ForeignCoverageItem }) {
  const { showImage, onError } = useImage();
  const color = SENTIMENT_COLOR[item.sentiment];

  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="bota-flet-hero" style={{ textDecoration: "none" }}>
      {showImage ? (
        <img src={item.imageUrl} alt="" onError={onError} />
      ) : (
        <div aria-hidden style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${color}CC 0%, ${color}33 100%)` }} />
      )}

      {/* Scrim — text needs to stay legible over an arbitrary photo, not
          just a dark one, so this is a fixed gradient, not theme-dependent. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, rgba(10,8,6,0.88) 0%, rgba(10,8,6,0.45) 42%, transparent 72%)",
        }}
      />

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "clamp(16px, 3vw, 26px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          {item.flag && <span style={{ fontSize: "17px" }}>{item.flag}</span>}
          <span style={{ fontSize: "13px", fontWeight: 800, color: "rgba(255,255,255,0.92)", letterSpacing: "0.02em" }}>
            {item.outlet}
          </span>
          <span
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "3px 10px",
              borderRadius: "100px",
              background: color,
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#FFFFFF",
            }}
          >
            {SENTIMENT_LABEL[item.sentiment]}
          </span>
        </div>

        <h3
          style={{
            fontSize: "clamp(21px, 3vw, 30px)",
            fontWeight: 800,
            color: "#FFFFFF",
            margin: "0 0 6px",
            lineHeight: 1.28,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.title}
        </h3>

        <span style={{ fontSize: "11.5px", fontWeight: 600, color: "rgba(255,255,255,0.62)" }}>
          {item.date || item.country}
        </span>
      </div>
    </a>
  );
}

/** Compact card for the horizontal scroll strip. Hover state mirrors the
 * reference: the sentiment badge fills out with its label, the headline
 * recolors to the sentiment accent, and the trailing date crossfades into
 * a "Lexo →" prompt — see the .bota-flet-strip-* rules in globals.css. */
export function StripCard({ item }: { item: ForeignCoverageItem }) {
  const { showImage, onError } = useImage();
  const color = SENTIMENT_COLOR[item.sentiment];

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="world-card bota-flet-strip-card"
      style={{
        textDecoration: "none",
        display: "flex",
        flexDirection: "column",
        background: "#FFFFFF",
        border: "1px solid #EFE9DF",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(17,17,17,0.05)",
        "--bf-accent": color,
      } as CSSProperties}
    >
      {showImage ? (
        <img src={item.imageUrl} alt="" onError={onError} style={{ width: "100%", height: "132px", objectFit: "cover", display: "block" }} />
      ) : (
        <div aria-hidden style={{ width: "100%", height: "132px", background: `linear-gradient(135deg, ${color}CC 0%, ${color}33 100%)` }} />
      )}

      <div style={{ padding: "13px 14px 14px", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "7px" }}>
          {item.flag && <span style={{ fontSize: "12px" }}>{item.flag}</span>}
          <span
            style={{
              fontSize: "10.5px",
              fontWeight: 800,
              color: "#6B6B6B",
              letterSpacing: "0.02em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.outlet}
          </span>
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
            <span className="bota-flet-strip-badge-dot" style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span className="bota-flet-strip-badge-label" style={{ fontSize: "9px", fontWeight: 800, color, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {SENTIMENT_LABEL[item.sentiment]}
            </span>
          </span>
        </div>

        <h3 className="bota-flet-strip-title" style={{ fontSize: "13.5px", fontWeight: 700, margin: "0 0 6px", lineHeight: 1.32, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {item.title}
        </h3>

        <div className="bota-flet-strip-meta">
          <span className="bota-flet-strip-date" style={{ fontSize: "10.5px", fontWeight: 600, color: "#B4B0A6" }}>
            {item.date || item.country}
          </span>
          <span className="bota-flet-strip-cta" style={{ fontSize: "10.5px", fontWeight: 700 }}>
            Lexo →
          </span>
        </div>
      </div>
    </a>
  );
}
