import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import DosjeSection from "@/components/dosje-section";
import { getArticles } from "@/lib/db";
import { dosjeFor, dosjeTopicRef, listAllDosjeTopics } from "@/lib/dosje-entries";

const SITE = "https://www.383ks.com";

/**
 * The full dossier for one standing topic: authored history, then every article
 * 383 has published on the subject. The rail beside an article is the compact
 * view of this page; this is where a reader lands when the compact view is not
 * enough.
 */

/**
 * A dossier is history, and history does not change every fifteen minutes.
 *
 * This sat at 900s while every other page on the site used an hour or two,
 * and it is the most expensive page here: four hundred articles fetched on
 * each rebuild, across five dossiers. That is where the database egress
 * allowance went.
 *
 * Twelve hours is safe rather than merely cheap, because publishing does not
 * wait for it: approving a moment or a file calls revalidatePath("/dosje") and
 * the page rebuilds immediately. This interval only governs how quickly an
 * unrelated new article joins a dossier's recent coverage, which nobody is
 * waiting on.
 */
export const revalidate = 43200;

/**
 * Prebuild every dossier both halves know about. dynamicParams stays on, so a
 * subject approved after this build still renders on first request rather than
 * waiting for a deploy — which is the point of keeping the topic list in the
 * database.
 */
export async function generateStaticParams() {
  return (await listAllDosjeTopics()).map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const topic = await dosjeTopicRef(slug);
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
  // Resolved against the database and the file together. Gating on the file
  // alone 404'd the twelve subjects migration 0064 added, however thoroughly
  // they had been approved. The whole list is read here rather than through
  // dosjeTopicRef so the rail at the foot of the page costs no second query.
  const topics = await listAllDosjeTopics();
  const topic = topics.find((t) => t.slug === slug);
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
          {/* The rail pointed sideways and never up; /dosje is the address the
              feature never had. */}
          <div style={{ marginBottom: "14px" }}>
            <Link
              href="/dosje"
              style={{
                font: "500 13px var(--font-garamond), Georgia, serif",
                color: "#a9362d",
              }}
            >
              Të gjitha dosjet →
            </Link>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "9px" }}>
            {topics.filter((t) => t.slug !== topic.slug).map((t) => (
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
