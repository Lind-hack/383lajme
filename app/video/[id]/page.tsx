// /video/<id>: where a shared video lands — the player open on it at once,
// with the rest of the official videos to swipe on to (components/video-row).
//
// A video the feed no longer carries (it keeps a week) still plays: its title
// and channel come from YouTube's public oEmbed, and only reactions and
// comments, which follow the feed, are left out. Only a video from one of the
// official channels: 383 never presents anyone else's upload as official.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import VideoRow, { type VideoItem } from "@/components/video-row";
import { getVideoFeed, type FeedVideo } from "@/lib/video-feed";
import { videoKey } from "@/lib/video-key.mjs";
import { getCategoryColor } from "@/lib/category-colors";
import { VIDEO_CHANNELS } from "@/lib/video-channels";

export const revalidate = 900;

const ID = /^[A-Za-z0-9_-]{11}$/;

type Found = { title: string; channel: string };

async function lookUp(id: string, feed: FeedVideo[]): Promise<Found | null> {
  const inFeed = feed.find((v) => v.videoId === id);
  if (inFeed) return { title: inFeed.title, channel: inFeed.channel };
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const title = typeof json?.title === "string" ? json.title : "";
    const channel = typeof json?.author_name === "string" ? json.author_name : "";
    // oEmbed names the channel, not its id: match it against the official list.
    const official = VIDEO_CHANNELS.some((c) => c.name.toLowerCase() === channel.trim().toLowerCase());
    return title && official ? { title, channel } : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!ID.test(id)) return {};
  const found = await lookUp(id, await getVideoFeed());
  if (!found) return {};
  const image = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  return {
    title: found.title,
    description: `${found.channel} · video zyrtare në 383`,
    openGraph: { title: found.title, description: `${found.channel} · video zyrtare`, images: [image], type: "video.other" },
    twitter: { card: "summary_large_image", title: found.title, images: [image] },
  };
}

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID.test(id)) notFound();
  const feed = await getVideoFeed();
  const found = await lookUp(id, feed);
  const key = videoKey(id);
  if (!found || !key) notFound();

  const toItem = (v: FeedVideo): VideoItem => ({
    key: v.key,
    videoId: v.videoId,
    title: v.title,
    channel: v.channel,
    color: getCategoryColor(v.category),
    publishedAt: v.publishedAt,
    storySlug: v.storySlug,
  });
  const items: VideoItem[] = feed.some((v) => v.key === key)
    ? feed.map(toItem)
    : [
        { key, videoId: id, title: found.title, channel: found.channel, color: "#FF4422", publishedAt: "", storySlug: null },
        ...feed.map(toItem),
      ];

  return (
    <>
      <TextureBg />
      <Navbar />
      <main style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", padding: "calc(var(--nav-h) + 32px) 20px 64px" }}>
        <VideoRow title="Video" items={items} list="video" openKey={key} />
      </main>
      <Footer />
    </>
  );
}
