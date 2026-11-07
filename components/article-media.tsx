"use client";

import { useEffect, useRef, useState } from "react";
import { embedFrame } from "@/lib/article-context.mjs";
import type { ArticleMedia } from "@/lib/mock-data";
import { CONSENT_EVENT, CONSENT_KEY } from "@/components/analytics/ga";

/** "Shfaq gjithmonë" on any post: every post loads from then on, without the stats cookies. */
const EMBEDS_KEY = "383_embeds";

/**
 * A post's player sets its platform's own cookies, so it loads only for readers who
 * accepted cookies, who chose to always see posts, or who tap this one.
 */
function postsAllowed() {
  try {
    return localStorage.getItem(CONSENT_KEY) === "granted" || localStorage.getItem(EMBEDS_KEY) === "always";
  } catch {
    return false;
  }
}

const PLATFORM: Record<string, { name: string; width: number; height: number; origin?: string }> = {
  instagram: { name: "Instagram", width: 480, height: 680, origin: "https://www.instagram.com" },
  x: { name: "X", width: 550, height: 420, origin: "https://platform.twitter.com" },
  tiktok: { name: "TikTok", width: 340, height: 605 },
};

/** One drawn mark per platform, same 24-unit grid and weight, so a reader sees where a post lives at a glance. */
function PlatformMark({ platform }: { platform: string }) {
  const common = { viewBox: "0 0 24 24", "aria-hidden": true, focusable: false } as const;
  if (platform === "instagram") return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
  );
  if (platform === "x") return (
    <svg {...common} fill="currentColor"><path d="M17.7 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L1.8 3h6.4l4.4 5.9L17.7 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11 14.5Z" /></svg>
  );
  if (platform === "tiktok") return (
    <svg {...common} fill="currentColor"><path d="M16.6 3c.4 2.2 1.9 3.8 4.1 4v3.1a7.3 7.3 0 0 1-4-1.3v6.4a6 6 0 1 1-6-6c.3 0 .7 0 1 .1v3.2a2.9 2.9 0 1 0 2 2.7V3h2.9Z" /></svg>
  );
  return (
    <svg {...common} fill="currentColor"><path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.6 12c0 1.3.1 2.5.4 3.8a3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1c.3-1.3.4-2.5.4-3.8s-.1-2.5-.4-3.8ZM10 15.2V8.8l5.2 3.2-5.2 3.2Z" /></svg>
  );
}

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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => { if (postsAllowed()) setOpen(true); };
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  const always = () => {
    try { localStorage.setItem(EMBEDS_KEY, "always"); } catch { /* Storage blocked: this post still opens. */ }
    setOpen(true);
    window.dispatchEvent(new Event(CONSENT_EVENT));
  };

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

  const name = platform?.name ?? "YouTube";
  // oEmbed gives the account's display name ("Reform UK"), not its handle, so no "@" in front.
  const who = (item.author ?? "").replace(/^@/, "");
  const title = item.caption || `Postim nga ${who || name}`;
  const thing = item.platform === "youtube" || item.platform === "tiktok" ? "videon" : "postimin";
  return (
    <figure className={`ctx-media${platform ? "" : " ctx-media-wide"}`}>
      {!open ? (
        <div className={`ctx-gate${platform ? "" : " ctx-gate-wide"}`} style={platform ? { maxWidth: platform.width } : undefined}>
          <span className="ctx-gate-mark"><PlatformMark platform={item.platform} /></span>
          <p className="ctx-gate-title">{who ? `${who} në ${name}` : `Postim në ${name}`}</p>
          <p className="ctx-gate-note">Ky {thing === "videon" ? "video" : "postim"} hapet nga {name}, që vendos cookies të veta.</p>
          <div className="ctx-gate-actions">
            <button type="button" className="ctx-gate-show" onClick={() => setOpen(true)}>Shfaq {thing}</button>
            <button type="button" className="ctx-gate-always" onClick={always}>Shfaq gjithmonë</button>
          </div>
        </div>
      ) : (
      <div className="ctx-media-frame" style={platform
        ? { maxWidth: platform.width }
        : { position: "relative", aspectRatio: "16 / 9", background: "#111", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
        <iframe
          ref={frame}
          src={embedFrame(item)}
          title={title}
          loading="lazy"
          allow="encrypted-media; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          style={platform
            ? { height, background: "#fff", borderRadius: "var(--radius-sm)" }
            : { position: "absolute", inset: 0, height: "100%" }}
        />
      </div>
      )}
      <figcaption>
        {item.caption && <span className="ctx-media-caption">{item.caption}</span>}
        <a className="ctx-media-source" href={item.url} target="_blank" rel="noopener noreferrer">
          <PlatformMark platform={item.platform} />
          {who ? `${who} në ${name}` : `Shiko në ${name}`}
        </a>
      </figcaption>
    </figure>
  );
}

function Photo({ item }: { item: Extract<ArticleMedia, { kind: "photo" }> }) {
  // A Commons file can be renamed or deleted after we stored it: a broken image never reaches the reader.
  const [failed, setFailed] = useState(false);
  const label = item.who ? `${item.who}, foto nga arkivi` : "Foto nga arkivi";
  // Stored as "Creator · Licence"; read as one credit line.
  const credit = (item.credit ?? "").split(" · ").join(", ");
  if (failed) return null;
  return (
    <figure className="ctx-media ctx-media-photo">
      {/* Commons photos come in any shape: the frame follows the photo, capped so a portrait never fills the screen. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.src} alt={label} loading="lazy" decoding="async" onError={() => setFailed(true)} />
      <figcaption>
        <span className="ctx-media-caption">{label}</span>
        <a className="ctx-media-source" href={item.page} target="_blank" rel="noopener noreferrer">{credit}</a>
      </figcaption>
    </figure>
  );
}

/** A post or a licensed photo, placed in the text beside the paragraph it explains. */
export default function ArticleMediaBlock({ item }: { item: ArticleMedia }) {
  return item.kind === "embed" ? <Embed item={item} /> : <Photo item={item} />;
}
