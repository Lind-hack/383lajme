"use client";

// A row of short official videos — the homepage's "Video" and each section's
// own — and the full-screen, upright player they open.
//
// Only what 383's video editor approved (lib/video-feed: official channels'
// YouTube Shorts, watched and judged engaging, safe and the uploader's own).
// When the row comes into view the first card starts playing, muted, in place
// of its poster (on a desktop, whichever card the pointer is over).
//
// Tapping a card opens the player the way a phone expects a short video: the
// whole screen, upright, sound on. A transparent layer over the video takes
// the gestures — touches on YouTube's own frame never reach this page — and
// drives YouTube's player through its iframe messages: swipe up or down for
// the next or previous video, tap to pause, double-tap for 👍, and the next
// video starts when one ends. Beside it, TikTok-style, 👍 Pëlqej, the
// reactions, comments and sharing, kept under the video's own key
// (lib/video-key). If the phone refuses to start it with sound, it plays
// muted with "Prek për zë".
//
// YouTube's privacy-enhanced player (youtube-nocookie.com) throughout.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  MessageCircle,
  Pause,
  Play,
  Share2,
  SmilePlus,
  ThumbsUp,
  Volume2,
  X,
} from "lucide-react";
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
  /** Why it is worth watching (the editor's line), when there is one. */
  why?: string;
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
const YT_ORIGIN = "https://www.youtube-nocookie.com";

/** The Short's own upright cover, else its landscape poster. */
function poster(id: string, upright = true) {
  return `https://i.ytimg.com/vi/${id}/${upright ? "oardefault" : "hqdefault"}.jpg`;
}

/** A muted, chromeless, looping preview of the first seconds. */
function previewSrc(id: string) {
  return `${YT_ORIGIN}/embed/${id}?autoplay=1&mute=1&controls=0&playsinline=1&loop=1&playlist=${id}&rel=0&disablekb=1&iv_load_policy=3&fs=0`;
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
                loading={i < 4 ? "eager" : "lazy"}
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
 * Talks to the YouTube player in the frame: commands out (play, pause, mute)
 * and its state back (playing, paused, ended) — YouTube's documented iframe
 * messages, without loading its script.
 */
function useYouTube(frame: React.RefObject<HTMLIFrameElement | null>, videoId: string, onEnded: () => void) {
  const [state, setState] = useState<"loading" | "playing" | "paused">("loading");
  const [muted, setMuted] = useState(false);
  const ended = useRef(onEnded);
  const stateRef = useRef(state);
  useEffect(() => {
    ended.current = onEnded;
    stateRef.current = state;
  });

  const send = useCallback(
    (func: string, args: unknown[] = []) => {
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), YT_ORIGIN);
    },
    [frame]
  );

  useEffect(() => {
    setState("loading");
    setMuted(false);
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== YT_ORIGIN || e.source !== frame.current?.contentWindow) return;
      let data: { event?: string; info?: { playerState?: number; muted?: boolean } | number } | null = null;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      const info = data?.info;
      const playerState = typeof info === "number" ? info : info?.playerState;
      if (typeof info === "object" && info && typeof info.muted === "boolean") setMuted(info.muted);
      if (playerState === 1) setState("playing");
      else if (playerState === 2) setState("paused");
      else if (playerState === 0) ended.current();
    };
    window.addEventListener("message", onMessage);
    // Ask the player to report; repeated until it answers, as YouTube's own script does.
    const hello = window.setInterval(() => {
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: videoId }), YT_ORIGIN);
    }, 250);
    // Still not playing: the browser refused sound. Play muted, offer sound.
    const fallback = window.setTimeout(() => {
      if (stateRef.current !== "loading") return;
      send("mute");
      send("playVideo");
      setMuted(true);
    }, 2500);
    const stopHello = window.setTimeout(() => window.clearInterval(hello), 6000);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(hello);
      window.clearTimeout(fallback);
      window.clearTimeout(stopHello);
    };
  }, [videoId, frame, send]);

  return {
    state,
    muted,
    toggle: () => send(state === "playing" ? "pauseVideo" : "playVideo"),
    unmute: () => {
      send("unMute");
      send("setVolume", [100]);
      send("playVideo");
      setMuted(false);
    },
  };
}

