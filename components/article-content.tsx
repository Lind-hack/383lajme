"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { type Article } from "@/lib/mock-data";
import TimeAgo from "./time-ago";
import ArticleCard from "@/components/article-card";
import ArticleSidebar from "@/components/article-sidebar";
import type { DosjeData } from "@/components/article-sidebar";
import DosjeSection from "@/components/dosje-section";
import ArticleShareRow from "@/components/article-share-row";
import ArticleAsk from "@/components/article-ask";
import { toParagraphs, readingMinutes } from "@/lib/article-body.mjs";
import CategoryAccordion from "@/components/category-accordion";
import SectionLabel from "@/components/section-label";
import CategoryRail from "@/components/category-rail";
import StoryList from "@/components/story-list";
import { CATEGORY_TO_SLUG, normalizeCategory } from "@/lib/category-map";
import type { AccordionSlide } from "@/components/image-accordion";
import { EASE, DUR } from "@/lib/tokens";
import PaperReady from "@/components/paper-ready";

interface Props {
  article: Article;
  related: Article[];
  /** More from this story's section, after the related cards. */
  moreFromCategory?: Article[];
  /** The newest from the other sections. */
  latestElsewhere?: Article[];
  catColor: string;
  catBg: string;
  categorySlides: AccordionSlide[];
  dosje: DosjeData | null;
  /** The orange latest-news strip, rendered on the server (home/latest-strip). */
  latestStrip?: React.ReactNode;
  /** Alternate publication metadata and attribution, using the same reader layout. */
  editorial?: {
    metadata: React.ReactNode;
    afterBody: React.ReactNode;
    sidebar: React.ReactNode;
    path: string;
  };
}

