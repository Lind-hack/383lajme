"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bookmark, Link2 } from "lucide-react";
import { type Article } from "@/lib/mock-data";
import { EASE, DUR } from "@/lib/tokens";
import SidebarMarketWidget from "@/components/tregu/sidebar-market-widget";
import { type DosjeEntry } from "@/components/dosje-section";
import { useArticleSave } from "@/components/use-article-save";
import { CATEGORY_TO_SLUG, normalizeCategory } from "@/lib/category-map";

export interface DosjeVideo {
  id: string;
  channel: string;
  title: string;
}

export interface DosjeData {
  topicSlug: string;
  topicTitle: string;
  blurb: string;
  videos?: DosjeVideo[];
  entries: DosjeEntry[];
  /** Whether this file's history carries verified sources. */
  sourced?: boolean;
  /** The sourced opening paragraph ("Në pak fjalë"). */
  primer?: string | null;
}

interface Props {
  article: Article;
  /** The closest stories by subject (lib/related-articles.mjs), all with photos. */
  related: Article[];
}

const CARD: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E8E3DB",
  borderRadius: "var(--radius-md)",
  padding: "16px 18px",
};
const CARD_LABEL: React.CSSProperties = {
  fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
  color: "#6B6B6B", margin: "0 0 12px",
};

/**
 * "Lexo gjithashtu": the closest stories, photo and headline. Exported on its
 * own so a phone, where the rail is hidden, can show it in the page flow
 * without mounting the rail's scroll and account effects a second time.
 */
export function RelatedReads({ related }: { related: Article[] }) {
  if (!related.length) return null;
  return (
    <div style={CARD}>
      <p style={CARD_LABEL}>Lexo gjithashtu</p>
      <ol className="sb-related">
        {related.map((a) => (
          <li key={a.id}>
            <Link href={`/article/${a.slug}`} className="sb-related-row">
              <span className="sb-related-thumb" aria-hidden="true">
                {a.imageUrl && <Image src={a.imageUrl} alt="" fill sizes="104px" quality={75} />}
              </span>
              <span className="sb-related-title">{a.title}</span>
            </Link>
          </li>
        ))}
      </ol>
      <style>{`
        .sb-related { list-style: none; margin: 0; padding: 0; display: grid; }
        .sb-related li + li .sb-related-row { border-top: 1px solid #F0ECE6; }
        .sb-related-row {
          display: grid; grid-template-columns: 104px minmax(0, 1fr); gap: 12px; align-items: center;
          padding: 10px 0; color: #111111; text-decoration: none;
        }
        .sb-related li:first-child .sb-related-row { padding-top: 0; }
        .sb-related li:last-child .sb-related-row { padding-bottom: 0; }
        .sb-related-thumb { position: relative; aspect-ratio: 16 / 9; border-radius: 8px; overflow: hidden; background: #EFEAE2; }
        .sb-related-thumb img { object-fit: cover; }
        .sb-related-title {
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
          font-size: 13.5px; font-weight: 750; line-height: 1.32; text-wrap: pretty;
        }
        .sb-related-row:focus-visible { outline: 2px solid #FF4422; outline-offset: 2px; border-radius: 8px; }
        @media (hover: hover) and (pointer: fine) {
          .sb-related-row:hover .sb-related-title { text-decoration: underline; text-underline-offset: 3px; }
        }
      `}</style>
    </div>
  );
}

