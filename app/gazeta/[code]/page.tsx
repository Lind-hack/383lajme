// A reader's front page, as they shared it: /gazeta/<code>.
//
// Personalisation lives only on the sharer's device, so this is a frozen copy
// carried in the link (lib/paper-snapshot.mjs): the stories they had that day,
// in their order, in their paper's look, under their name if they chose to
// show it. Nothing about their reading travels with it — no reasons, no read
// marks. The friend gets one clear next step: make their own.
//
// Public by link only; never indexed. Expires after 30 days.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import DardaniImage from "@/components/dardani/dardani-image";
import { loadSharedPaper } from "@/lib/paper-snapshot-server";
import { sharedTitle } from "@/lib/reader-name.mjs";
import type { Article } from "@/lib/mock-data";
import FrontPage from "@/app/per-ty/paper/front-page";
import Cover from "@/app/per-ty/paper/cover";
import PaperSection from "@/app/per-ty/paper/section";
import type { FeedArticle } from "@/app/per-ty/per-ty-feed";

export const revalidate = 3600;

const WEEKDAYS = ["e diel", "e hënë", "e martë", "e mërkurë", "e enjte", "e premte", "e shtunë"];
const MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];

/** "e shtunë, 3 tetor" for a Kosovo calendar date "2026-10-03". */
function dayLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return `${WEEKDAYS[weekday]}, ${d} ${MONTHS[m - 1]}`;
}

function toFeed(a: Article): FeedArticle {
  return {
    slug: a.slug,
    title: a.title,
    excerpt: (a.excerpt ?? "").slice(0, 240),
    category: a.category,
    city: a.city,
    source: a.source,
    publishedAt: a.publishedAt,
    imageUrl: a.imageUrl,
  };
}


export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const paper = await loadSharedPaper(code);
  const robots = { index: false, follow: false };
  if (paper.status !== "ok") return { title: "Gazeta", robots };
  const title = `${sharedTitle(paper.snapshot.name, paper.snapshot.title)} · ${dayLabel(paper.snapshot.date)}`;
  const who = paper.snapshot.name || "Një lexues";
  const description = `${paper.edition.length} lajmet që ${who} zgjodhi në 383. Bëj gazetën tënde, me lajmet që ndjek ti.`;
  const image = { url: `/api/og/gazeta/${code}?f=feed`, width: 1080, height: 1350 };
  return {
    title,
    description,
    robots,
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function SharedPaperPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const paper = await loadSharedPaper(code);
  if (paper.status === "invalid") notFound();

  return (
    <>
      <TextureBg />
      <Navbar />
      <div className="perty-page">
        {paper.status === "expired" ? (
          <div className="perty-shell perty-shell--wide perty-paper gazeta-expired">
            <DardaniImage name="sleeping" decorative className="gazeta-expired-img" />
            <h1>Kjo gazetë ka skaduar.</h1>
            <p>Gazetat e ndara mbahen 30 ditë. Por ti mund ta kesh tënden, me lajmet e sotme për ato që ndjek.</p>
            <Link href="/per-ty" className="perty-btn perty-btn--primary">
              Bëj gazetën tënde <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div
            className="perty-shell perty-shell--wide perty-paper gazeta-shared"
            data-style={paper.snapshot.style}
            data-accent={paper.snapshot.accent}
          >
            <Cover
              readOnly
              title={sharedTitle(paper.snapshot.name, paper.snapshot.title)}
              issue={0}
              date={dayLabel(paper.snapshot.date)}
              count={paper.edition.length}
              lead={toFeed(paper.edition[0])}
              leadKey={paper.snapshot.leadKey}
            />

            <aside className="gazeta-invite">
              <p>
                <strong>{paper.snapshot.name ? `${paper.snapshot.name} ta ndau gazetën e vet.` : "Dikush ta ndau gazetën e vet."}</strong>{" "}
                Në 383 secili ka gazetën e vet: zgjidh temat, njerëzit dhe qytetin, dhe çdo mëngjes të vjen e jotja.
              </p>
              <Link href="/per-ty" className="perty-btn perty-btn--primary">
                Bëj gazetën tënde <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            </aside>

            <section className="perty-ed" aria-label="Faqja e parë">
              <FrontPage items={paper.edition.map((a) => ({ article: toFeed(a), reason: "" }))} readOnly />
            </section>

            {paper.sections.length > 0 && (
              <div className="perty-secs">
                {paper.sections.map((s) => (
                  <PaperSection
                    key={s.key}
                    readOnly
                    section={{
                      key: s.key,
                      kind: s.kind,
                      title: s.title,
                      href: s.href,
                      empty: false,
                      items: s.items.map((a) => ({ article: toFeed(a), fromShelf: false })),
                    }}
                  />
                ))}
              </div>
            )}

            <div className="gazeta-cta">
              <span>Gazeta jote të pret.</span>
              <Link href="/per-ty" className="perty-btn perty-btn--primary">
                Bëj gazetën tënde <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
