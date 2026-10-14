"use client";

// A row of video cards — the homepage's "Video" and each section's own — and
// the player they open.
//
// Only real clips: stories the pipeline gave an official video
// (scripts/news_video_policy.py — NATO, UEFA, the government's own channel),
// never a photo made to move. The card is the clip's own poster; tapping it
// opens a full-screen player that plays at once (the tap is the permission
// to play with sound), with the next and previous clips one swipe, arrow or
// key away and the full story one tap away.
//
// The player is YouTube's privacy-enhanced embed (youtube-nocookie.com), the
// same one the article page uses; nothing loads from YouTube until a card is
// opened except the poster images.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Play, X } from "lucide-react";
import TimeAgo from "@/components/time-ago";
import { track } from "@/lib/analytics";
import "./video-row.css";

export type VideoItem = {
  slug: string;
  title: string;
  videoId: string;
  publishedAt: string;
  /** The chip on the card: a city ("Prishtinë") or the story's section. */
  badge: string;
  /** A city's emblem, when the badge is a city. */
  emblem?: string | null;
  /** The badge dot's colour (the section's), when there is no emblem. */
  color?: string;
};

/** The clip's own poster: 1280×720 when YouTube made one, else the 480×360 that every video has. */
function poster(id: string, big = true) {
  return `https://i.ytimg.com/vi/${id}/${big ? "hq720" : "hqdefault"}.jpg`;
}

export default function VideoRow({
  title,
  items,
  list,
  accent = "#FF4422",
}: {
  title: string;
  items: VideoItem[];
  /** Where the row is, for analytics: "home" or the section's slug. */
  list: string;
  accent?: string;
}) {
  const trackRef = useRef<HTMLUListElement | null>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(update, [update]);

  const step = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };

  if (items.length === 0) return null;

  return (
    <section className="vr" aria-labelledby={`vr-${list}`} style={{ ["--vr-accent" as string]: accent }}>
      <div className="vr-head">
        <h2 id={`vr-${list}`} className="vr-title">
          <span className="vr-title-icon" aria-hidden="true">
            <Play size={14} strokeWidth={0} fill="currentColor" />
          </span>
          {title}
        </h2>
        <span className="vr-nav">
          <button type="button" onClick={() => step(-1)} disabled={edge.start} aria-label="Videot e mëparshme">
            <ChevronLeft size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => step(1)} disabled={edge.end} aria-label="Videot e tjera">
            <ChevronRight size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </span>
      </div>
      <ul className="vr-track" ref={trackRef} onScroll={update}>
        {items.map((item, i) => (
          <li key={item.slug}>
            <button
              type="button"
              className="vr-card"
              onClick={(e) => {
                opener.current = e.currentTarget;
                setOpen(i);
                track("video_open", { slug: item.slug, position: i + 1, list });
              }}
              aria-label={`Shiko videon: ${item.title}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own poster, already sized */}
              <img
                className="vr-poster"
                src={poster(item.videoId)}
                alt=""
                loading={i < 3 ? "eager" : "lazy"}
                decoding="async"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.dataset.fallback) {
                    img.dataset.fallback = "1";
                    img.src = poster(item.videoId, false);
                  }
                }}
              />
              <span className="vr-badge">
                {item.emblem ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.emblem} alt="" width={20} height={20} loading="lazy" decoding="async" />
                ) : (
                  <i style={{ background: item.color ?? accent }} aria-hidden="true" />
                )}
                {item.badge}
              </span>
              <span className="vr-play" aria-hidden="true">
                <Play size={22} strokeWidth={0} fill="currentColor" />
              </span>
              <span className="vr-card-title">{item.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {open !== null && (
        <Player
          items={items}
          index={open}
          list={list}
          onIndex={setOpen}
          onClose={() => {
            setOpen(null);
            opener.current?.focus();
          }}
        />
      )}
    </section>
  );
}

/**
 * Full screen on a phone, a dark stage on a desktop. Swipe up/down (or ←/→,
 * ↑/↓, the buttons) for the next clip; Esc or ✕ closes. Only the clip on view
 * is loaded.
 */
function Player({
  items,
  index,
  list,
  onIndex,
  onClose,
}: {
  items: VideoItem[];
  index: number;
  list: string;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const item = items[index];
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const go = useCallback(
    (dir: 1 | -1) => {
      const next = index + dir;
      if (next < 0 || next >= items.length) return;
      onIndex(next);
      track("video_next", { slug: items[next].slug, position: next + 1, list, dir });
    },
    [index, items, list, onIndex]
  );

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (mounted) closeRef.current?.focus();
  }, [mounted]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        // Keep Tab inside the player: it covers the page.
        const els = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], iframe") ?? [])];
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      } else if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") go(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  if (!mounted || !item) return null;

  return createPortal(
    <div
      ref={dialogRef}
      className="vr-player"
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = t ? { x: t.clientX, y: t.clientY } : null;
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        const t = e.changedTouches[0];
        touch.current = null;
        if (!start || !t) return;
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        // A clear flick, mostly in one direction; taps and drags inside the
        // video stay the video's.
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 60) return;
        if (Math.abs(dy) > Math.abs(dx)) go(dy < 0 ? 1 : -1);
        else go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="vr-player-top">
        <span className="vr-player-count" aria-live="polite">
          {index + 1} / {items.length}
        </span>
        <span className="vr-player-phone-nav">
          <button type="button" className="vr-player-btn" onClick={() => go(-1)} disabled={index === 0} aria-label="Videoja e mëparshme">
            <ChevronUp size={22} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="vr-player-btn"
            onClick={() => go(1)}
            disabled={index === items.length - 1}
            aria-label="Videoja tjetër"
          >
            <ChevronDown size={22} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </span>
        <button ref={closeRef} type="button" className="vr-player-btn" onClick={onClose} aria-label="Mbyll videon">
          <X size={22} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>

      <div className="vr-player-stage">
        <button
          type="button"
          className="vr-player-btn vr-player-side vr-player-prev"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="Videoja e mëparshme"
        >
          <ChevronLeft size={26} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <div className="vr-player-frame">
          <iframe
            key={item.videoId}
            src={`https://www.youtube-nocookie.com/embed/${item.videoId}?autoplay=1&playsinline=1&rel=0`}
            title={item.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
        <button
          type="button"
          className="vr-player-btn vr-player-side vr-player-next"
          onClick={() => go(1)}
          disabled={index === items.length - 1}
          aria-label="Videoja tjetër"
        >
          <ChevronRight size={26} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>

      <div className="vr-player-info">
        <span className="vr-player-meta">
          {item.badge} · <TimeAgo iso={item.publishedAt} />
        </span>
        <h3 className="vr-player-title">{item.title}</h3>
        <div className="vr-player-actions">
          <Link
            href={`/article/${item.slug}`}
            className="vr-player-read"
            onClick={() => track("video_read", { slug: item.slug, position: index + 1, list })}
          >
            Lexo lajmin <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
          </Link>
          {/* Some owners allow the embed check but block other sites at play
              time; YouTube itself always plays it. */}
          <a
            href={`https://www.youtube.com/watch?v=${item.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="vr-player-yt"
          >
            Shiko në YouTube
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