/**
 * Full screen and upright on a phone; on a desktop, an upright stage with the
 * buttons beside it. Swipe (or ↑/↓, ←/→, the buttons) for the next video; Esc
 * or ✕ closes. Only the video on view loads.
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
  const reactions = useReactions();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const gesture = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastTap = useRef(0);
  const tapTimer = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  // While the comments sheet is open, keys and swipes belong to it.
  const [talking, setTalking] = useState(false);
  const [burst, setBurst] = useState(0);

  const go = useCallback(
    (dir: 1 | -1, how = "button") => {
      const next = index + dir;
      if (next < 0 || next >= items.length) return;
      onIndex(next);
      track("video_next", { video: items[next].videoId, position: next + 1, list, dir, how });
    },
    [index, items, list, onIndex]
  );

  const yt = useYouTube(frameRef, item?.videoId ?? "", () => go(1, "ended"));

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
        const els = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]") ?? [])];
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
      else if (e.key === "ArrowDown" || e.key === "ArrowRight") go(1, "key");
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") go(-1, "key");
      else if (e.key === " " && document.activeElement?.classList.contains("vr-touch")) {
        e.preventDefault();
        yt.toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, talking, yt]);

  if (!mounted || !item) return null;

  const like = () => {
    if (!reactions.ok) return;
    if (reactions.mine[item.key] !== LIKE) reactions.react(item.key, LIKE);
    setBurst((b) => b + 1);
    track("video_react", { video: item.videoId, reaction: LIKE, position: index + 1, list, how: "double-tap" });
  };

  return createPortal(
    <div ref={dialogRef} className="vr-player" role="dialog" aria-modal="true" aria-label={item.title}>
      <div className="vr-player-top">
        <span className="vr-player-count" aria-live="polite">
          {index + 1} / {items.length}
        </span>
        <button ref={closeRef} type="button" className="vr-player-btn" onClick={onClose} aria-label="Mbyll videon">
          <X size={22} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>

      <div className="vr-stage">
        <div className="vr-frame">
          <iframe
            ref={frameRef}
            key={item.videoId}
            src={`${YT_ORIGIN}/embed/${item.videoId}?autoplay=1&playsinline=1&rel=0&controls=0&enablejsapi=1&iv_load_policy=3&fs=0&origin=${encodeURIComponent(window.location.origin)}`}
            title={item.title}
            allow="autoplay; encrypted-media; picture-in-picture"
          />
          {/* Every touch on the video lands here: YouTube's frame would swallow it. */}
          <button
            type="button"
            className="vr-touch"
            aria-label={yt.state === "playing" ? "Ndalo videon" : "Luaj videon"}
            onPointerDown={(e) => {
              gesture.current = { x: e.clientX, y: e.clientY, t: Date.now() };
            }}
            onPointerUp={(e) => {
              const start = gesture.current;
              gesture.current = null;
              if (!start || talking) return;
              const dx = e.clientX - start.x;
              const dy = e.clientY - start.y;
              if (Math.max(Math.abs(dx), Math.abs(dy)) >= 50) {
                // A flick: mostly up/down on a phone, sideways counts too.
                if (Math.abs(dy) >= Math.abs(dx)) go(dy < 0 ? 1 : -1, "swipe");
                else go(dx < 0 ? 1 : -1, "swipe");
                return;
              }
              const now = Date.now();
              if (now - lastTap.current < 300) {
                if (tapTimer.current) window.clearTimeout(tapTimer.current);
                tapTimer.current = null;
                lastTap.current = 0;
                like();
                return;
              }
              lastTap.current = now;
              tapTimer.current = window.setTimeout(() => {
                tapTimer.current = null;
                yt.toggle();
              }, 300);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") yt.toggle();
            }}
          >
            {yt.state === "paused" && (
              <span className="vr-paused" aria-hidden="true">
                <Play size={34} strokeWidth={0} fill="currentColor" />
              </span>
            )}
            {burst > 0 && (
              <span key={burst} className="vr-burst" aria-hidden="true">
                👍
              </span>
            )}
          </button>
          {yt.muted && (
            <button type="button" className="vr-unmute" onClick={yt.unmute}>
              <Volume2 size={18} strokeWidth={2.4} aria-hidden="true" />
              Prek për zë
            </button>
          )}

          <div className="vr-info">
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
            {item.why && <p className="vr-why">{item.why}</p>}
            <div className="vr-player-actions">
              {item.storySlug && (
                <Link
                  href={`/article/${item.storySlug}`}
                  className="vr-player-read"
                  onClick={() => track("video_read", { video: item.videoId, position: index + 1, list })}
                >
                  Lexo lajmin <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
                </Link>
              )}
              {/* Some owners allow embedding but block other sites at play time;
                  YouTube itself always plays it. */}
              <a href={`https://www.youtube.com/shorts/${item.videoId}`} target="_blank" rel="noopener noreferrer" className="vr-player-yt">
                Shiko në YouTube
              </a>
            </div>
          </div>
        </div>

        <div className="vr-side">
          <Actions key={item.key} item={item} list={list} position={index + 1} onTalk={setTalking} />
          <span className="vr-side-nav">
            <button type="button" className="vr-player-btn" onClick={() => go(-1)} disabled={index === 0} aria-label="Videoja e mëparshme">
              <ChevronUp size={22} strokeWidth={2.4} aria-hidden="true" />
            </button>
            <button type="button" className="vr-player-btn" onClick={yt.toggle} aria-label={yt.state === "playing" ? "Ndalo" : "Luaj"}>
              {yt.state === "playing" ? <Pause size={20} strokeWidth={2.4} aria-hidden="true" /> : <Play size={20} strokeWidth={2.4} aria-hidden="true" />}
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
        </div>
      </div>
    </div>,
    document.body
  );
}

