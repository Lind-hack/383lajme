"use client";

// A row of official videos — the homepage's "Video" and each section's own —
// and the full-screen player they open.
//
// Only official channels' own uploads (lib/video-feed: NATO, the EU, Kurti,
// UEFA, the Premier League, Apple …), never an outlet's and never a photo
// made to move. When the row comes into view the first card starts playing,
// muted, in place of its poster (and on a desktop, whichever card the pointer
// is over), so the row reads as video before anyone taps. Tapping a card
// opens the player: the whole video, with sound (the tap is the permission),
// the next and previous one a swipe, arrow or key away, and beside it 👍
// Pëlqej, the reactions, comments and sharing — the same reactions and
// comments a story has, kept under the video's own key (lib/video-key).
//
// YouTube's privacy-enhanced player (youtube-nocookie.com) throughout.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, MessageCircle, Play, Share2, SmilePlus, X } from "lucide-react";
import TimeAgo from "@/components/time-ago";
import CommentsSheet from "@/components/comments/comments-sheet";
import { useCommentThread } from "@/components/comments/use-comment-thread";
import { ReactionsProvider, useReactions } from "@/app/per-ty/paper/reactions";
import { STORY_REACTIONS, type StoryReactionKey } from "@/lib/story-reactions.mjs";
import { track } from "@/lib/analytics";
import "./video-row.css";

export type VideoItem = {
  /** Where its reactions and comments live: lib/video-key. */
  key: string;
  videoId: string;
  title: string;
  /** The official channel: "NATO", "UEFA", "Albin Kurti". */
  channel: string;
  /** The section's colour, for the chip's dot. */
  color: string;
  publishedAt: string;
  /** The 383 story this is the clip of, if any. */
  storySlug?: string | null;
};

/** "Pëlqej" is the 👍 reaction: one tap, the commonest one. */
const LIKE: StoryReactionKey = "dakord";
const SITE = "https://383ks.com";

/** The clip's own poster: 1280×720 when YouTube made one, else the 480×360 every video has. */
function poster(id: string, big = true) {
  return `https://i.ytimg.com/vi/${id}/${big ? "hq720" : "hqdefault"}.jpg`;
}

/** A muted, chromeless, looping preview of the first seconds. */
function previewSrc(id: string) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&playsinline=1&loop=1&playlist=${id}&rel=0&disablekb=1&iv_load_policy=3&fs=0`;
}

/** No previews for a reader who asked for less motion or less data. */
function previewsAllowed() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !conn?.saveData;
}

function compact(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(".0", "")}k` : String(n);
}

export default function VideoRow({
  title,
  items,
  list,
  accent = "#FF4422",
  openKey,
}: {
  title: string;
  items: VideoItem[];
  /** Where the row is, for analytics: "home", a section's slug, or "video". */
  list: string;
  accent?: string;
  /** Open the player on this video at once (the /video/<id> page). */
  openKey?: string;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLUListElement | null>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const [open, setOpen] = useState<number | null>(() => {
    const i = openKey ? items.findIndex((v) => v.key === openKey) : -1;
    return i >= 0 ? i : null;
  });
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [allowed, setAllowed] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(update, [update]);

  useEffect(() => {
    setAllowed(previewsAllowed());
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(Boolean(e?.isIntersecting)), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const step = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };

  if (items.length === 0) return null;
  // One preview at a time: the card under the pointer, else the first. None
  // while the player is open.
  const previewing = allowed && inView && open === null ? (hovered ?? 0) : -1;

  return (
    <section ref={sectionRef} className="vr" aria-labelledby={`vr-${list}`} style={{ ["--vr-accent" as string]: accent }}>
      <div className="vr-head">
        <h2 id={`vr-${list}`} className="vr-title">
          <span className="vr-title-icon" aria-hidden="true">
            <Play size={14} strokeWidth={0} fill="currentColor" />
          </span>
          {title}
          <span className="vr-title-sub">Nga kanalet zyrtare</span>
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
          <li key={item.key} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered((h) => (h === i ? null : h))}>
            <button
              type="button"
              className="vr-card"
              onClick={(e) => {
                opener.current = e.currentTarget;
                setOpen(i);
                track("video_open", { video: item.videoId, channel: item.channel, position: i + 1, list });
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
              {previewing === i && <Preview id={item.videoId} />}
              <span className="vr-badge">
                <i style={{ background: item.color }} aria-hidden="true" />
                {item.channel}
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
        <ReactionsProvider slugs={items.map((v) => v.key)}>
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
        </ReactionsProvider>
      )}
    </section>
  );
}

/** The card's muted preview, faded in over the poster once it is playing. */
function Preview({ id }: { id: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // The embed gives no "playing" event without its JS API; a moment after
    // load is when it has started.
    const t = window.setTimeout(() => setReady(true), 1800);
    return () => window.clearTimeout(t);
  }, [id]);
  return (
    <span className="vr-preview" data-ready={ready || undefined} aria-hidden="true">
      <iframe src={previewSrc(id)} title="" tabIndex={-1} allow="autoplay; encrypted-media" />
    </span>
  );
}

