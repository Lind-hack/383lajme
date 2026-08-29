import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import DosjeSection from "@/components/dosje-section";
import { getArticles } from "@/lib/db";
import { TOPICS, topicBySlug, articlesForTopic } from "@/lib/topics.mjs";
import { dosjeFor } from "@/lib/dosje-entries";

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

  // Cards only on this page, so the article bodies are left in the database.
  const all = await getArticles(400, undefined, { withBody: false });
  // Approved rows when this dossier has been published, the hand-written file
  // until then. Never the two mixed: an unsourced line beside a cited one
  // borrows authority it has not earned.
  const dosje = await dosjeFor(slug, all);
  const timeline = dosje?.entries ?? [];

  return (
    <>
      <TextureBg />
      <Navbar />

      {/* The page is the card, given room. It used to be a second, thinner
          design of the same material, which meant two places to keep in step
          and one of them always lagging. */}
      <main className="dosje-page">
        <DosjeSection
          topicSlug={topic.slug}
          topicTitle={dosje?.title ?? topic.title}
          blurb={dosje?.blurb ?? topic.blurb}
          videos={dosje?.videos ?? []}
          entries={timeline}
          sourced={dosje?.sourced ?? false}
        />

        <div style={{ marginTop: "44px", paddingTop: "24px", borderTop: "1px solid rgba(228,50,43,.28)" }}>
          <div
            style={{
              font: "600 10px var(--font-manrope), sans-serif",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(43,37,33,.5)",
              marginBottom: "14px",
            }}
          >
            Dosje të tjera
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "9px" }}>
            {TOPICS.filter((t: { slug: string }) => t.slug !== topic.slug).map((t: { slug: string; title: string }) => (
              <Link
                key={t.slug}
                href={`/dosje/${t.slug}`}
                style={{
                  padding: "9px 15px",
                  borderRadius: "100px",
                  border: "1px solid rgba(43,37,33,.2)",
                  background: "#FAF6F1",
                  font: "600 13px var(--font-garamond), Georgia, serif",
                  color: "#241F1B",
                  textDecoration: "none",
                }}
              >
                {t.title}
              </Link>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
