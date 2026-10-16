"use client";

// A row of short official videos — the homepage's "Video" and each section's
// own — and the full-screen, endless, upright feed they open.
//
// Only what 383's video editor approved (lib/video-feed: the official TikTok
// accounts' outliers and the official channels' YouTube Shorts, watched and
// judged engaging, safe and the uploader's own). When the row comes into view
// its first YouTube card plays muted in place of its poster (on a desktop,
// whichever card the pointer is over).
//
// Tapping a card opens the feed the way a phone expects short video: the whole
// screen, upright, sound on, one video per screen. Scroll or swipe and it snaps
// to the next one, which starts by itself; when a video ends the next one
// comes up; when the row's videos run out the feed goes on into every other
// section's (/api/video-feed) and then round again — it never stops. Only the
// video on screen plays; the ones either side are loaded and waiting, so the
// next one starts at once.
//
// Each video plays in its platform's own player (YouTube's privacy-enhanced
// youtube-nocookie.com, TikTok's embed player), driven through their
// documented iframe messages. A transparent layer over it takes the touches —
// a touch on the platform's frame never reaches this page — so a tap pauses,
// a double-tap gives 👍 where the finger is, and a swipe still scrolls the
// feed. Beside it, TikTok-style: 👍 Pëlqej, the reactions, comments and
// sharing (a card with the video's picture and its link), kept under the
// video's own key (lib/video-key). If the browser refuses sound (iPhones do
// until the reader taps), it plays muted with "Prek për zë".

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  MessageCircle,
  Play,
  Share2,
  SmilePlus,
  ThumbsUp,
  Volume2,
  VolumeX,
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
  platform: "youtube" | "tiktok";
  /** YouTube's 11-character id, or TikTok's digits. */
  videoId: string;
  title: string;
  /** Why it is worth watching (the editor's line), when there is one. */
  why?: string;
  /** The official channel: "NATO", "UEFA", "Real Madrid". */
  channel: string;
  /** The section's colour, for the chip's dot. */
  color: string;
  publishedAt: string;
  /** The 383 story this is the clip of, if any. */
  storySlug?: string | null;
  views?: number;
  likes?: number;
  /** How many times its account's usual it is doing. */
  outlier?: number | null;
  /** TikTok's upright cover (YouTube's comes from the id). */
  cover?: string | null;
  /** The video on its own platform. */
  url?: string;
};

/** "Pëlqej" is the 👍 reaction: one tap, the commonest one. */
const LIKE: StoryReactionKey = "dakord";
const SITE = "https://383ks.com";
const YT_ORIGIN = "https://www.youtube-nocookie.com";
const TT_ORIGIN = "https://www.tiktok.com";
/** The reactions API answers for at most 60 keys at a time. */
const WINDOW = 60;

/** The upright cover: TikTok's own, or the Short's (landscape poster as the fallback). */
function poster(item: VideoItem, upright = true) {
  if (item.platform === "tiktok") return item.cover || "";
  return `https://i.ytimg.com/vi/${item.videoId}/${upright ? "oardefault" : "hqdefault"}.jpg`;
}

function platformName(item: VideoItem) {
  return item.platform === "tiktok" ? "TikTok" : "YouTube";
}

function sourceUrl(item: VideoItem) {
  return item.url || (item.platform === "tiktok" ? `https://www.tiktok.com/video/${item.videoId}` : `https://www.youtube.com/shorts/${item.videoId}`);
}

function shareUrl(item: VideoItem) {
  return `${SITE}/video/${item.platform === "tiktok" ? `tt-${item.videoId}` : item.videoId}`;
}

