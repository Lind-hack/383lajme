"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EASE, FONT } from "@/lib/tokens";
import { type Article, timeAgo, calcReadingTime } from "@/lib/mock-data";
import { getCategoryColor, getCategoryBg } from "@/lib/category-colors";
import SourceBadge from "./source-badge";

interface HeroDispatchProps {
  article: Article;
}

export default function HeroDispatch({ article }: HeroDispatchProps) {
  const catColor = getCategoryColor(article.category);
  const bgFallback = `linear-gradient(135deg, ${getCategoryBg(article.category, 0.15)} 0%, #1A1A1A 100%)`;
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const rawY = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  const parallaxY = prefersReducedMotion ? "0%" : rawY;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      style={{
        position: "relative",
        minHeight: "540px",
        borderRadius: "20px",
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: "0 8px 48px rgba(0,0,0,0.18)",
      }}
    >
      {/* Parallax image layer */}
      {article.imageUrl ? (
        <motion.div
          style={{
            position: "absolute",
            inset: "-12% 0",
            y: parallaxY,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.imageUrl}
            alt=""
            aria-hidden="true"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              transform: "scale(1.12)",
              transformOrigin: "center top",
            }}
          />
        </motion.div>
      ) : (
        <div style={{ position: "absolute", inset: 0, background: bgFallback }} />
      )}

      {/* Dark gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.75) 50%, rgba(0,0,0,0.25) 100%)",
        }}
      />

      {/* Top-left: plain text overline — category pill only */}
      <div
        style={{
          position: "absolute",
          top: "28px",
          left: "36px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        {/* Single category pill */}
        <span
          style={{
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#ffffff",
            background: `${catColor}30`,
            padding: "4px 10px",
            borderRadius: "100px",
            border: `1.5px solid ${catColor}55`,
            backdropFilter: "blur(8px)",
          }}
        >
          {article.category}
        </span>

        {/* NJOFTIM # and timeAgo as plain white text — no pill */}
        <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.65)", letterSpacing: "0.06em" }}>
          NJOFTIM #{article.dispatch}
        </span>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>
          {timeAgo(article.publishedAt)}
        </span>
      </div>

      {/* Bottom content */}
      <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block", height: "100%" }}>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "clamp(28px, 4vw, 48px)",
          }}
        >
          {/* Serif headline */}
          <h1
            style={{
              fontFamily: FONT.serif,
              fontSize: "var(--text-display)",
              fontWeight: 600,
              lineHeight: 1.06,
              letterSpacing: "-0.01em",
              color: "#FFFFFF",
              margin: "0 0 16px",
              maxWidth: "860px",
              textShadow: "0 2px 16px rgba(0,0,0,0.8), 0 4px 40px rgba(0,0,0,0.6)",
            }}
          >
            {article.title}
          </h1>

          <p
            style={{
              fontSize: "17px",
              fontWeight: 400,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.9)",
              textShadow: "0 1px 8px rgba(0,0,0,0.7)",
              margin: "0 0 28px",
              maxWidth: "640px",
            }}
          >
            {article.excerpt}
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <SourceBadge source={article.source} flag={article.sourceFlag} bias={article.sourceBias} />
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
              {calcReadingTime(article.body)} min lexim
            </span>
            <motion.span
              whileHover="hover"
              whileTap={{ scale: 0.98 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                fontWeight: 800,
                color: "#ffffff",
                background: "#FF4422",
                padding: "10px 24px",
                borderRadius: "100px",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                boxShadow: "0 4px 20px rgba(255,68,34,0.45)",
                marginLeft: "auto",
              }}
            >
              Lexo lajmin
              <motion.span
                variants={{ hover: { x: 3 } }}
                transition={{ duration: 0.2, ease: EASE }}
                style={{ display: "inline-flex" }}
              >
                <ArrowRight size={15} strokeWidth={2.5} />
              </motion.span>
            </motion.span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
