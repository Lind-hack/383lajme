"use client";

import { useState, useEffect } from "react";
import {
  motion,
  useMotionTemplate,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FONT, EASE } from "@/lib/tokens";
import { type Article, timeAgo, calcReadingTime } from "@/lib/mock-data";
import { getCategoryColor } from "@/lib/category-colors";
import SourceBadge from "./source-badge";

// px of scroll for the card-to-fullscreen expansion
const SCROLL_HEIGHT = 1500;

interface Props {
  article: Article;
}

export default function HeroScrollArticle({ article }: Props) {
  const catColor = getCategoryColor(article.category);
  const prefersReducedMotion = useReducedMotion();
  const { scrollY } = useScroll();

  // Hydration fix: timeAgo is time-relative, compute client-side only
  const [age, setAge] = useState("");
  useEffect(() => { setAge(timeAgo(article.publishedAt)); }, [article.publishedAt]);

  // polygon clip: centered 50%×50% card → full screen
  const clipStart = useTransform(scrollY, [0, SCROLL_HEIGHT], [25, 0]);
  const clipEnd   = useTransform(scrollY, [0, SCROLL_HEIGHT], [75, 100]);
  const clipPath  = useMotionTemplate`polygon(${clipStart}% ${clipStart}%, ${clipEnd}% ${clipStart}%, ${clipEnd}% ${clipEnd}%, ${clipStart}% ${clipEnd}%)`;

  // Background zooms from 170% → 100% (edges never exposed during expansion)
  const bgSizeNum = useTransform(scrollY, [0, SCROLL_HEIGHT + 500], [170, 100]);
  const backgroundSize = useMotionTemplate`${bgSizeNum}%`;

  // Content fades in only after image reaches full screen (last 15% of scroll)
  const contentOpacity = useTransform(scrollY, [SCROLL_HEIGHT * 0.85, SCROLL_HEIGHT], [0, 1]);
  const contentY       = useTransform(scrollY, [SCROLL_HEIGHT * 0.85, SCROLL_HEIGHT], [32, 0]);

  const finalClipPath = prefersReducedMotion ? "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)" : clipPath;
  const finalBgSize   = prefersReducedMotion ? "100%" : backgroundSize;
  const finalOpacity  = prefersReducedMotion ? 1 : contentOpacity;
  const finalY        = prefersReducedMotion ? 0 : contentY;

  return (
    /* Scroll container — tall enough for the expansion animation */
    <div
      style={{
        height: `calc(${SCROLL_HEIGHT}px + 100vh)`,
        position: "relative",
        width: "100%",
      }}
    >
      {/* Full-screen cream stage — clip applied to inner child so site bg shows around the card */}
      <div
        style={{
          position: "sticky",
          top: "var(--nav-h)",
          height: "calc(100vh - var(--nav-h))",
          width: "100%",
          background: "var(--color-cream, #F9F6F1)",
          overflow: "hidden",
        }}
      >
      {/* Clipped image zone — grows from center polygon to full screen */}
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: finalClipPath,
          willChange: "clip-path",
        }}
      >
        {/* Background image */}
        {article.imageUrl ? (
          <motion.div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${article.imageUrl})`,
              backgroundSize: finalBgSize,
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: "#1A1A1A" }} />
        )}

        {/* Gradient — heavy at bottom where text lives */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.93) 0%, rgba(0,0,0,0.58) 40%, rgba(0,0,0,0.08) 100%)",
          }}
        />

        {/* Entire overlay is a link */}
        <Link
          href={`/article/${article.slug}`}
          style={{ textDecoration: "none", display: "block", height: "100%" }}
        >
          <motion.div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "clamp(20px, 3vw, 40px)",
            }}
          >
            {/* Top — category + dispatch + age; all fade in with content */}
            <motion.div
              initial={{ opacity: 0 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                opacity: finalOpacity,
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#ffffff",
                  background: `${catColor}35`,
                  padding: "4px 10px",
                  borderRadius: "100px",
                  border: `1.5px solid ${catColor}60`,
                  backdropFilter: "blur(8px)",
                }}
              >
                {article.category}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.65)",
                  letterSpacing: "0.06em",
                }}
              >
                NJOFTIM #{String(article.dispatch).padStart(2, "0")}
              </span>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                <span suppressHydrationWarning>{age}</span>
              </span>
            </motion.div>

            {/* Bottom — headline + excerpt + meta + CTA */}
            <motion.div initial={{ opacity: 0 }} style={{ opacity: finalOpacity, y: finalY }}>
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
                  textShadow: "0 2px 16px rgba(0,0,0,0.85), 0 4px 40px rgba(0,0,0,0.6)",
                }}
              >
                {article.title}
              </h1>

              <p
                style={{
                  fontSize: "17px",
                  fontWeight: 400,
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.88)",
                  textShadow: "0 1px 8px rgba(0,0,0,0.7)",
                  margin: "0 0 28px",
                  maxWidth: "620px",
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
                <SourceBadge
                  source={article.source}
                  flag={article.sourceFlag}
                  bias={article.sourceBias}
                />
                <span
                  style={{
                    fontSize: "12px",
                    color: "rgba(255,255,255,0.5)",
                    fontWeight: 500,
                  }}
                >
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
            </motion.div>
          </motion.div>
        </Link>
      </motion.div>
      </div>
    </div>
  );
}