/** The column beside the video: 👍 Pëlqej, the reactions, comments, share. */
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
      window.setTimeout(() => setNote(null), 2500);
    } catch {
      // Cancelled, or no clipboard: nothing to say.
    }
  };

  return (
    <div className="vr-acts">
      {reactions.ok && (
        <button type="button" className="vr-act" aria-pressed={mine === LIKE} onClick={() => react(LIKE)} aria-label="Pëlqej">
          <span className="vr-act-icon">
            <ThumbsUp size={24} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <b>{likes > 0 ? compact(likes) : "Pëlqej"}</b>
        </button>
      )}
      {reactions.ok && (
        <span className="vr-act-wrap">
          <button type="button" className="vr-act" aria-expanded={picking} onClick={() => setPicking((p) => !p)} aria-label="Reago">
            <span className="vr-act-icon">
              {mine && mine !== LIKE ? (
                <span className="vr-act-emoji" aria-hidden="true">
                  {STORY_REACTIONS.find((r) => r.key === mine)?.emoji}
                </span>
              ) : (
                <SmilePlus size={24} strokeWidth={2.2} aria-hidden="true" />
              )}
            </span>
            <b>{total > 0 ? compact(total) : "Reago"}</b>
          </button>
          {picking && (
            <span className="vr-react-row" role="group" aria-label="Reago">
              {STORY_REACTIONS.map((r) => (
                <button key={r.key} type="button" aria-pressed={mine === r.key} onClick={() => react(r.key as StoryReactionKey)} title={r.label}>
                  <span aria-hidden="true">{r.emoji}</span>
                  <small>{tally[r.key] ? compact(tally[r.key] ?? 0) : r.label}</small>
                </button>
              ))}
            </span>
          )}
        </span>
      )}
      {reactions.commentsOk && (
        <button type="button" className="vr-act" onClick={() => talk(true)} aria-label="Komento">
          <span className="vr-act-icon">
            <MessageCircle size={24} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <b>{comments > 0 ? compact(comments) : "Komento"}</b>
        </button>
      )}
      <button type="button" className="vr-act" onClick={share} aria-label="Ndaje">
        <span className="vr-act-icon">
          <Share2 size={24} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <b>Ndaje</b>
      </button>
      {note && (
        <span className="vr-note" role="status">
          {note}
        </span>
      )}
      {reactions.commentsOk && <CommentsSheet open={talking} onClose={() => talk(false)} thread={thread} title={item.title} />}
    </div>
  );
}
