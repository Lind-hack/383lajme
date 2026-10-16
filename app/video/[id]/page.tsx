// /video/<id>: where a shared video lands — the player open on it at once,
// with the rest of the official videos to swipe on to (components/video-row).
// <id> is a YouTube id, or "tt-" and a TikTok id.
//
// A video the feed no longer carries (it keeps a week) still plays: its title
// and channel come from YouTube's or TikTok's public oEmbed, and only
// reactions and comments, which follow the feed, are left out. Only a video
// from one of the official channels (for TikTok, an account the feed carries):
// 383 never presents anyone else's upload as official.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TextureBg from "@/components/aurora-bg";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import VideoRow, { type VideoItem } from "@/components/video-row";
import { getVideoFeed, toVideoItem, type FeedVideo } from "@/lib/video-feed";
import { tiktokKey, videoKey } from "@/lib/video-key.mjs";
import { getCategoryColor } from "@/lib/category-colors";
import { VIDEO_CHANNELS } from "@/lib/video-channels";

export const revalidate = 900;

const ID = /^[A-Za-z0-9_-]{11}$/;
const TT = /^tt-(\d{15,22})$/;

type Found = { title: string; channel: string; image: string; url: string };

/** The param as a platform and id, or null. */
function parse(param: string): { platform: "youtube" | "tiktok"; id: string; key: string } | null {
  const tt = TT.exec(param);
  if (tt) return { platform: "tiktok", id: tt[1], key: tiktokKey(tt[1]) as string };
  const key = ID.test(param) ? videoKey(param) : null;
  return key ? { platform: "youtube", id: param, key } : null;
}

async function lookUpTikTok(id: string, feed: FeedVideo[]): Promise<Found | null> {
  const inFeed = feed.find((v) => v.platform === "tiktok" && v.videoId === id);
  if (inFeed) return { title: inFeed.title, channel: inFeed.channel, image: inFeed.cover ?? "", url: inFeed.url };
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(`https://www.tiktok.com/@_/video/${id}`)}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const handle = typeof json?.author_unique_id === "string" ? json.author_unique_id.toLowerCase() : "";
    // Official only: an account whose videos the editor carries now.
    const account = feed.find((v) => v.platform === "tiktok" && v.url.toLowerCase().includes(`/@${handle}/`));
    const title = typeof json?.title === "string" ? json.title.slice(0, 120) : "";
    if (!handle || !account || !title) return null;
    return {
      title,
      channel: account.channel,
      image: typeof json?.thumbnail_url === "string" ? json.thumbnail_url : "",
      url: `https://www.tiktok.com/@${handle}/video/${id}`,
    };
  } catch {
    return null;
  }
}

async function lookUp(id: string, feed: FeedVideo[]): Promise<Found | null> {
  const inFeed = feed.find((v) => v.platform === "youtube" && v.videoId === id);
  const image = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const url = `https://www.youtube.com/shorts/${id}`;
  if (inFeed) return { title: inFeed.title, channel: inFeed.channel, image, url };
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
    return title && official ? { title, channel, image, url } : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ref = parse((await params).id);
  if (!ref) return {};
  const feed = await getVideoFeed();
  const found = ref.platform === "tiktok" ? await lookUpTikTok(ref.id, feed) : await lookUp(ref.id, feed);
  if (!found) return {};
  const image = found.image;
  return {
    title: found.title,
    description: `${found.channel} · video zyrtare në 383`,
    openGraph: { title: found.title, description: `${found.channel} · video zyrtare`, images: image ? [image] : [], type: "video.other" },
    twitter: { card: "summary_large_image", title: found.title, images: image ? [image] : [] },
  };
}

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const ref = parse((await params).id);
  if (!ref) notFound();
  const feed = await getVideoFeed();
  const found = ref.platform === "tiktok" ? await lookUpTikTok(ref.id, feed) : await lookUp(ref.id, feed);
  if (!found) notFound();
  const { key } = ref;

  const toItem = (v: FeedVideo): VideoItem => toVideoItem(v, getCategoryColor(v.category));
  const items: VideoItem[] = feed.some((v) => v.key === key)
    ? feed.map(toItem)
    : [
        {
          key,
          platform: ref.platform,
          videoId: ref.id,
          title: found.title,
          channel: found.channel,
          color: "#FF4422",
          publishedAt: "",
          storySlug: null,
          views: 0,
          likes: 0,
          outlier: null,
          cover: ref.platform === "tiktok" ? found.image || null : null,
          url: found.url,
        },
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