export default function ArticleSidebar({ article, related }: Props) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const { saved: isBookmarked, account: bookmarkAccount, busy: bookmarkBusy, toggle: toggleBookmark } = useArticleSave(article);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onScroll() {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(total > 0 ? (window.scrollY / total) * 100 : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function copyLink() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  // The canonical address, the same on server and client: reading it from
  // window.location rendered an empty share link on the server and a
  // hydration mismatch on every load, and shared whatever host the reader used.
  const articleUrl = `https://www.383ks.com/article/${article.slug}`;
  const encodedTitle = encodeURIComponent(article.title);
  const encodedUrl = encodeURIComponent(articleUrl);

  // The category is a section of the site; the title's own words are not
  // categories, so they open a search for themselves. Both used to link to
  // "/?category=<word>", which the homepage ignores.
  const STOPS = new Set(["kosovë", "kosova", "shqipëri", "është", "janë", "kanë", "sipas", "pasi", "gjatë", "ndaj", "edhe"]);
  const categoryHref = `/kategori/${CATEGORY_TO_SLUG[normalizeCategory(article.category)]}`;
  const wordTags = article.title
    .replace(/^[^:]{1,24}:\s*/u, "")
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter((w) => w.length > 4 && !STOPS.has(w.toLowerCase()))
    .filter((w, i, a) => a.findIndex((x) => x.toLowerCase() === w.toLowerCase()) === i)
    .slice(0, 4);
  const tags = [
    { label: article.category, href: categoryHref },
    ...wordTags.map((w) => ({ label: w, href: `/kerko?q=${encodeURIComponent(w)}` })),
  ];

  const styles = (
    <style>{`
      .sb-share a:focus-visible, .sb-share button:focus-visible, .sb-tag:focus-visible {
        outline: 2px solid #FF4422; outline-offset: 2px; border-radius: 8px;
      }
      @media (hover: hover) and (pointer: fine) {
        .sb-tag:hover { border-color: #111111; }
      }
      .sb-share { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .sb-share a, .sb-share button {
        display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px;
        padding: 0 10px; border-radius: var(--radius-sm); text-decoration: none;
        font-size: 13px; font-weight: 650; font-family: inherit; cursor: pointer; border: 0;
      }
    `}</style>
  );

  return (
    <>
      {/* Reading progress bar fixed at the top of the viewport. */}
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

      {/* Order is the reader's: pass it on, keep it, find more like it, and —
          last, once the reading is done — the market on it. The column no
          longer sticks as a whole: with everything in it, it is taller than a
          laptop screen, so the bottom (the market) never came into view until
          the story ended. Only the market card sticks, once the rest has
          scrolled past. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          height: "100%",
        }}
      >
        <div style={CARD}>
          <p style={CARD_LABEL}>Ndaj</p>
          <div className="sb-share">
            <motion.a
              href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              whileTap={{ scale: 0.97 }}
              transition={{ duration: DUR.base, ease: EASE }}
              style={{ background: "#25D366", color: "#102b19" }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.464 3.488" />
              </svg>
              WhatsApp
            </motion.a>
            <motion.a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              whileTap={{ scale: 0.97 }}
              transition={{ duration: DUR.base, ease: EASE }}
              style={{ background: "#1566D0", color: "#FFFFFF" }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook
            </motion.a>
            <motion.a
              href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              whileTap={{ scale: 0.97 }}
              transition={{ duration: DUR.base, ease: EASE }}
              style={{ background: "#000000", color: "#FFFFFF" }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.763l7.726-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              X
            </motion.a>
            <motion.button
              type="button"
              onClick={copyLink}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: DUR.base, ease: EASE }}
              style={{
                background: copied ? "#E8F5E9" : "#F3F4F6",
                boxShadow: `inset 0 0 0 1px ${copied ? "#A5D6A7" : "#E8E3DB"}`,
                color: "#111111",
              }}
            >
              <Link2 size={16} strokeWidth={2} aria-hidden="true" />
              <span aria-live="polite">{copied ? "U kopjua!" : "Kopjo linkun"}</span>
            </motion.button>
          </div>
        </div>

        {/* Bookmark */}
        <motion.button
          onClick={toggleBookmark}
          disabled={bookmarkBusy}
          aria-pressed={isBookmarked}
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
          {bookmarkBusy ? "Po ruhet…" : isBookmarked ? (bookmarkAccount ? "Ruajtur në profil" : "Ruajtur në pajisje") : "Ruaj artikullin"}
        </motion.button>

        <div style={CARD}>
          <p style={{ ...CARD_LABEL, margin: "0 0 10px" }}>Etiketat</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {tags.map((tag, i) => (
              <Link
                key={tag.href}
                href={tag.href}
                className="sb-tag"
                style={{
                  display: "inline-block", padding: "5px 11px",
                  background: i === 0 ? "#111111" : "#F3F4F6",
                  border: `1px solid ${i === 0 ? "#111111" : "#E8E3DB"}`,
                  borderRadius: "100px", fontSize: "12px", fontWeight: 650,
                  color: i === 0 ? "#FFFFFF" : "#111111", textDecoration: "none",
                }}
              >
                {tag.label}
              </Link>
            ))}
          </div>
        </div>

        <RelatedReads related={related} />

        <div style={{ position: "sticky", top: "96px" }}>
          <SidebarMarketWidget articleCategory={article.category} articleTitle={article.title} articleExcerpt={article.excerpt} />
        </div>
      </div>

      {styles}
    </>
  );
}
