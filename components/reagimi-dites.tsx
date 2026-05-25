"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { type Article, timeAgo } from "@/lib/mock-data";

const CAT_GRADIENT: Record<string, string> = {
  "Politikë":   "linear-gradient(135deg, #C41E3A 0%, #1A1A1A 100%)",
  "Siguri":     "linear-gradient(135deg, #1A56DB 0%, #0F0F0F 100%)",
  "Teknologji": "linear-gradient(135deg, #059669 0%, #1A1A1A 100%)",
  "Ekonomi":    "linear-gradient(135deg, #D97706 0%, #1A1A1A 100%)",
  "Botë":       "linear-gradient(135deg, #0F766E 0%, #1A1A1A 100%)",
  "Showbiz":    "linear-gradient(135deg, #7C3AED 0%, #1A1A1A 100%)",
};

function getYtId(url: string): string | null {
  return url.match(/embed\/([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
}

export default function ReagimiDites({ article }: { article: Article }) {
  const [popupOpen, setPopupOpen] = useState(false);
  const gradient = CAT_GRADIENT[article.category] ?? "linear-gradient(135deg, #FF4422 0%, #1A1A1A 100%)";
  const ytId = article.videoClipUrl ? getYtId(article.videoClipUrl) : null;

  useEffect(() => {
    if (!popupOpen) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setPopupOpen(false); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [popupOpen]);

  return (
    <section style={{ marginBottom: "48px", position: "relative" }}>
      <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -4, boxShadow: "0 24px 64px rgba(255,68,34,0.2)" }}
          style={{
            background: "linear-gradient(135deg, #1A1A1A 0%, #0F0F0F 100%)",
            borderRadius: "24px",
            border: "1px solid rgba(255,68,34,0.2)",
            overflow: "hidden",
            cursor: "pointer",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            display: "flex",
            flexWrap: "wrap" as const,
            alignItems: "stretch",
            minHeight: "160px",
          }}
        >
          {/* Left: play area */}
          {ytId ? (
            /* YouTube thumbnail with play overlay */
            <div
              onClick={(e) => { e.preventDefault(); setPopupOpen(true); }}
              style={{
                flex: "0 0 200px",
                minWidth: "160px",
                minHeight: "140px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "50%",
                    background: "#FF4422",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 8px 24px rgba(255,68,34,0.5)",
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </motion.div>
              </div>
              <span
                style={{
                  position: "absolute",
                  bottom: "12px",
                  right: "12px",
                  background: "rgba(0,0,0,0.7)",
                  color: "#FFFFFF",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "100px",
                  letterSpacing: "0.04em",
                }}
              >
                {article.readingTime} min
              </span>
            </div>
          ) : (
            /* Fallback: category gradient + static play button */
            <div
              style={{
                flex: "0 0 200px",
                minWidth: "160px",
                minHeight: "140px",
                background: gradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.2 }}
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "50%",
                  background: "#FF4422",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 24px rgba(255,68,34,0.5)",
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </motion.div>
              <span
                style={{
                  position: "absolute",
                  bottom: "12px",
                  right: "12px",
                  background: "rgba(0,0,0,0.7)",
                  color: "#FFFFFF",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "100px",
                  letterSpacing: "0.04em",
                }}
              >
                {article.readingTime} min
              </span>
            </div>
          )}

          {/* Right: content */}
          <div
            style={{
              flex: "1 1 280px",
              padding: "28px 32px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#FF4422",
                  display: "inline-block",
                  flexShrink: 0,
                  boxShadow: "0 0 8px rgba(255,68,34,0.8)",
                }}
              />
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase" as const,
                  color: "#FF4422",
                }}
              >
                Reagimi i Ditës
              </span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.35)",
                  letterSpacing: "0.08em",
                }}
              >
                · {timeAgo(article.publishedAt)}
              </span>
            </div>

            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.45)",
                textTransform: "uppercase" as const,
                letterSpacing: "0.1em",
              }}
            >
              {article.category}
            </span>

            <h2
              style={{
                fontSize: "clamp(16px, 3.5vw, 20px)",
                fontWeight: 800,
                lineHeight: 1.3,
                letterSpacing: "-0.02em",
                color: "#FFFFFF",
                margin: 0,
              }}
            >
              {article.title}
            </h2>

            <motion.span
              whileHover={{ x: 4 }}
              transition={{ duration: 0.2 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                fontWeight: 700,
                color: "#FF4422",
                marginTop: "4px",
              }}
            >
              {ytId ? "Shiko videon" : "Lexo reagimin"}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </motion.span>
          </div>
        </motion.div>
      </Link>

      {/* Fullscreen video popup */}
      {popupOpen && (
        <div
          onClick={() => setPopupOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{ width: "min(90vw, 1200px)", aspectRatio: "16/9", position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={`${article.videoClipUrl}?autoplay=1&rel=0`}
              style={{ width: "100%", height: "100%", border: "none", borderRadius: "12px" }}
              allow="autoplay; fullscreen"
              allowFullScreen
            />
            <button
              onClick={() => setPopupOpen(false)}
              style={{
                position: "absolute",
                top: "-44px",
                right: 0,
                background: "none",
                border: "none",
                color: "#fff",
                fontSize: "28px",
                cursor: "pointer",
                lineHeight: 1,
                padding: "8px",
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