/**
 * Full screen on a phone, a dark stage on a desktop. Swipe (or ←/→, ↑/↓, the
 * buttons) for the next video; Esc or ✕ closes. Only the video on view loads.
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
  // While the comments sheet is open, keys and swipes belong to it.
  const [talking, setTalking] = useState(false);

  const go = useCallback(
    (dir: 1 | -1) => {
      const next = index + dir;
      if (next < 0 || next >= items.length) return;
      onIndex(next);
      track("video_next", { video: items[next].videoId, position: next + 1, list, dir });
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
    if (talking) return;
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
  }, [go, onClose, talking]);

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
        if (!start || !t || talking) return;
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        // A clear flick, mostly one way; taps inside the video stay the video's.
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
          <i style={{ background: item.color }} aria-hidden="true" />
          {item.channel} · kanali zyrtar
          {item.publishedAt && (
            <>
              {" · "}
              <TimeAgo iso={item.publishedAt} />
            </>
          )}
        </span>
        <h3 className="vr-player-title">{item.title}</h3>
        <Actions key={item.key} item={item} list={list} position={index + 1} onTalk={setTalking} />
      </div>
    </div>,
    document.body
  );
}

/** 👍 Pëlqej, the reactions, comments, share, and the way to the story or YouTube. */
function Actions({
  item,
  list,
  position,
  onTalk,
}: {
  item: VideoItem;
  list: string;
  position: number;
  onTalk: (open: boolean) => void;
}) {
  const reactions = useReactions();
  const thread = useCommentThread(item.key, (n) => reactions.setComments(item.key, n));
  const [picking, setPicking] = useState(false);
  const [talking, setTalking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const tally = reactions.tallies[item.key] ?? {};
  const mine = reactions.mine[item.key];
  const likes = tally[LIKE] ?? 0;
  const total = Object.values(tally).reduce((a: number, b) => a + (Number(b) || 0), 0);
  const comments = reactions.comments[item.key] ?? 0;

  useEffect(() => {
    setPicking(false);
    setNote(null);
  }, [item.key]);

  const react = (key: StoryReactionKey) => {
    reactions.react(item.key, key);
    setPicking(false);
    track("video_react", { video: item.videoId, reaction: key, position, list });
  };

  const talk = (open: boolean) => {
    setTalking(open);
    onTalk(open);
    if (open) track("video_comments", { video: item.videoId, position, list });
  };

  const share = async () => {
    const url = `${SITE}/video/${item.videoId}`;
    track("video_share", { video: item.videoId, position, list });
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote("Lidhja u kopjua.");
    } catch {
      // Cancelled, or no clipboard: nothing to say.
    }
  };

  return (
    <>
      <div className="vr-acts">
        {reactions.ok && (
          <button type="button" className="vr-act" aria-pressed={mine === LIKE} onClick={() => react(LIKE)}>
            <span aria-hidden="true">👍</span>
            <b>{likes > 0 ? compact(likes) : "Pëlqej"}</b>
          </button>
        )}
        {reactions.ok && (
          <button type="button" className="vr-act" aria-expanded={picking} onClick={() => setPicking((p) => !p)}>
            {mine && mine !== LIKE ? (
              <span aria-hidden="true">{STORY_REACTIONS.find((r) => r.key === mine)?.emoji}</span>
            ) : (
              <SmilePlus size={20} strokeWidth={2.2} aria-hidden="true" />
            )}
            <b>{total > 0 ? compact(total) : "Reago"}</b>
          </button>
        )}
        {reactions.commentsOk && (
          <button type="button" className="vr-act" onClick={() => talk(true)}>
            <MessageCircle size={20} strokeWidth={2.2} aria-hidden="true" />
            <b>{comments > 0 ? compact(comments) : "Komento"}</b>
          </button>
        )}
        <button type="button" className="vr-act" onClick={share}>
          <Share2 size={20} strokeWidth={2.2} aria-hidden="true" />
          <b>Ndaje</b>
        </button>
      </div>
      {picking && (
        <div className="vr-react-row" role="group" aria-label="Reago">
          {STORY_REACTIONS.map((r) => (
            <button key={r.key} type="button" aria-pressed={mine === r.key} onClick={() => react(r.key as StoryReactionKey)} title={r.label}>
              <span aria-hidden="true">{r.emoji}</span>
              <small>{tally[r.key] ? compact(tally[r.key] ?? 0) : r.label}</small>
            </button>
          ))}
        </div>
      )}
      {note && (
        <p className="vr-note" role="status">
          {note}
        </p>
      )}
      <div className="vr-player-actions">
        {item.storySlug && (
          <Link
            href={`/article/${item.storySlug}`}
            className="vr-player-read"
            onClick={() => track("video_read", { video: item.videoId, position, list })}
          >
            Lexo lajmin <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        )}
        {/* Some owners allow embedding but block other sites at play time;
            YouTube itself always plays it. */}
        <a href={`https://www.youtube.com/watch?v=${item.videoId}`} target="_blank" rel="noopener noreferrer" className="vr-player-yt">
          Shiko në YouTube
        </a>
      </div>
      {reactions.commentsOk && <CommentsSheet open={talking} onClose={() => talk(false)} thread={thread} title={item.title} />}
    </>
  );
}
