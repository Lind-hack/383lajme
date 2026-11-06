"use client";

import { useEffect, useRef, useState } from "react";
import { embedFrame } from "@/lib/article-context.mjs";
import type { ArticleMedia } from "@/lib/mock-data";

const PLATFORM: Record<string, { name: string; width: number; height: number; origin?: string }> = {
  instagram: { name: "Instagram", width: 480, height: 680, origin: "https://www.instagram.com" },
  x: { name: "X", width: 550, height: 420, origin: "https://platform.twitter.com" },
  tiktok: { name: "TikTok", width: 340, height: 605 },
};

const caption = { fontSize: "13px", lineHeight: 1.6, color: "var(--theme-muted, #59544C)", margin: "10px 0 0" } as const;

/** Instagram and X report their real height; without it a post is cut off or leaves a gap. */
function reportedHeight(data: unknown): number | undefined {
  let message = data;
  if (typeof message === "string") {
    try { message = JSON.parse(message); } catch { return undefined; }
  }
  const row = message as { type?: string; details?: { height?: unknown }; "twttr.embed"?: { method?: string; params?: { height?: unknown }[] } } | null;
  const value = row?.type === "MEASURE" ? row.details?.height
    : row?.["twttr.embed"]?.method === "twttr.private.resize" ? row["twttr.embed"].params?.[0]?.height
    : undefined;
  return typeof value === "number" && value > 100 && value < 3000 ? value : undefined;
}

function Embed({ item }: { item: Extract<ArticleMedia, { kind: "embed" }> }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const platform = PLATFORM[item.platform];
  const [height, setHeight] = useState(platform?.height);

  useEffect(() => {
    if (!platform?.origin) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== platform.origin || event.source !== frame.current?.contentWindow) return;
      const next = reportedHeight(event.data);
      if (next) setHeight(next);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [platform]);

  const title = item.caption || `Postim nga ${item.author || (platform?.name ?? "YouTube")}`;
  const name = platform?.name ?? "YouTube";
  return (
    <figure style={{ margin: "4px 0 32px" }}>
      <div style={platform
        ? { maxWidth: platform.width, margin: "0 auto" }
        : { position: "relative", aspectRatio: "16 / 9", background: "#111" }}>
        <iframe
          ref={frame}
          src={embedFrame(item)}
          title={title}
          loading="lazy"
          allow="encrypted-media; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          style={platform
            ? { display: "block", width: "100%", height, border: 0, background: "#fff", borderRadius: "var(--radius-sm)" }
            : { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      </div>
      <figcaption style={{ ...caption, textAlign: platform ? "center" : "left" }}>
        {item.caption && <>{item.caption} · </>}
        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
          {item.author ? `${item.platform === "youtube" ? item.author : `@${item.author.replace(/^@/, "")}`} në ${name}` : `Shiko në ${name}`}
        </a>
      </figcaption>
    </figure>
  );
}

function Photo({ item }: { item: Extract<ArticleMedia, { kind: "photo" }> }) {
  const alt = item.who ? `Foto nga arkivi: ${item.who}` : "Foto nga arkivi";
  return (
    <figure style={{ margin: "4px 0 32px" }}>
      {/* Commons photos come in any shape, so the frame follows the photo. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.src} alt={alt} loading="lazy" decoding="async" style={{ display: "block", width: "100%", height: "auto", borderRadius: "var(--radius-sm)" }} />
      <figcaption style={caption}>
        {alt}. <a href={item.page} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>Foto: {item.credit}</a>
      </figcaption>
    </figure>
  );
}

/** A post or a licensed photo, placed in the text beside the paragraph it explains. */
export default function ArticleMediaBlock({ item }: { item: ArticleMedia }) {
  return item.kind === "embed" ? <Embed item={item} /> : <Photo item={item} />;
}
