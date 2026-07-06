"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bookmark, Link2 } from "lucide-react";
import { type Article } from "@/lib/mock-data";
import { EASE, DUR } from "@/lib/tokens";

function flagToCode(flag: string): string {
  const cps = [...flag].map((c) => c.codePointAt(0) ?? 0);
  if (cps.length !== 2) return flag.slice(0, 2);
  const a = cps[0] - 0x1f1e6 + 65;
  const b = cps[1] - 0x1f1e6 + 65;
  if (a < 65 || a > 90 || b < 65 || b > 90) return flag.slice(0, 2);
  return String.fromCharCode(a, b);
}

interface Props {
  article: Article;
  related: Article[];
}

export default function ArticleSidebar({ article, related }: Props) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liveReaders, setLiveReaders] = useState(0);

  useEffect(() => {
    function onScroll() {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(total > 0 ? (window.scrollY / total) * 100 : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("bookmarks") ?? "[]") as string[];
      setIsBookmarked(saved.includes(article.id));
    } catch { /* ignore */ }
  }, [article.id]);

  useEffect(() => {
    setLiveReaders(Math.floor(Math.random() * 38 + 12));
    const interval = setInterval(() => {
      setLiveReaders((prev) => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        return Math.max(5, Math.min(80, prev + delta));
      });
    }, Math.random() * 7000 + 8000);
    return () => clearInterval(interval);
  }, []);

  function toggleBookmark() {
    try {
      const saved = JSON.parse(localStorage.getItem("bookmarks") ?? "[]") as string[];
      const next = isBookmarked
        ? saved.filter((id) => id !== article.id)
        : [...saved, article.id];
      localStorage.setItem("bookmarks", JSON.stringify(next));
      setIsBookmarked(!isBookmarked);
    } catch { /* ignore */ }
  }

  function copyLink() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  const articleUrl = typeof window !== "undefined" ? window.location.href : "";
  const encodedTitle = encodeURIComponent(article.title);
  const encodedUrl = encodeURIComponent(articleUrl);

  const STOPS = new Set(["that", "this", "with", "from", "have", "been", "their", "which", "will", "about"]);
  const tags = [
    article.category,
    ...article.title
      .split(/\s+/)
      .filter((w) => w.length > 4 && !STOPS.has(w.toLowerCase()))
      .map((w) => w.replace(/[^a-zA-ZÀ-ÿ]/g, ""))
      .filter(Boolean)
      .slice(0, 4),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const shareBase: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "9px 14px", borderRadius: "var(--radius-sm)",
    textDecoration: "none", fontSize: "13px", fontWeight: 600,
  };

  return (
    <>
      {/* Reading progress bar — fixed at top of viewport */}
      <div
        style={{
          position: "fixed",
          top: "64px",
          left: 0,
          right: 0,
          height: "3px",
          background: "rgba(0,0,0,0.06)",
          zIndex: 100,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "100%",
            background: "#FF4422",
            transformOrigin: "left",
            transform: `scaleX(${scrollProgress / 100})`,
            transition: "transform 0.1s linear",
          }}
        />
      </div>

      {/* Sticky sidebar */}
      <div
        style={{
          position: "sticky",
          top: "96px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {/* Social share */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E8E3DB",
            borderRadius: "var(--radius-md)",
            padding: "18px 20px",
          }}
        >
          <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B6B6B", margin: "0 0 12px" }}>
            Ndaj
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <motion.a
              href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: DUR.base, ease: EASE }}
              style={{ ...shareBase, background: "#25D366", color: "#FFFFFF" }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.464 3.488" />
              </svg>
              WhatsApp
            </motion.a>

            <motion.a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: DUR.base, ease: EASE }}
              style={{ ...shareBase, background: "#1877F2", color: "#FFFFFF" }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook
            </motion.a>

            <motion.a
              href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: DUR.base, ease: EASE }}
              style={{ ...shareBase, background: "#000000", color: "#FFFFFF" }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.763l7.726-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              X (Twitter)
            </motion.a>

            <motion.button
              onClick={copyLink}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: DUR.base, ease: EASE }}
              style={{
                ...shareBase,
                background: copied ? "#E8F5E9" : "#F3F4F6",
                border: `1px solid ${copied ? "#A5D6A7" : "#E8E3DB"}`,
                cursor: "pointer",
                color: "#111111",
                width: "100%",
                fontFamily: "inherit",
              }}
            >
              <Link2 size={16} strokeWidth={2} />
              {copied ? "U kopjua!" : "Kopjo linkun"}
            </motion.button>
          </div>
        </div>

        {/* Bookmark */}
        <motion.button
          onClick={toggleBookmark}
          whileHover={{ y: -2, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: DUR.base, ease: EASE }}
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "13px 20px",
            background: isBookmarked ? "#FFF5F5" : "#FFFFFF",
            border: `1px solid ${isBookmarked ? "rgba(255,68,34,0.3)" : "#E8E3DB"}`,
            borderRadius: "var(--radius-md)", cursor: "pointer",
            color: isBookmarked ? "#FF4422" : "#6B6B6B",
            fontSize: "14px", fontWeight: 600, width: "100%",
            fontFamily: "inherit",
          }}
        >
          <Bookmark
            size={18}
            strokeWidth={2}
            style={{ fill: isBookmarked ? "#FF4422" : "none", color: isBookmarked ? "#FF4422" : "currentColor" }}
          />
          {isBookmarked ? "Ruajtur" : "Ruaj artikullin"}
        </motion.button>

        {/* Live readers */}
        <div
          style={{
            background: "#FFFFFF", border: "1px solid #E8E3DB", borderRadius: "var(--radius-md)",
            padding: "14px 20px", display: "flex", alignItems: "center", gap: "10px",
          }}
        >
          <span style={{
            width: "8px", height: "8px", borderRadius: "50%", background: "#22C55E",
            display: "inline-block", flexShrink: 0, animation: "sb-pulse 2s infinite",
          }} />
          <span style={{ fontSize: "13px", color: "#6B6B6B" }}>
            <strong style={{ color: "#111111" }}>{liveReaders}</strong> lexues tani
          </span>
        </div>

        {/* Tags */}
        <div
          style={{
            background: "#FFFFFF", border: "1px solid #E8E3DB", borderRadius: "var(--radius-md)",
            padding: "16px 20px",
          }}
        >
          <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B6B6B", margin: "0 0 10px" }}>
            Etiketat
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {tags.map((tag) => (
              <motion.a
                key={tag}
                href={`/?category=${encodeURIComponent(tag)}`}
                whileHover={{ scale: 1.04, y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: DUR.fast, ease: EASE }}
                style={{
                  display: "inline-block", padding: "4px 11px",
                  background: "#F3F4F6", border: "1px solid #E8E3DB",
                  borderRadius: "100px", fontSize: "12px", fontWeight: 600,
                  color: "#111111", textDecoration: "none",
                }}
              >
                {tag}
              </motion.a>
            ))}
          </div>
        </div>

        {/* Related articles */}
        {related.length > 0 && (
          <div
            style={{
              background: "#FFFFFF", border: "1px solid #E8E3DB", borderRadius: "var(--radius-md)",
              padding: "18px 20px",
            }}
          >
            <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B6B6B", margin: "0 0 12px" }}>
              Lexo gjithashtu
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {related.slice(0, 2).map((a) => (
                <a key={a.id} href={`/article/${a.slug}`} style={{ textDecoration: "none" }}>
                  <motion.div
                    whileHover={{ y: -2, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                    transition={{ duration: DUR.base, ease: EASE }}
                    style={{
                      padding: "11px 12px", borderRadius: "var(--radius-sm)",
                      border: "1px solid #F0ECE6", background: "#FAFAF8",
                    }}
                  >
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#111111", margin: "0 0 6px", lineHeight: 1.35 }}>
                      {a.title}
                    </p>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "4px",
                      background: "rgba(0,0,0,0.05)", padding: "2px 8px",
                      borderRadius: "100px", fontSize: "11px", fontWeight: 600, color: "#6B6B6B",
                    }}>
                      {flagToCode(a.sourceFlag)} {a.source}
                    </span>
                  </motion.div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes sb-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
          70%  { box-shadow: 0 0 0 7px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sb-pulse-dot { animation: none !important; }
        }
      `}</style>
    </>
  );
}
