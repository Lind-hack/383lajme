"use client";

import { motion } from "framer-motion";
import { type Article } from "@/lib/mock-data";
import TimeAgo from "./time-ago";
import SourceBadge from "@/components/source-badge";
import ArticleCard from "@/components/article-card";
import ArticleSidebar from "@/components/article-sidebar";
import type { DosjeData } from "@/components/article-sidebar";
import DosjeSection from "@/components/dosje-section";
import ArticleShareRow from "@/components/article-share-row";
import ArticleAsk from "@/components/article-ask";
import { toParagraphs, readingMinutes } from "@/lib/article-body.mjs";
import CategoryAccordion from "@/components/category-accordion";
import type { AccordionSlide } from "@/components/image-accordion";
import { EASE, DUR } from "@/lib/tokens";

interface Props {
  article: Article;
  related: Article[];
  catColor: string;
  catBg: string;
  categorySlides: AccordionSlide[];
  dosje: DosjeData | null;
}

export default function ArticleContent({ article, related, catColor, catBg, categorySlides, dosje }: Props) {
  // Counted from the prose, not from the markup the body is stored in.
  const dynamicReadTime = readingMinutes(article.body);

  return (
    <main
      style={{
        position: "relative",
        zIndex: 1,
        paddingTop: "80px",
        background: "#F9F6F1",
        minHeight: "100vh",
      }}
    >
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
              <SourceBadge source={article.source} flag={article.sourceFlag} />
              <span style={{ fontSize: "13px", color: "#6B6B6B", fontWeight: 500 }}>
                <TimeAgo iso={article.publishedAt} /> më parë
              </span>
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
              <div style={{ marginBottom: "36px" }}>
                <img
                  src={article.imageUrl}
                  alt={article.title}
                  style={{
                    width: "100%",
                    aspectRatio: "16/9",
                    objectFit: "cover",
                    borderRadius: "var(--radius-md)",
                    display: "block",
                  }}
                />
              </div>
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
            <ArticleAsk article={article} />

            <ArticleShareRow slug={article.slug} title={article.title} />
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
          <ArticleSidebar article={article} related={related} />
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
    </main>
  );
}
