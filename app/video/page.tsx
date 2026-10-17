// /video: today's video edition, the link "Ndaje edicionin" shares. It opens
// on the first clip; with no edition yet today, it says when the next comes.

import type { Metadata } from "next";
import Link from "next/link";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import VideoRow from "@/components/video-row";
import { getEdition } from "@/lib/video-edition";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const edition = await getEdition();
  const image = edition?.clips.find((c) => c.image)?.image;
  const title = "Edicioni video i 383";
  const description = edition
    ? `${edition.clips.length} lajmet kryesore të sotme, me zë, në pak minuta. Kur mbaron, je në dijeni.`
    : "Lajmet kryesore të ditës, me zë, në pak minuta.";
  return {
    title,
    description,
    openGraph: { title, description, images: image ? [image] : [], type: "video.other" },
    twitter: { card: "summary_large_image", title, images: image ? [image] : [] },
  };
}

export default async function VideoEditionPage() {
  const edition = await getEdition();
  return (
    <>
      <TextureBg />
      <Navbar />
      <main style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", padding: "calc(var(--nav-h) + 32px) 20px 64px" }}>
        {edition ? (
          <VideoRow edition={edition} list="video" openSlug={edition.clips[0]?.slug} />
        ) : (
          <p style={{ maxWidth: "60ch", fontSize: 16, lineHeight: 1.6 }}>
            Edicioni video i sotëm ende nuk është gati. Vjen çdo mëngjes në 07:00.{" "}
            <Link href="/">Lajmet e fundit</Link>
          </p>
        )}
      </main>
      <Footer />
    </>
  );
}
