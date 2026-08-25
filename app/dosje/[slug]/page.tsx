import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import ArticleCard from "@/components/article-card";
import { getArticles } from "@/lib/db";
import type { Article } from "@/lib/mock-data";
import { TOPICS, topicBySlug, articlesForTopic, timelineFor } from "@/lib/topics.mjs";

const SITE = "https://www.383ks.com";

/**
 * The full dossier for one standing topic: authored history, then every article
 * 383 has published on the subject. The rail beside an article is the compact
 * view of this page; this is where a reader lands when the compact view is not
 * enough.
 */

export const revalidate = 900;

export function generateStaticParams() {
  return TOPICS.map((t: { slug: string }) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const topic = topicBySlug(slug);
  if (!topic) return { title: "Dosje — 383" };
  const title = `${topic.title} — dosje | 383`;
  return {
    title,
    description: topic.blurb,
    alternates: { canonical: `${SITE}/dosje/${topic.slug}` },
    openGraph: {
      title,
      description: topic.blurb,
      url: `${SITE}/dosje/${topic.slug}`,
      type: "article",
      siteName: "383",
    },
  };
}

export default async function DosjePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = topicBySlug(slug);
  if (!topic) notFound();

  const all = await getArticles(400);
  const articles = articlesForTopic(slug, all);
  const timeline = timelineFor(slug, all);
  const milestones = timeline.filter((e: { kind: string }) => e.kind === "milestone");

  return (
    <>
      <TextureBg />
      <Navbar />

      <main style={{ maxWidth: "1080px", margin: "0 auto", padding: "40px 24px 72px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#FF4422" }} />
          <span
            style={{
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#6B6B6B",
            }}
          >
            Dosje
          </span>
        </div>

        <h1
          style={{
            margin: "0 0 14px",
            fontSize: "clamp(30px, 4.6vw, 52px)",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "#111111",
            maxWidth: "760px",
          }}
        >
          {topic.title}
        </h1>

        <p style={{ margin: "0 0 8px", fontSize: "17px", lineHeight: 1.6, color: "#444444", maxWidth: "640px" }}>
          {topic.blurb}
        </p>
        <p style={{ margin: "0 0 40px", fontSize: "13px", fontWeight: 600, color: "#8A8A8A" }}>
          {milestones.length} momente historike · {articles.length} artikuj nga 383
        </p>

        <section aria-label="Kronologjia" style={{ marginBottom: "56px" }}>
          <h2
            style={{
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#6B6B6B",
              margin: "0 0 20px",
            }}
          >
            Kronologjia
          </h2>

          {milestones.map(
            (
              m: { id: string; year?: string; date?: string; tag?: string; title: string; summary?: string; why?: string },
              i: number
            ) => (
              <div key={m.id} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: "#FFFFFF",
                      border: "2px solid #FF4422",
                      marginTop: "6px",
                      flexShrink: 0,
                    }}
                  />
                  {i < milestones.length - 1 && (
                    <span style={{ width: "2px", flex: 1, background: "#EFEAE2", marginTop: "6px" }} />
                  )}
                </div>

                <div style={{ paddingBottom: "28px", maxWidth: "640px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 800, color: "#111111" }}>{m.date}</span>
                    {m.tag && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#8A8A8A",
                        }}
                      >
                        {m.tag}
                      </span>
                    )}
                  </div>
                  <h3 style={{ margin: "0 0 8px", fontSize: "19px", fontWeight: 700, lineHeight: 1.3, color: "#111111" }}>
                    {m.title}
                  </h3>
                  {m.summary && (
                    <p style={{ margin: "0 0 10px", fontSize: "15px", lineHeight: 1.65, color: "#4A4A4A" }}>{m.summary}</p>
                  )}
                  {m.why && (
                    <div style={{ borderLeft: "2px solid rgba(255,68,34,0.35)", paddingLeft: "12px" }}>
                      <div
                        style={{
                          fontSize: "9.5px",
                          fontWeight: 800,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: "#FF4422",
                          marginBottom: "4px",
                        }}
                      >
                        Pse ka rëndësi
                      </div>
                      <p style={{ margin: 0, fontSize: "14.5px", lineHeight: 1.6, color: "#3F3F3F" }}>{m.why}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </section>

        <section aria-label="Artikujt">
          <h2
            style={{
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#6B6B6B",
              margin: "0 0 20px",
            }}
          >
            Mbulimi i 383-shit
          </h2>

          {articles.length === 0 ? (
            <p style={{ fontSize: "15px", color: "#6B6B6B", margin: 0 }}>
              Ende nuk ka artikuj të 383-shit për këtë temë. Kronologjia më sipër mbetet konteksti.
            </p>
          ) : (
            <div style={{ display: "grid", gap: "20px" }}>
              {articles.slice(0, 24).map((a: Article) => (
                <ArticleCard key={a.slug} article={a} variant="wide" />
              ))}
            </div>
          )}
        </section>

        <div style={{ marginTop: "56px", paddingTop: "24px", borderTop: "1px solid #E8E3DB" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#6B6B6B",
              marginBottom: "12px",
            }}
          >
            Dosje të tjera
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {TOPICS.filter((t: { slug: string }) => t.slug !== topic.slug).map(
              (t: { slug: string; title: string }) => (
                <Link
                  key={t.slug}
                  href={`/dosje/${t.slug}`}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "100px",
                    border: "1px solid #E8E3DB",
                    background: "#FFFFFF",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#111111",
                    textDecoration: "none",
                  }}
                >
                  {t.title}
                </Link>
              )
            )}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
