"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { ResolvedFigure } from "@/lib/category-figures";
import { EASE, DUR } from "@/lib/tokens";

interface CategoryBannerProps {
  categoryName: string;
  from: string;
  to: string;
  articleCount: number;
  lightBg?: boolean;
  figures?: ResolvedFigure[];
}

function FigureCircle({ name, imageUrl }: ResolvedFigure) {
  const [err, setErr] = useState(false);
  return (
    <div
      style={{
        width: "76px",
        height: "76px",
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        border: "3px solid rgba(255,255,255,0.5)",
        position: "relative",
        background: "rgba(255,255,255,0.15)",
        boxShadow: "0 2px 14px rgba(0,0,0,0.3)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "26px",
          fontWeight: 800,
          color: "rgba(255,255,255,0.7)",
          userSelect: "none",
        }}
      >
        {name.charAt(0)}
      </div>
      {imageUrl && !err && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name}
          onError={() => setErr(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top center",
          }}
        />
      )}
    </div>
  );
}

export default function CategoryBanner({
  categoryName,
  from,
  to,
  articleCount,
  lightBg = false,
  figures,
}: CategoryBannerProps) {
  const textColor = lightBg ? "#111111" : "#FFFFFF";
  const subColor = lightBg ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.6)";
  const watermarkColor = lightBg ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.07)";
  const badgeBg = lightBg ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.15)";
  const badgeText = lightBg ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)";
  const hasFigures = figures && figures.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.reveal, ease: EASE }}
      style={{
        position: "relative",
        width: "100%",
        minHeight: hasFigures ? "380px" : "320px",
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
      }}
    >
      {/* Watermark — huge faint category name */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: "clamp(100px, 18vw, 240px)",
          fontWeight: 800,
          letterSpacing: "-0.06em",
          color: watermarkColor,
          lineHeight: 1,
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        {categoryName.toUpperCase()}
      </div>

      {/* Diagonal stripe overlay — subtle texture */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(255,255,255,0.02) 40px, rgba(255,255,255,0.02) 41px)",
          pointerEvents: "none",
        }}
      />

      {/* Center content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          padding: hasFigures ? "40px 24px 100px" : "40px 24px",
        }}
      >
        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: DUR.slow, ease: EASE }}
          style={{
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: subColor,
            margin: "0 0 16px",
          }}
        >
          383 LAJME
        </motion.p>

        {/* Category name */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: DUR.reveal, ease: EASE }}
          style={{
            fontSize: "clamp(48px, 8vw, 88px)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: textColor,
            margin: "0 0 24px",
            lineHeight: 1,
          }}
        >
          {categoryName.toUpperCase()}
        </motion.h1>

        {/* Article count badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.28, duration: DUR.base, ease: EASE }}
          style={{ display: "inline-flex", justifyContent: "center" }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 20px",
              borderRadius: "100px",
              background: badgeBg,
              color: badgeText,
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              backdropFilter: "blur(4px)",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: badgeText,
                flexShrink: 0,
              }}
            />
            {articleCount} artikuj
          </span>
        </motion.div>
      </div>

      {/* Figure portraits row */}
      {hasFigures && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: DUR.slow, ease: EASE }}
          style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          {figures.map((fig, i) => (
            <div
              key={fig.name}
              title={fig.name}
              style={{
                marginLeft: i === 0 ? 0 : "-18px",
                zIndex: figures.length - i,
                position: "relative",
              }}
            >
              <FigureCircle {...fig} />
            </div>
          ))}
        </motion.div>
      )}

      {/* Bottom fade edge */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "80px",
          background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.12))",
          pointerEvents: "none",
        }}
      />
    </motion.div>
  );
}
