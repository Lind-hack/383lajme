"use client";

import { motion } from "framer-motion";

interface CategoryBannerProps {
  categoryName: string;
  from: string;
  to: string;
  articleCount: number;
  lightBg?: boolean;
}

const POLITIKE_FIGURES = [
  { name: "Albin Kurti",       top: "15%", left: "5%",  size: "22px", rotate: "-8deg",  opacity: 0.13 },
  { name: "Vjosa Osmani",      top: "55%", left: "12%", size: "18px", rotate: "5deg",   opacity: 0.10 },
  { name: "Hashim Thaçi",      top: "25%", left: "62%", size: "20px", rotate: "-4deg",  opacity: 0.12 },
  { name: "Rramush Haradinaj", top: "65%", left: "55%", size: "17px", rotate: "7deg",   opacity: 0.09 },
  { name: "Bedri Hamza",       top: "40%", left: "80%", size: "19px", rotate: "-6deg",  opacity: 0.11 },
];

export default function CategoryBanner({
  categoryName,
  from,
  to,
  articleCount,
  lightBg = false,
}: CategoryBannerProps) {
  const textColor = lightBg ? "#111111" : "#FFFFFF";
  const subColor = lightBg ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.6)";
  const watermarkColor = lightBg ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.07)";
  const badgeBg = lightBg ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.15)";
  const badgeText = lightBg ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)";
  const isPolitike = categoryName === "Politikë";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{
        position: "relative",
        width: "100%",
        minHeight: "320px",
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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

      {/* Politikë — political figure names as background texture */}
      {isPolitike &&
        POLITIKE_FIGURES.map((fig) => (
          <div
            key={fig.name}
            aria-hidden="true"
            style={{
              position: "absolute",
              top: fig.top,
              left: fig.left,
              fontSize: fig.size,
              fontWeight: 700,
              color: `rgba(255,255,255,${fig.opacity})`,
              transform: `rotate(${fig.rotate})`,
              letterSpacing: "0.04em",
              pointerEvents: "none",
              userSelect: "none",
              whiteSpace: "nowrap",
              textTransform: "uppercase",
            }}
          >
            {fig.name}
          </div>
        ))}

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
          padding: "40px 24px",
        }}
      >
        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.45 }}
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
          transition={{ delay: 0.18, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
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
          transition={{ delay: 0.28, duration: 0.4 }}
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

      {/* Bottom fade-to-cream edge */}
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
