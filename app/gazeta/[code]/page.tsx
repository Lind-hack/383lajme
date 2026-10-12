// A reader's front page, as they shared it: /gazeta/<code>.
//
// Personalisation lives only on the sharer's device, so this is a frozen copy
// carried in the link (lib/paper-snapshot.mjs): the stories they had that day,
// in their order, in their kind of paper, turned page by page like theirs
// (./shared-paper.tsx), under their name if they chose to show it. Nothing
// about their reading travels with it — no reasons, no read marks. The friend gets one clear next step: make their own.
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
import { getCoverArtMap } from "@/lib/cover-art-server";
import { sharedTitle } from "@/lib/reader-name.mjs";
import type { Article } from "@/lib/mock-data";
import type { FeedArticle } from "@/app/per-ty/per-ty-feed";
import SharedPaper from "./shared-paper";

export const revalidate = 3600;

/** The host that answers; www redirects here, and not every link-preview crawler follows a redirect for the picture. */
const ORIGIN = "https://383ks.com";

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
  // What a chat app shows before anyone taps: whose paper, what is in it today.
  const name = paper.snapshot.name;
  const paperName = sharedTitle(name, paper.snapshot.title);
  const title = name ? `${name} të ndau gazetën e vet: ${paperName}` : `Të ndanë një gazetë personale: ${paperName}`;
  const heads = paper.edition.slice(0, 3).map((a) => a.title.replace(/\s+/g, " ").trim());
  const description = `${dayLabel(paper.snapshot.date)} · ${paper.edition.length === 1 ? "1 lajm" : `${paper.edition.length} lajme`}. ${heads.join(" · ")}`.slice(0, 280);
  const url = `${ORIGIN}/gazeta/${code}`;
  const image = { url: `${ORIGIN}/api/og/gazeta/${code}`, width: 1200, height: 630, type: "image/jpeg", alt: `${paperName}, faqja e parë` };
  return {
    title,
    description,
    robots,
    alternates: { canonical: url },
    openGraph: { type: "article", url, siteName: "383", title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function SharedPaperPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const paper = await loadSharedPaper(code);
  if (paper.status === "invalid") notFound();
  const covers = paper.status === "ok" ? await getCoverArtMap() : {};

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
          <SharedPaper
            title={sharedTitle(paper.snapshot.name, paper.snapshot.title)}
            sharer={paper.snapshot.name}
            date={dayLabel(paper.snapshot.date)}
            year={Number(paper.snapshot.date.slice(0, 4))}
            look={paper.snapshot.look}
            edition={paper.edition.map((a) => ({ ...toFeed(a), coverArt: covers[a.slug] ?? null }))}
            sections={paper.sections.map((s) => ({ key: s.key, kind: s.kind, title: s.title, href: s.href, items: s.items.map(toFeed) }))}
          />
        )}
      </div>
      <Footer />
    </>
  );
}