/** A muted, chromeless, looping preview of the first seconds (YouTube only). */
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

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(".0", "")}M`;
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(".0", "")}K` : String(n);
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
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reducedMotion() ? "auto" : "smooth" });
  };

  if (items.length === 0) return null;
  // One preview at a time: the YouTube card under the pointer, else the first
  // YouTube card (TikTok's player is too heavy for a card). None while the
  // player is open.
  const firstYouTube = items.findIndex((v) => v.platform !== "tiktok");
  const target = hovered ?? firstYouTube;
  const previewing = allowed && inView && open === null && items[target]?.platform !== "tiktok" ? target : -1;

  return (
    <section ref={sectionRef} className="vr" aria-labelledby={`vr-${list}`} style={{ ["--vr-accent" as string]: accent }}>
      <div className="vr-head">
        <h2 id={`vr-${list}`} className="vr-title">
          <span className="vr-title-icon" aria-hidden="true">
            <Play size={14} strokeWidth={0} fill="currentColor" />
          </span>
          {title}
          <span className="vr-title-sub">Nga llogaritë zyrtare</span>
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
                track("video_open", { video: item.videoId, platform: item.platform, channel: item.channel, position: i + 1, list });
              }}
              aria-label={`Shiko videon: ${item.title}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the platform's own cover, already sized */}
              <img
                className="vr-poster"
                src={poster(item)}
                alt=""
                loading={i < 4 ? "eager" : "lazy"}
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (item.platform === "youtube" && !img.dataset.fallback) {
                    img.dataset.fallback = "1";
                    img.src = poster(item, false);
                  }
                }}
              />
              {previewing === i && <Preview id={item.videoId} />}
              <span className="vr-badge">
                <i style={{ background: item.color }} aria-hidden="true" />
                {item.channel}
              </span>
              {(item.outlier ?? 0) >= 3 && (
                <span className="vr-hot" title={`${item.outlier}× më shumë shikime se zakonisht`}>
                  🔥 {Math.round(item.outlier ?? 0)}×
                </span>
              )}
              <span className="vr-play" aria-hidden="true">
                <Play size={22} strokeWidth={0} fill="currentColor" />
              </span>
              <span className="vr-card-foot">
                {(item.views ?? 0) > 0 && (
                  <span className="vr-card-stats">
                    <Play size={11} strokeWidth={0} fill="currentColor" aria-hidden="true" />
                    {compact(item.views ?? 0)} · {platformName(item)}
                  </span>
                )}
                <span className="vr-card-title">{item.title}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open !== null && (
        <Player
          items={items}
          index={open}
          list={list}
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
 * The card's muted preview, faded in over the poster once YouTube says it is
 * playing — never for a video its owner blocks on other sites, which shows
 * YouTube's error page instead.
 */
function Preview({ id }: { id: string }) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => setSrc(`${previewSrc(id)}&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`), [id]);
  useEffect(() => {
    setReady(false);
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== YT_ORIGIN || e.source !== frame.current?.contentWindow) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        const info = data?.info;
        if ((typeof info === "number" ? info : info?.playerState) === 1) setReady(true);
      } catch {
        // Not YouTube's message.
      }
    };
    window.addEventListener("message", onMessage);
    const hello = window.setInterval(() => {
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id }), YT_ORIGIN);
    }, 300);
    const stop = window.setTimeout(() => window.clearInterval(hello), 8000);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(hello);
      window.clearTimeout(stop);
    };
  }, [id]);
  return (
    <span className="vr-preview" data-ready={ready || undefined} aria-hidden="true">
      {src && <iframe ref={frame} src={src} title="" tabIndex={-1} allow="autoplay; encrypted-media" />}
    </span>
  );
}

type Controls = { mute: () => void; unmute: () => void; toggle: () => void };
type PlayState = "loading" | "playing" | "paused";

/**
 * One video's player, through the platform's documented iframe messages:
 * commands out (play, pause, mute, unmute) and its state back (playing,
 * paused, ended, the time). Plays only while `active`; sound on unless the
 * reader turned it off or the browser refuses it.
 */
function useEmbed(
  item: VideoItem,
  frame: React.RefObject<HTMLIFrameElement | null>,
  /** The frame's address; null while it is not loaded. */
  src: string | null,
  active: boolean,
  wantSound: React.RefObject<boolean>,
  onEnded: () => void
) {
  // Some owners allow embedding but block other sites when it plays: the
  // player says so (YouTube 100/101/150, TikTok 1001-3001). Such a video is
  // skipped like one that ended.
  const tiktok = item.platform === "tiktok";
  const origin = tiktok ? TT_ORIGIN : YT_ORIGIN;
  const [state, setState] = useState<PlayState>("loading");
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const ready = useRef(false);
  const live = useRef({ active, state, onEnded });
  useEffect(() => {
    live.current = { active, state, onEnded };
  });

  const send = useCallback(
    (cmd: "play" | "pause" | "mute" | "unMute" | "seekTo", value?: number) => {
      const win = frame.current?.contentWindow;
      if (!win) return;
      if (tiktok) {
        win.postMessage({ type: cmd, value, "x-tiktok-player": true }, TT_ORIGIN);
        return;
      }
      const func = { play: "playVideo", pause: "pauseVideo", mute: "mute", unMute: "unMute", seekTo: "seekTo" }[cmd];
      const args = cmd === "seekTo" ? [value ?? 0, true] : [];
      win.postMessage(JSON.stringify({ event: "command", func, args }), YT_ORIGIN);
      if (cmd === "unMute") win.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [100] }), YT_ORIGIN);
    },
    [frame, tiktok]
  );

  const start = useCallback(() => {
    if (wantSound.current) send("unMute");
    else send("mute");
    send("play");
  }, [send, wantSound]);

  // Messages from this video's frame only, from the moment it loads.
  useEffect(() => {
    ready.current = false;
    setStarted(false);
    setState("loading");
    if (!src) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== frame.current?.contentWindow) return;
      let data: Record<string, unknown> | null = null;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (!data || typeof data !== "object") return;
      if (tiktok) {
        const value = data.value as unknown;
        if (data.type === "onPlayerReady") {
          ready.current = true;
          if (live.current.active) start();
        } else if (data.type === "onStateChange") {
          if (value === 1) {
            setState("playing");
            setStarted(true);
          } else if (value === 2) setState("paused");
          else if (value === 0) live.current.onEnded();
        } else if (data.type === "onCurrentTime" && value && typeof value === "object") {
          const { currentTime, duration } = value as { currentTime?: number; duration?: number };
          if (duration) setProgress(Math.min(1, (currentTime ?? 0) / duration));
        } else if (data.type === "onMute" && typeof value === "boolean") setMuted(value);
        else if (data.type === "onPlayerError") {
          const code = (value as { errorCode?: number } | null)?.errorCode;
          if (code === 3002) {
            // The browser refused to start it with sound: play muted, offer sound.
            send("mute");
            send("play");
            setMuted(true);
          } else if (code) setFailed(true);
        }
        return;
      }
      if (data.event === "onError") setFailed(true);
      if (data.event === "onReady") {
        ready.current = true;
        if (live.current.active) start();
      }
      const info = data.info as { playerState?: number; muted?: boolean; currentTime?: number; duration?: number } | number | undefined;
      const playerState = typeof info === "number" ? info : info?.playerState;
      if (info && typeof info === "object") {
        if (typeof info.muted === "boolean") setMuted(info.muted);
        if (typeof info.currentTime === "number" && typeof info.duration === "number" && info.duration > 0) {
          setProgress(Math.min(1, info.currentTime / info.duration));
        }
      }
      if (playerState === 1) {
        setState("playing");
        setStarted(true);
      } else if (playerState === 2) setState("paused");
      else if (playerState === 0) live.current.onEnded();
    };
    window.addEventListener("message", onMessage);
    // YouTube reports only to a page that says it is listening; repeated until it answers, as its own script does.
    const hello = tiktok
      ? 0
      : window.setInterval(() => {
          frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: item.videoId }), YT_ORIGIN);
        }, 250);
    const stopHello = window.setTimeout(() => window.clearInterval(hello), 8000);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(hello);
      window.clearTimeout(stopHello);
    };
  }, [frame, item.videoId, origin, send, src, start, tiktok]);

  // On screen: play (with sound if allowed). Off screen: pause and rewind, so it starts fresh when it comes back.
  useEffect(() => {
    if (!active) {
      if (ready.current) {
        send("pause");
        send("seekTo", 0);
      }
      return;
    }
    if (ready.current) start();
    // Not playing yet: the browser refused sound. Play muted, offer sound.
    const fallback = window.setTimeout(() => {
      if (live.current.state === "playing" || !live.current.active) return;
      send("mute");
      send("play");
      setMuted(true);
    }, 2600);
    return () => window.clearTimeout(fallback);
  }, [active, send, start]);

  const controls: Controls = {
    mute: () => {
      send("mute");
      setMuted(true);
    },
    unmute: () => {
      send("unMute");
      send("play");
      setMuted(false);
    },
    toggle: () => send(state === "playing" ? "pause" : "play"),
  };
  // Unplayable on screen: on to the next one.
  useEffect(() => {
    if (failed && active) live.current.onEnded();
  }, [failed, active]);

  return { state, started, muted, progress, failed, controls };
}

/** The frame's address: chromeless, upright, ours to drive. `autoplay` only for the video on screen at load. */
function embedSrc(item: VideoItem, autoplay: boolean) {
  if (item.platform === "tiktok") {
    const off = "controls=0&progress_bar=0&play_button=0&volume_control=0&fullscreen_button=0&timestamp=0";
    return `${TT_ORIGIN}/player/v1/${item.videoId}?autoplay=${autoplay ? 1 : 0}&loop=0&${off}&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`;
  }
  const origin = encodeURIComponent(window.location.origin);
  return `${YT_ORIGIN}/embed/${item.videoId}?autoplay=${autoplay ? 1 : 0}&playsinline=1&rel=0&controls=0&enablejsapi=1&iv_load_policy=3&fs=0&disablekb=1&origin=${origin}`;
}

type Slot = { item: VideoItem; id: string };

/**
 * The endless feed: full screen and upright on a phone; on a desktop, an
 * upright stage as tall as the window with the buttons beside it. One video
 * per screen (scroll snap), the next on a swipe, the wheel, ↑/↓ or the
 * buttons; Esc or ✕ closes.
 */
function Player({ items, index, list, onClose }: { items: VideoItem[]; index: number; list: string; onClose: () => void }) {
  const [slots, setSlots] = useState<Slot[]>(() => items.map((item) => ({ item, id: `${item.key}~0` })));
  const [active, setActive] = useState(index);
  const [mounted, setMounted] = useState(false);
  // While a sheet (comments, sharing) is open, keys and taps belong to it.
  const [talking, setTalking] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const wantSound = useRef(true);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const controls = useRef<Controls | null>(null);
  const how = useRef("swipe");
  const lastDir = useRef<1 | -1>(1);
  const seen = useRef(index);
  const loadedAll = useRef(false);
  const extending = useRef(false);
  const round = useRef(1);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Open on the tapped video, without scrolling past the others.
  useLayoutEffect(() => {
    const el = feedRef.current;
    if (mounted && el) el.scrollTop = index * el.clientHeight;
    if (mounted) closeRef.current?.focus({ preventScroll: true });
    // Only on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // The video on screen is the one at least 60% in view.
  useEffect(() => {
    const root = feedRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { root, threshold: 0.6 }
    );
    root.querySelectorAll("[data-i]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [mounted, slots.length]);

  useEffect(() => {
    if (active === seen.current) return;
    const dir = active > seen.current ? 1 : -1;
    lastDir.current = dir;
    seen.current = active;
    const item = slots[active]?.item;
    if (item) track("video_next", { video: item.videoId, platform: item.platform, position: active + 1, list, dir, how: how.current });
    how.current = "swipe";
  }, [active, list, slots]);

  // Never an end: near the last video, every section's videos, then round again.
  useEffect(() => {
    if (active < slots.length - 3 || extending.current) return;
    extending.current = true;
    (async () => {
      let incoming: VideoItem[] = [];
      if (!loadedAll.current) {
        loadedAll.current = true;
        try {
          const res = await fetch("/api/video-feed");
          const json = res.ok ? await res.json() : null;
          incoming = Array.isArray(json?.items) ? (json.items as VideoItem[]).filter((v) => typeof v?.key === "string") : [];
        } catch {
          // Offline: go round the row's own videos.
        }
      }
      setSlots((prev) => {
        const have = new Set(prev.map((s) => s.item.key));
        const fresh = incoming.filter((v) => !have.has(v.key));
        if (fresh.length) return [...prev, ...fresh.map((item) => ({ item, id: `${item.key}~0` }))];
        const distinct = [...new Map(prev.map((s) => [s.item.key, s.item])).values()];
        const n = round.current++;
        return [...prev, ...distinct.map((item) => ({ item, id: `${item.key}~${n}` }))];
      });
      extending.current = false;
    })();
  }, [active, slots.length]);

  const go = useCallback(
    (dir: 1 | -1, via = "button") => {
      const el = feedRef.current;
      const next = active + dir;
      if (!el || next < 0 || next >= slots.length) return;
      how.current = via;
      el.scrollTo({ top: next * el.clientHeight, behavior: reducedMotion() ? "auto" : "smooth" });
    },
    [active, slots.length]
  );

  const toggleSound = useCallback(() => {
    const on = !wantSound.current;
    wantSound.current = on;
    setSoundOn(on);
    if (on) controls.current?.unmute();
    else controls.current?.mute();
    track("video_sound", { on, list });
  }, [list]);

  useEffect(() => {
    if (talking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        // Keep Tab inside the player: it covers the page.
        const els = [...(dialogRef.current?.querySelectorAll<HTMLElement>(".vr-player-top button, .vr-slide[data-active] :is(button, a[href]), .vr-desk-nav button:not(:disabled)") ?? [])];
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
      else if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        go(1, "key");
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1, "key");
      } else if (e.key === "m" || e.key === "M") toggleSound();
      else if (e.key === " " && !(document.activeElement instanceof HTMLButtonElement && !document.activeElement.classList.contains("vr-touch"))) {
        e.preventDefault();
        controls.current?.toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, talking, toggleSound]);

  // Reactions for the videos around this one (the API answers 60 at a time; a new window every 30 videos).
  const windowKeys = useMemo(() => {
    const from = Math.max(0, Math.floor(active / 30) * 30 - 10);
    return [...new Set(slots.slice(from, from + WINDOW * 2).map((s) => s.item.key))].slice(0, WINDOW);
  }, [active, slots]);

  if (!mounted) return null;
  const current = slots[active]?.item;

  return createPortal(
    <div ref={dialogRef} className="vr-player" role="dialog" aria-modal="true" aria-label={current?.title ?? "Video"}>
      <ReactionsProvider slugs={windowKeys}>
        <div ref={feedRef} className="vr-feed">
          {slots.map((slot, i) => (
            <Slide
              key={slot.id}
              i={i}
              item={slot.item}
              active={i === active}
              near={Math.abs(i - active) <= 1}
              list={list}
              wantSound={wantSound}
              talking={talking}
              onTalk={setTalking}
              onEnded={() => go(1, "ended")}
              onSkip={() => go(i === 0 ? 1 : lastDir.current, "unplayable")}
              onControls={(c) => {
                if (i === active) controls.current = c;
              }}
            />
          ))}
        </div>
      </ReactionsProvider>

      <div className="vr-player-top">
        <button type="button" className="vr-player-btn" onClick={toggleSound} aria-label={soundOn ? "Hiq zërin" : "Me zë"} aria-pressed={!soundOn}>
          {soundOn ? <Volume2 size={20} strokeWidth={2.4} aria-hidden="true" /> : <VolumeX size={20} strokeWidth={2.4} aria-hidden="true" />}
        </button>
        <span className="vr-player-brand" aria-hidden="true">
          Video <b>383</b>
        </span>
        <button ref={closeRef} type="button" className="vr-player-btn" onClick={onClose} aria-label="Mbyll videon">
          <X size={22} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>

      <span className="vr-desk-nav">
        <button type="button" className="vr-player-btn" onClick={() => go(-1)} disabled={active === 0} aria-label="Videoja e mëparshme">
          <ChevronUp size={22} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <button type="button" className="vr-player-btn" onClick={() => go(1)} aria-label="Videoja tjetër">
          <ChevronDown size={22} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </span>
    </div>,
    document.body
  );
}

type Burst = { id: number; x: number; y: number; tilt: number };

/** One screen of the feed: the video, the touch layer, its words and its buttons. */
function Slide({
  i,
  item,
  active,
  near,
  list,
  wantSound,
  talking,
  onTalk,
  onEnded,
  onSkip,
  onControls,
}: {
  i: number;
  item: VideoItem;
  active: boolean;
  near: boolean;
  list: string;
  wantSound: React.RefObject<boolean>;
  talking: boolean;
  onTalk: (open: boolean) => void;
  onEnded: () => void;
  /** The video cannot play here: the feed moves on. */
  onSkip: () => void;
  onControls: (c: Controls) => void;
}) {
  const reactions = useReactions();
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  // The frame's address is fixed when it loads: autoplay only if it loaded on screen.
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (near && !src) setSrc(embedSrc(item, active));
    if (!near && src) setSrc(null);
  }, [near, active, item, src]);
  const failedRef = useRef(false);
  const player = useEmbed(item, frameRef, src, active && Boolean(src), wantSound, () => (failedRef.current ? onSkip() : onEnded()));
  failedRef.current = player.failed;
  const gesture = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);
  const tapTimer = useRef<number | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [likePop, setLikePop] = useState(0);
  const cover = poster(item);

  useEffect(() => {
    if (active) onControls(player.controls);
  });

  const like = (x: number, y: number) => {
    if (!reactions.ok) return;
    if (reactions.mine[item.key] !== LIKE) reactions.react(item.key, LIKE);
    const id = Date.now();
    setBursts((b) => [...b.slice(-3), { id, x, y, tilt: Math.round(Math.random() * 30 - 15) }]);
    setLikePop((n) => n + 1);
    window.setTimeout(() => setBursts((b) => b.filter((p) => p.id !== id)), 950);
    track("video_react", { video: item.videoId, platform: item.platform, reaction: LIKE, position: i + 1, list, how: "double-tap" });
  };

  return (
    <section className="vr-slide" data-i={i} data-platform={item.platform} data-active={active || undefined} aria-hidden={!active} inert={!active}>
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element -- the platform's own cover, behind the stage
        <img className="vr-slide-bg" src={cover} alt="" aria-hidden="true" referrerPolicy="no-referrer" loading="lazy" />
      )}
      <div className="vr-frame">
        {src && (
          <iframe
            ref={frameRef}
            src={src}
            title={item.title}
            tabIndex={-1}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          />
        )}
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- shown until the video is playing
          <img
            className="vr-slide-poster"
            src={cover}
            alt=""
            data-hidden={player.started || undefined}
            referrerPolicy="no-referrer"
            loading={near ? "eager" : "lazy"}
          />
        )}
        {/* Every touch on the video lands here: the platform's frame would swallow it. Swipes scroll the feed. */}
        <button
          type="button"
          className="vr-touch"
          aria-label={player.state === "playing" ? "Ndalo videon" : "Luaj videon"}
          onPointerDown={(e) => {
            gesture.current = { x: e.clientX, y: e.clientY, moved: false };
          }}
          onPointerMove={(e) => {
            const g = gesture.current;
            if (g && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 12) g.moved = true;
          }}
          onPointerCancel={() => {
            gesture.current = null;
          }}
          onPointerUp={(e) => {
            const g = gesture.current;
            gesture.current = null;
            if (!g || g.moved || talking) return;
            const box = e.currentTarget.getBoundingClientRect();
            const now = Date.now();
            if (now - lastTap.current < 280) {
              if (tapTimer.current) window.clearTimeout(tapTimer.current);
              tapTimer.current = null;
              lastTap.current = 0;
              like(e.clientX - box.left, e.clientY - box.top);
              return;
            }
            lastTap.current = now;
            tapTimer.current = window.setTimeout(() => {
              tapTimer.current = null;
              player.controls.toggle();
            }, 280);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") player.controls.toggle();
          }}
        >
          {player.state === "paused" && (
            <span className="vr-paused" aria-hidden="true">
              <Play size={34} strokeWidth={0} fill="currentColor" />
            </span>
          )}
        </button>
        {bursts.map((b) => (
          <span key={b.id} className="vr-burst" style={{ left: b.x, top: b.y, ["--tilt" as string]: `${b.tilt}deg` }} aria-hidden="true">
            <ThumbsUp size={96} strokeWidth={0} fill="currentColor" />
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <i key={k} style={{ ["--a" as string]: `${k * 60 + b.tilt}deg` }} />
            ))}
          </span>
        ))}
        {active && player.muted && (
          <button
            type="button"
            className="vr-unmute"
            onClick={() => {
              wantSound.current = true;
              player.controls.unmute();
              track("video_sound", { on: true, list, how: "prompt" });
            }}
          >
            <Volume2 size={18} strokeWidth={2.4} aria-hidden="true" />
            Prek për zë
          </button>
        )}

        <div className="vr-info">
          <span className="vr-player-meta">
            <i style={{ background: item.color }} aria-hidden="true" />
            {item.channel} · zyrtare
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
                onClick={() => track("video_read", { video: item.videoId, position: i + 1, list })}
              >
                Lexo lajmin <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            )}
            {/* Some owners allow embedding but block other sites at play time; the platform itself always plays it. */}
            <a
              href={sourceUrl(item)}
              target="_blank"
              rel="noopener noreferrer"
              className="vr-player-src"
              onClick={() => track("video_source", { video: item.videoId, platform: item.platform, position: i + 1, list })}
            >
              {(item.views ?? 0) > 0 && <>{compact(item.views ?? 0)} shikime · </>}
              Shiko në {platformName(item)} <ExternalLink size={13} strokeWidth={2.4} aria-hidden="true" />
            </a>
          </div>
        </div>
        <span className="vr-progress" aria-hidden="true">
          <i style={{ transform: `scaleX(${player.progress})` }} />
        </span>
      </div>

      <div className="vr-side">
        <Actions item={item} list={list} position={i + 1} likePop={likePop} onTalk={onTalk} />
      </div>
    </section>
  );
}

/** The column beside the video: 👍 Pëlqej, the reactions, comments, share. */
function Actions({
  item,
  list,
  position,
  likePop,
  onTalk,
}: {
  item: VideoItem;
  list: string;
  position: number;
  /** Bumped by a double-tap, so the button celebrates too. */
  likePop: number;
  onTalk: (open: boolean) => void;
}) {
  const reactions = useReactions();
  const thread = useCommentThread(item.key, (n) => reactions.setComments(item.key, n));
  const [picking, setPicking] = useState(false);
  const [talking, setTalking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [pop, setPop] = useState(0);
  const [fly, setFly] = useState<{ id: number; emoji: string } | null>(null);
  const [sent, setSent] = useState(0);
  const tally = reactions.tallies[item.key] ?? {};
  const mine = reactions.mine[item.key];
  const likes = tally[LIKE] ?? 0;
  const total = Object.values(tally).reduce((a: number, b) => a + (Number(b) || 0), 0);
  const comments = reactions.comments[item.key] ?? 0;
  const likePops = pop + likePop;

  const react = (key: StoryReactionKey) => {
    const undo = mine === key;
    reactions.react(item.key, key);
    setPicking(false);
    if (key === LIKE) setPop((n) => n + 1);
    else if (!undo) {
      const emoji = STORY_REACTIONS.find((r) => r.key === key)?.emoji ?? "";
      const id = Date.now();
      setFly({ id, emoji });
      window.setTimeout(() => setFly((f) => (f?.id === id ? null : f)), 900);
    }
    track("video_react", { video: item.videoId, platform: item.platform, reaction: key, position, list });
  };

  const talk = (open: boolean) => {
    setTalking(open);
    onTalk(open);
    if (open) track("video_comments", { video: item.videoId, position, list });
  };

  const share = (open: boolean) => {
    setSharing(open);
    onTalk(open);
    if (open) {
      setSent((n) => n + 1);
      track("video_share", { video: item.videoId, platform: item.platform, position, list });
    }
  };

  return (
    <div className="vr-acts">
      {reactions.ok && (
        <button type="button" className="vr-act" aria-pressed={mine === LIKE} onClick={() => react(LIKE)} aria-label="Pëlqej">
          <span className="vr-act-icon vr-act-like" key={likePops} data-pop={likePops > 0 || undefined}>
            <ThumbsUp size={24} strokeWidth={2.2} fill={mine === LIKE ? "currentColor" : "none"} aria-hidden="true" />
          </span>
          <b key={`n${likes}`} className="vr-count">
            {likes > 0 ? compact(likes) : "Pëlqej"}
          </b>
        </button>
      )}
      {reactions.ok && (
        <span className="vr-act-wrap">
          <button type="button" className="vr-act" aria-expanded={picking} onClick={() => setPicking((p) => !p)} aria-label="Reago">
            <span className="vr-act-icon" key={mine ?? "none"} data-pop={mine && mine !== LIKE ? true : undefined}>
              {mine && mine !== LIKE ? (
                <span className="vr-act-emoji" aria-hidden="true">
                  {STORY_REACTIONS.find((r) => r.key === mine)?.emoji}
                </span>
              ) : (
                <SmilePlus size={24} strokeWidth={2.2} aria-hidden="true" />
              )}
            </span>
            <b key={`t${total}`} className="vr-count">
              {total > 0 ? compact(total) : "Reago"}
            </b>
          </button>
          {fly && (
            <span key={fly.id} className="vr-fly" aria-hidden="true">
              {fly.emoji}
            </span>
          )}
          {picking && (
            <span className="vr-react-row" role="group" aria-label="Reago">
              {STORY_REACTIONS.map((r, k) => (
                <button
                  key={r.key}
                  type="button"
                  aria-pressed={mine === r.key}
                  onClick={() => react(r.key as StoryReactionKey)}
                  title={r.label}
                  style={{ ["--d" as string]: `${k * 28}ms` }}
                >
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
          <b className="vr-count">{comments > 0 ? compact(comments) : "Komento"}</b>
        </button>
      )}
      <button type="button" className="vr-act" onClick={() => share(true)} aria-label="Ndaje" aria-expanded={sharing}>
        <span className="vr-act-icon vr-act-share" key={`s${sent}`} data-pop={sent > 0 || undefined}>
          <Share2 size={24} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <b className="vr-count">Ndaje</b>
      </button>
      {reactions.commentsOk && <CommentsSheet open={talking} onClose={() => talk(false)} thread={thread} title={item.title} />}
      {sharing && <ShareSheet item={item} list={list} position={position} onClose={() => share(false)} />}
    </div>
  );
}

/** Sharing: the video's picture, its title and its 383 link, to copy or send on. */
function ShareSheet({ item, list, position, onClose }: { item: VideoItem; list: string; position: number; onClose: () => void }) {
  const url = shareUrl(item);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const firstRef = useRef<HTMLButtonElement | null>(null);
  const text = `${item.title} · ${item.channel}`;

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
    firstRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
      track("video_share_copy", { video: item.videoId, position, list });
    } catch {
      // No clipboard: the link is on screen to copy by hand.
    }
  };

  const out = (where: string, href: string) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="vr-share-to"
      onClick={() => track("video_share_to", { video: item.videoId, to: where, position, list })}
    >
      {where}
    </a>
  );

  return (
    <div className="vr-share" role="dialog" aria-modal="true" aria-label="Ndaje videon">
      <button type="button" className="vr-share-scrim" aria-label="Mbyll" tabIndex={-1} onClick={onClose} />
      <div className="vr-share-card">
        <span className="vr-share-grip" aria-hidden="true" />
        <div className="vr-share-preview">
          {poster(item) && (
            // eslint-disable-next-line @next/next/no-img-element -- the platform's own cover
            <img src={poster(item)} alt="" referrerPolicy="no-referrer" />
          )}
          <div>
            <small>{item.channel} · {platformName(item)}</small>
            <b>{item.title}</b>
            <span className="vr-share-url">{url.replace("https://", "")}</span>
          </div>
        </div>
        <div className="vr-share-row">
          <button ref={firstRef} type="button" className="vr-share-copy" data-done={copied || undefined} onClick={copy}>
            {copied ? <Check size={18} strokeWidth={2.6} aria-hidden="true" /> : <Copy size={18} strokeWidth={2.4} aria-hidden="true" />}
            {copied ? "U kopjua" : "Kopjo lidhjen"}
          </button>
          {canShare && (
            <button
              type="button"
              className="vr-share-copy"
              onClick={() => {
                navigator.share({ title: item.title, text, url }).catch(() => {});
                track("video_share_to", { video: item.videoId, to: "native", position, list });
              }}
            >
              <Share2 size={18} strokeWidth={2.4} aria-hidden="true" />
              Më shumë
            </button>
          )}
        </div>
        <div className="vr-share-row">
          {out("WhatsApp", `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`)}
          {out("Facebook", `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)}
          {out("X", `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`)}
          {out("Telegram", `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`)}
        </div>
        <a href={sourceUrl(item)} target="_blank" rel="noopener noreferrer" className="vr-share-src">
          Origjinali në {platformName(item)} <ExternalLink size={13} strokeWidth={2.4} aria-hidden="true" />
        </a>
        <button type="button" className="vr-share-close" onClick={onClose}>
          Mbyll
        </button>
      </div>
    </div>
  );
}
