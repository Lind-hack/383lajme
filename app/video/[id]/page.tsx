// /video/<slug>: where a shared clip lands — today's video edition open on
// that story's clip, with the rest of the edition to go on to
// (components/video-row). A clip from an earlier edition sends the reader to
// its story; anything else (links to the old video feed among them) to
// today's edition.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import VideoRow from "@/components/video-row";
import { getEdition, getViral } from "@/lib/video-edition";
import { getArticleBySlug } from "@/lib/db";

export const revalidate = 300;

/** The edition or "Virale sot", whichever holds this clip. */
async function rowWith(id: string) {
  const [edition, viral] = await Promise.all([getEdition(), getViral()]);
  return [edition, viral].find((row) => row?.clips.some((c) => c.slug === id)) ?? null;
}

const SLUG = /^[a-z0-9-]{3,160}$/;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const clip = (await rowWith(id))?.clips.find((c) => c.slug === id);
  if (!clip) return {};
  const description = clip.source
    ? `Video nga @${clip.source.author}${clip.source.platform ? ` · ${clip.source.platform}` : ""}, në Virale sot të 383.`
    : `${clip.category} · Edicioni video i 383: lajmet kryesore të sotme, me zë, në pak minuta.`;
  // A viral find has no story photo: its own thumbnail.
  const image = clip.image || clip.video?.thumb || "";
  return {
    title: clip.title,
    description,
    openGraph: { title: clip.title, description, images: image ? [image] : [], type: "video.other" },
    twitter: { card: "summary_large_image", title: clip.title, images: image ? [image] : [] },
  };
}

export default async function VideoClipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const edition = await rowWith(id);
  if (!edition) {
    if (SLUG.test(id) && (await getArticleBySlug(id))) redirect(`/article/${id}`);
    redirect("/video");
  }

  return (
    <>
      <TextureBg />
      <Navbar />
      <main style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", padding: "calc(var(--nav-h) + 32px) 20px 64px" }}>
        <VideoRow edition={edition} list="share" openSlug={id} />
      </main>
      <Footer />
    </>
  );
}