export default function ArticleContent({ article, related, moreFromCategory = [], latestElsewhere = [], catColor, catBg, categorySlides, dosje, latestStrip, editorial }: Props) {
  // Counted from the prose, not from the markup the body is stored in.
  const dynamicReadTime = readingMinutes(article.body);

  return (
    <main
      style={{
        position: "relative",
        zIndex: 1,
        paddingTop: "var(--nav-h)",
        background: "#F9F6F1",
        minHeight: "100vh",
      }}
    >
      {latestStrip}
      <CategoryRail active={article.category} />
      <div style={{ height: "4px", background: catColor, width: "100%" }} />

      <div
        className="article-grid"
        style={{
          maxWidth: "1420px",
          margin: "0 auto",
          padding: "56px 24px 64px",
        }}
      >
        <article className="article-story" style={{ minWidth: 0 }}>

          {/* Group 1 — header block: badges + h1 + meta, single 0.45s rise */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.reveal, ease: EASE }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "28px",
                flexWrap: "wrap",
              }}
            >
              {/* The NJOFTIM chip is gone. `dispatch` was meant to be a short
                  code padded to two digits, but the pipeline writes its own
                  provenance string into that field, so every article carried
                  "NJOFTIM #cloud-news-discovery + direct publisher
                  verification" above the headline: internal plumbing, printed
                  to readers. */}
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: catColor,
                  background: catBg,
                  padding: "5px 12px",
                  borderRadius: "100px",
                  border: `1.5px solid ${catColor}33`,
                }}
              >
                {article.category}
              </span>
            </div>

            <h1
              style={{
                fontSize: "clamp(28px, 4vw, 52px)",
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                color: "#111111",
                margin: "0 0 28px",
              }}
            >
              {article.title}
            </h1>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                flexWrap: "wrap",
                marginBottom: "32px",
                paddingBottom: "32px",
                borderBottom: "1px solid #E8E3DB",
              }}
            >

              {editorial ? editorial.metadata : <span style={{ fontSize: "13px", color: "#6B6B6B", fontWeight: 500 }}>
                <TimeAgo iso={article.publishedAt} /> më parë
              </span>}
              <span style={{ fontSize: "13px", color: "#6B6B6B", fontWeight: 500 }}>
                {dynamicReadTime} min lexim
              </span>
            </div>
          </motion.div>

          {/* Group 2 — image + excerpt + body, 0.1s delay */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, delay: 0.1, ease: EASE }}
          >
            {article.imageUrl && (
              <ArticleHero src={article.imageUrl} alt={article.title} width={article.imageWidth} height={article.imageHeight} hideOnError={Boolean(editorial)} />
            )}

            <p
              style={{
                fontSize: "20px",
                fontWeight: 500,
                lineHeight: 1.65,
                color: "#111111",
                margin: "0 0 32px",
                borderLeft: `4px solid ${catColor}`,
                paddingLeft: "20px",
              }}
            >
              {article.excerpt}
            </p>

            <div style={{ fontSize: "17px", lineHeight: 1.85, color: "#333333" }}>
              {/* Bodies arrive as HTML from the pipeline and as plain text from
                  older pieces; splitting on blank lines and rendering the
                  result printed the tags to the reader on every article. */
              toParagraphs(article.body).map((paragraph: string, i: number) => (
                <p key={i} style={{ margin: "0 0 28px" }}>
                  {paragraph}
                </p>
              ))}
            </div>
            {/* The reader has just finished; this is where the questions are. */}
            {editorial ? editorial.afterBody : <ArticleAsk article={article} />}

            <ArticleShareRow slug={article.slug} title={article.title} path={editorial?.path} />

            {/* After the third real read, Dardani offers the paper he made from them. */}
            {!editorial && <PaperReady />}
          </motion.div>
        </article>

        {/* The dossier is a child of the grid, not of the rail: above 1024px it
            leads the sidebar column, below it runs full width under the story.
            The rail itself is display:none on a phone, which is why a dossier
            rendered inside it reached no phone at all. */}
        {dosje && dosje.entries.length > 0 && (
          <div className="article-dosje">
            <DosjeSection
              topicSlug={dosje.topicSlug}
              topicTitle={dosje.topicTitle}
              blurb={dosje.blurb}
              videos={dosje.videos}
              entries={dosje.entries}
              sourced={dosje.sourced ?? false}
            />
          </div>
        )}

        <div className="article-sidebar-col">
          {editorial ? editorial.sidebar : <ArticleSidebar article={article} related={related} />}
        </div>
      </div>

      <style>{`
        .article-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 460px;
          grid-template-rows: auto 1fr;
          grid-template-areas:
            "story dosje"
            "story rail";
          column-gap: 44px;
          row-gap: 14px;
          align-items: start;
        }
        .article-story { grid-area: story; }
        .article-dosje { grid-area: dosje; }
        /* The rail stretches into the leftover row so its sticky inner column
           has somewhere to travel; align-items:start alone would collapse it
           to content height and the stickiness would silently do nothing. */
        .article-sidebar-col { grid-area: rail; align-self: stretch; }

        @media (max-width: 1200px) {
          .article-grid { grid-template-columns: minmax(0, 1fr) 360px; }
        }
        @media (max-width: 1023px) {
          .article-grid {
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: auto auto;
            grid-template-areas:
              "story"
              "dosje";
            row-gap: 44px;
          }
          .article-sidebar-col { display: none; }
        }
      `}</style>

      {/* Category cards (no image) — explore by category */}
      {categorySlides.length > 0 && (
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "8px 24px 56px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <div style={{ width: "4px", height: "28px", background: catColor, borderRadius: "2px" }} />
            <span
              style={{
                fontSize: "13px",
                fontWeight: 800,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#111111",
              }}
            >
              EKSPLORO SIPAS KATEGORISË
            </span>
            <div style={{ flex: 1, height: "1px", background: "#E8E3DB" }} />
          </div>
          <CategoryAccordion slides={categorySlides} />
        </div>
      )}

      {related.length > 0 && (
        <div
          style={{
            background: "#FFFFFF",
            borderTop: "1px solid #E8E3DB",
            padding: "56px 24px 80px",
          }}
        >
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginBottom: "32px",
              }}
            >
              <div style={{ width: "4px", height: "28px", background: catColor, borderRadius: "2px" }} />
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#111111",
                }}
              >
                NJOFTIME TË LIDHURA
              </span>
              <div style={{ flex: 1, height: "1px", background: "#E8E3DB" }} />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "20px",
              }}
            >
              {related.map((a, i) => (
                <ArticleCard key={a.id} article={a} index={i} />
              ))}
            </div>
          </div>
        </div>
      )}
      {(moreFromCategory.length > 0 || latestElsewhere.length > 0) && (
        <section className="article-next" aria-label="Lexo më tej">
          <div className="article-next-grid">
            {moreFromCategory.length > 0 && (
              <div>
                <SectionLabel
                  label={`Më shumë nga ${article.category}`}
                  accent={catColor}
                  marginBottom={8}
                  right={
                    <Link href={`/kategori/${CATEGORY_TO_SLUG[normalizeCategory(article.category)]}`} className="section-more">
                      Shiko të gjitha<span aria-hidden> →</span>
                    </Link>
                  }
                />
                <StoryList articles={moreFromCategory} />
              </div>
            )}
            {latestElsewhere.length > 0 && (
              <div>
                <SectionLabel
                  label="Lajmet e fundit"
                  marginBottom={8}
                  right={
                    <Link href="/#lajmet-e-fundit" className="section-more">
                      Te ballina<span aria-hidden> →</span>
                    </Link>
                  }
                />
                <StoryList articles={latestElsewhere} showCategory />
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

/** The story column's widest box, at 1420px and up (see .article-grid). */
const HERO_COLUMN_WIDTH = 870;

/**
 * The article's photo. It used to be a plain <img> of the outlet's file, so a
 * 640px photo was stretched across the whole column and looked pixelated on
 * any laptop. A photo at least as wide as the column fills it as before; a
 * narrower one is shown at its own size, centred on a blurred copy of itself,
 * so it is never enlarged.
 */
function ArticleHero({ src, alt, width, height, hideOnError = false }: { src: string; alt: string; width?: number; height?: number; hideOnError?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (hideOnError && failedSrc === src) return null;
  const onError = hideOnError ? () => setFailedSrc(src) : undefined;
  const small = width !== undefined && height !== undefined && width < HERO_COLUMN_WIDTH;
  return (
    <div
      style={{
        marginBottom: "36px",
        position: "relative",
        aspectRatio: "16/9",
        overflow: "hidden",
        borderRadius: "var(--radius-md)",
        background: "#1a1a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {small ? (
        <>
          {/* Blurred to nothing, so the smallest rendition is enough. */}
          <Image
            src={src}
            alt=""
            aria-hidden
            fill
            sizes="64px"
            style={{ objectFit: "cover", filter: "blur(28px) brightness(0.7)", transform: "scale(1.15)" }}
          />
          {/* The photo's own width, capped by the box: it can shrink to fit,
              never grow. The width is explicit because the browser's own idea
              of it comes from the srcset candidate it picked, and the
              optimizer never enlarges — a 1920w candidate that returns 800px
              reads as 333px wide. */}
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            priority
            sizes={`${width}px`}
            quality={90}
            onError={onError}
            style={{
              position: "relative",
              width: `min(100%, ${width}px)`,
              height: "auto",
              maxHeight: "100%",
              objectFit: "contain",
            }}
          />
        </>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          // The page's LCP element.
          priority
          sizes={`(max-width: 1023px) 100vw, ${HERO_COLUMN_WIDTH}px`}
          quality={90}
          onError={onError}
          style={{ objectFit: "cover" }}
        />
      )}
    </div>
  );
}
