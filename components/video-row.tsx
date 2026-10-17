"use client";

// 383's video edition: today's top stories as short clips, a row of upright
// cards on the homepage and the full-screen player they open.
//
// What it is for: "tell me what happened today", in Albanian, in about three
// minutes, and then stop. Each clip is one of the front page's stories, made
// by 383 itself (scripts/video_edition.py): the story's photo, a voice that
// reads a short script written from the story alone, and the words on screen
// as they are said, so it works with the sound off too. Unlike a feed that
// never ends, the edition does: after the last clip the reader is told they
// are caught up ("Je në dijeni"), with the day's headlines to read on. The
// clips a reader has watched are remembered on this device, so the row says
// what is new since.
//
// Tapping a card (or "Luaj") opens the player at that clip, sound on: the tap
// itself starts the voice, which is what a phone needs to allow sound. When a
// clip ends the next one starts; a swipe, the wheel, ↑/↓ or the buttons move
// between them; a tap pauses, a double-tap gives 👍. Beside each clip, as on
// the story's own page: 👍 Pëlqej, the reactions and the comments (the
// story's own, under its slug), and sharing.

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
  MessageCircle,
  Play,
  RotateCcw,
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
import { activeStreak, advanceStreak, parseStreak } from "@/lib/reagimi-data";
import { track } from "@/lib/analytics";
import type { Edition, EditionClip } from "@/lib/video-edition";
import "./video-row.css";

/** "Pëlqej" is the 👍 reaction: one tap, the commonest one. */
const LIKE: StoryReactionKey = "dakord";
const SITE = "https://383ks.com";
const SEEN_KEY = "383:edition-seen";
const STREAK_KEY = "383:edition-streak";
/** Watched this much of a clip, it counts as seen. */
const SEEN_AT = 0.85;

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(".0", "")}M`;
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(".0", "")}K` : String(n);
}

function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function minutes(clips: EditionClip[]) {
  return Math.max(1, Math.round(clips.reduce((a, c) => a + c.duration, 0) / 60));
}

function clipUrl(clip: EditionClip) {
  return `${SITE}/video/${clip.slug}`;
}

// ── What this device has watched (per edition day) ──────────────────────────

function readSeen(date: string): Set<string> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "null");
    // Optional-chained: stored data may predate this shape.
    if (raw?.date !== date || !Array.isArray(raw?.slugs)) return new Set();
    return new Set((raw.slugs as unknown[]).filter((s): s is string => typeof s === "string"));
  } catch {
    return new Set();
  }
}

function writeSeen(date: string, seen: Set<string>) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify({ date, slugs: [...seen] }));
  } catch {
    // Private mode: remembered for this visit only.
  }
}

/** Finishing the edition on consecutive days: the streak the end screen shows. */
function finishDay(date: string): number {
  try {
    const next = advanceStreak(parseStreak(window.localStorage.getItem(STREAK_KEY)), date);
    window.localStorage.setItem(STREAK_KEY, JSON.stringify(next));
    return next.count;
  } catch {
    return 1;
  }
}

function currentStreak(date: string): number {
  try {
    return activeStreak(parseStreak(window.localStorage.getItem(STREAK_KEY)), date);
  } catch {
    return 0;
  }
}

// ── The voice: one audio element for the whole edition ─────────────────────
// A phone plays sound only from a tap, and an element that started from a tap
// may go on playing new sources after it. So the element is made and started
// in the tap that opens the edition, and every clip plays through it.

let shared: HTMLAudioElement | null = null;

function voice(): HTMLAudioElement {
  if (!shared) {
    shared = new Audio();
    shared.preload = "auto";
  }
  return shared;
}

/** Inside the opening tap: start this clip's voice at once. */
function startFromTap(clip: EditionClip | undefined) {
  if (!clip?.audio) return;
  const a = voice();
  if (a.src !== clip.audio) a.src = clip.audio;
  a.currentTime = 0;
  a.play().catch(() => {});
}

// ── The row ─────────────────────────────────────────────────────────────────

export default function VideoRow({
  edition,
  list,
  accent = "#FF4422",
  openSlug,
}: {
  edition: Edition;
  /** Where the row is, for analytics: "home", "video" or "share". */
  list: string;
  accent?: string;
  /** Open the player on this clip at once (the /video pages). */
  openSlug?: string;
}) {
  const clips = edition.clips;
  const trackRef = useRef<HTMLUListElement | null>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState<number | null>(() => {
    if (openSlug === undefined) return null;
    const i = clips.findIndex((c) => c.slug === openSlug);
    return i >= 0 ? i : 0;
  });
  const opener = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setSeen(readSeen(edition.date)), [edition.date]);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(update, [update]);

  const markSeen = useCallback(
    (slug: string) => {
      setSeen((prev) => {
        if (prev.has(slug)) return prev;
        const next = new Set(prev).add(slug);
        writeSeen(edition.date, next);
        return next;
      });
    },
    [edition.date]
  );

  if (clips.length === 0) return null;
  const left = clips.filter((c) => !seen.has(c.slug));
  const caughtUp = left.length === 0;
  const firstNew = Math.max(0, clips.findIndex((c) => !seen.has(c.slug)));

  const step = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reducedMotion() ? "auto" : "smooth" });
  };

  const openAt = (i: number, el: HTMLButtonElement | null, how: string) => {
    startFromTap(clips[i]);
    opener.current = el;
    setOpen(i);
    track("edition_open", { slug: clips[i]?.slug, position: i + 1, list, how, seen: seen.size });
  };

  return (
    <section className="vr" aria-labelledby={`vr-${list}`} style={{ ["--vr-accent" as string]: accent }}>
      {/* The site's section heading (components/section-label): bar, capitals, hairline. */}
      <div className="vr-head">
        <span className="vr-bar" aria-hidden="true" />
        <h2 id={`vr-${list}`} className="vr-title">
          Edicioni video
        </h2>
        <span className="vr-rule" aria-hidden="true" />
        <button
          type="button"
          className="vr-all"
          data-done={caughtUp || undefined}
          onClick={(e) => openAt(caughtUp ? 0 : firstNew, e.currentTarget, caughtUp ? "again" : "play-all")}
        >
          {caughtUp ? (
            <RotateCcw size={13} strokeWidth={2.6} aria-hidden="true" />
          ) : (
            <Play size={12} strokeWidth={0} fill="currentColor" aria-hidden="true" />
          )}
          {caughtUp ? "Shiko sërish" : seen.size ? `Vazhdo · ${left.length} të reja` : `Luaj · ${minutes(clips)} min`}
        </button>
        <span className="vr-nav">
          <button type="button" onClick={() => step(-1)} disabled={edge.start} aria-label="Lajmet e mëparshme">
            <ChevronLeft size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => step(1)} disabled={edge.end} aria-label="Lajmet e tjera">
            <ChevronRight size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </span>
      </div>
      <p className="vr-lede">
        {caughtUp ? (
          <>
            <b className="vr-done">
              <Check size={14} strokeWidth={3} aria-hidden="true" /> Je në dijeni.
            </b>{" "}
            I ke parë të gjitha lajmet kryesore të sotme. Kur të ketë lajme të reja, shfaqen këtu.
          </>
        ) : (
          <>
            {clips.length} lajmet kryesore të sotme, me zë, në {minutes(clips)} minuta. Kur mbaron, je në dijeni.
          </>
        )}
      </p>
      <ul className="vr-track" ref={trackRef} onScroll={update}>
        {clips.map((clip, i) => {
          const done = seen.has(clip.slug);
          return (
            <li key={clip.slug}>
              <button
                type="button"
                className="vr-card"
                data-seen={done || undefined}
                onClick={(e) => openAt(i, e.currentTarget, "card")}
                aria-label={`${i + 1}. ${clip.title}${done ? " (e parë)" : ""}`}
              >
                {clip.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- the story's own photo, already sized
                  <img className="vr-poster" src={clip.image} alt="" loading={i < 4 ? "eager" : "lazy"} decoding="async" />
                ) : (
                  <span className="vr-poster vr-poster-none" style={{ ["--c" as string]: clip.color }} aria-hidden="true" />
                )}
                <span className="vr-num" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="vr-badge">
                  <i style={{ background: clip.color }} aria-hidden="true" />
                  {clip.category}
                </span>
                <span className="vr-play" aria-hidden="true">
                  {done ? <Check size={20} strokeWidth={3} /> : <Play size={20} strokeWidth={0} fill="currentColor" />}
                </span>
                <span className="vr-card-foot">
                  <span className="vr-card-stats">{done ? "Parë" : clock(clip.duration)}</span>
                  <span className="vr-card-title">{clip.title}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open !== null && (
        <Player
          edition={edition}
          index={open}
          list={list}
          onSeen={markSeen}
          onClose={() => {
            voice().pause();
            setOpen(null);
            opener.current?.focus();
          }}
        />
      )}
    </section>
  );
}

// ── The player ──────────────────────────────────────────────────────────────

/**
 * The edition, full screen and upright on a phone; on a desktop, an upright
 * stage as tall as the window with the buttons beside it. One clip per screen
 * (scroll snap), the last screen says the reader is caught up. Esc or ✕ closes.
 */
function Player({
  edition,
  index,
  list,
  onSeen,
  onClose,
}: {
  edition: Edition;
  index: number;
  list: string;
  onSeen: (slug: string) => void;
  onClose: () => void;
}) {
  const clips = edition.clips;
  const total = clips.length + 1; // the clips, then "Je në dijeni"
  const [active, setActive] = useState(index);
  const [mounted, setMounted] = useState(false);
  const [talking, setTalking] = useState(false);
  const [playing, setPlaying] = useState(false);
  // The browser refused to start the voice without a tap of its own.
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [word, setWord] = useState(-1);
  const [streak, setStreak] = useState(0);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const segRefs = useRef<(HTMLElement | null)[]>([]);
  const how = useRef("open");
  const seen = useRef(index);
  // A clip without a voice keeps its own time.
  const silent = useRef({ base: 0, startedAt: 0, running: false });
  const watched = useRef(0);
  const opened = useRef(Date.now());
  const finished = useRef(false);
  // Clips already reported seen, so a frame does not report one again.
  const reported = useRef(new Set<string>());
  // Clips whose voice would not load: they run on their own time, words still shown.
  const noVoice = useRef(new Set<string>());
  const live = useRef({ active, playing });
  useEffect(() => {
    live.current = { active, playing };
  });

  const clip = active < clips.length ? clips[active] : undefined;

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      voice().pause();
    };
  }, []);

  // Open on the tapped clip, without scrolling past the others.
  useLayoutEffect(() => {
    const el = feedRef.current;
    if (mounted && el) el.scrollTop = index * el.clientHeight;
    if (mounted) closeRef.current?.focus({ preventScroll: true });
    // Only on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // The screen at least 60% in view is the one playing.
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
  }, [mounted]);

  const seenOnce = useCallback(
    (slug: string) => {
      if (reported.current.has(slug)) return;
      reported.current.add(slug);
      onSeen(slug);
    },
    [onSeen]
  );

  const voiced = useCallback((c: EditionClip | undefined) => Boolean(c?.audio) && !noVoice.current.has(c?.slug ?? ""), []);

  const time = useCallback(() => {
    if (!clip) return 0;
    if (voiced(clip)) return voice().currentTime || 0;
    const s = silent.current;
    return s.base + (s.running ? (performance.now() - s.startedAt) / 1000 : 0);
  }, [clip, voiced]);

  const go = useCallback(
    (dir: 1 | -1, via = "button") => {
      const el = feedRef.current;
      const next = live.current.active + dir;
      if (!el || next < 0 || next >= total) return;
      how.current = via;
      el.scrollTo({ top: next * el.clientHeight, behavior: reducedMotion() ? "auto" : "smooth" });
    },
    [total]
  );

  const play = useCallback(() => {
    if (!clip) return;
    if (!voiced(clip)) {
      const s = silent.current;
      if (!s.running) {
        s.startedAt = performance.now();
        s.running = true;
      }
      setPlaying(true);
      return;
    }
    const a = voice();
    a.play().then(
      () => {
        setBlocked(false);
        setPlaying(true);
      },
      (err: unknown) => {
        // Only a refusal needs the reader's tap; a play cut short by the next clip loading is not one.
        if ((err as { name?: string } | null)?.name !== "NotAllowedError") return;
        setBlocked(true);
        setPlaying(false);
      }
    );
  }, [clip, voiced]);

  const pause = useCallback(() => {
    if (clip && !voiced(clip)) {
      const s = silent.current;
      if (s.running) s.base += (performance.now() - s.startedAt) / 1000;
      s.running = false;
    } else voice().pause();
    setPlaying(false);
  }, [clip, voiced]);

  const toggle = useCallback(() => (live.current.playing ? pause() : play()), [pause, play]);

  // A new screen: report the one left, then start this one from the beginning.
  useEffect(() => {
    const prev = seen.current;
    if (prev !== active && prev < clips.length) {
      track("edition_clip", {
        slug: clips[prev].slug,
        position: prev + 1,
        seconds: Math.round(watched.current),
        done: watched.current >= clips[prev].duration * SEEN_AT,
        list,
        how: how.current,
      });
    }
    seen.current = active;
    how.current = "swipe";
    watched.current = 0;
    setWord(-1);
    const a = voice();
    if (!clip) {
      // "Je në dijeni": the edition is over.
      a.pause();
      setPlaying(false);
      // Reaching the end is being caught up, even past a clip skipped on the way.
      clips.forEach((c) => seenOnce(c.slug));
      if (!finished.current) {
        finished.current = true;
        setStreak(finishDay(edition.date));
        track("edition_complete", { seconds: Math.round((Date.now() - opened.current) / 1000), clips: clips.length, list });
      }
      return;
    }
    silent.current = { base: 0, startedAt: performance.now(), running: !voiced(clip) };
    if (voiced(clip)) {
      if (a.src !== clip.audio) a.src = clip.audio;
      if (prev !== active || a.currentTime > 0.5) a.currentTime = 0;
      a.muted = muted;
    }
    play();
    // Only when the screen changes; the sound setting is applied by its own effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    voice().muted = muted;
  }, [muted]);

  // The voice ended: the next clip. A voice that will not load: the clip goes on without it.
  useEffect(() => {
    const a = voice();
    const onEnded = () => {
      const c = clips[live.current.active];
      if (voiced(c) && c) {
        seenOnce(c.slug);
        go(1, "ended");
      }
    };
    const onError = () => {
      const c = clips[live.current.active];
      if (!c?.audio || a.src !== c.audio || noVoice.current.has(c.slug)) return;
      noVoice.current.add(c.slug);
      silent.current = { base: 0, startedAt: performance.now(), running: true };
      setBlocked(false);
      setPlaying(true);
    };
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    return () => {
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
    };
  }, [clips, go, seenOnce, voiced]);

  // Every frame while open: the bars along the top, the word being said, and
  // the end of a clip with no voice. The bars are written straight to the page;
  // only a new word re-renders.
  useEffect(() => {
    if (!mounted) return;
    let raf = 0;
    let lastWord = -1;
    const frame = () => {
      const c = clips[live.current.active];
      const t = c ? time() : 0;
      if (c) watched.current = Math.max(watched.current, t);
      segRefs.current.forEach((el, k) => {
        if (!el) return;
        const p = k < live.current.active ? 1 : k > live.current.active || !c ? 0 : Math.min(1, t / c.duration);
        el.style.transform = `scaleX(${p})`;
      });
      if (c) {
        let w = -1;
        for (let k = 0; k < c.words.length; k++) if (c.words[k][0] <= t + 0.05) w = k;
        if (w !== lastWord) {
          lastWord = w;
          setWord(w);
        }
        if (t >= c.duration * SEEN_AT) seenOnce(c.slug);
        if (!voiced(c) && t >= c.duration && silent.current.running) {
          silent.current = { base: c.duration, startedAt: 0, running: false };
          seenOnce(c.slug);
          go(1, "ended");
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [clips, go, mounted, seenOnce, time, voiced]);

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
      } else if (e.key === "m" || e.key === "M") setMuted((m) => !m);
      else if (e.key === " " && !(document.activeElement instanceof HTMLButtonElement && !document.activeElement.classList.contains("vr-touch"))) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, talking, toggle]);

  const slugs = useMemo(() => clips.map((c) => c.slug), [clips]);
  if (!mounted) return null;

  return createPortal(
    <div ref={dialogRef} className="vr-player" role="dialog" aria-modal="true" aria-label={clip?.title ?? "Je në dijeni"}>
      <ReactionsProvider slugs={slugs}>
        <div ref={feedRef} className="vr-feed">
          {clips.map((c, i) => (
            <Slide
              key={c.slug}
              i={i}
              count={clips.length}
              clip={c}
              active={i === active}
              playing={i === active && playing}
              blocked={i === active && blocked}
              word={i === active ? word : -1}
              list={list}
              talking={talking}
              onTalk={setTalking}
              onToggle={toggle}
              onPlay={play}
              onRead={() => {
                pause();
                track("edition_read", { slug: c.slug, position: i + 1, list });
              }}
            />
          ))}
          <EndScreen
            i={clips.length}
            edition={edition}
            active={active === clips.length}
            streak={streak || currentStreak(edition.date)}
            list={list}
            onAgain={() => {
              const el = feedRef.current;
              how.current = "again";
              startFromTap(clips[0]);
              if (el) el.scrollTo({ top: 0, behavior: "auto" });
            }}
            onClose={onClose}
          />
        </div>
      </ReactionsProvider>

      <div className="vr-player-top">
        {/* One bar per story: how far through the edition. */}
        <div className="vr-segs" aria-hidden="true">
          {clips.map((c, k) => (
            <span key={c.slug}>
              <i
                ref={(el) => {
                  segRefs.current[k] = el;
                }}
              />
            </span>
          ))}
        </div>
        <div className="vr-top-row">
          <button type="button" className="vr-player-btn" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Me zë" : "Hiq zërin"} aria-pressed={muted}>
            {muted ? <VolumeX size={20} strokeWidth={2.4} aria-hidden="true" /> : <Volume2 size={20} strokeWidth={2.4} aria-hidden="true" />}
          </button>
          <span className="vr-player-brand" aria-hidden="true">
            <b>383</b>
            <i />
            <small>Edicioni</small>
          </span>
          <button ref={closeRef} type="button" className="vr-player-btn" onClick={onClose} aria-label="Mbyll edicionin">
            <X size={22} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </div>

      <span className="vr-desk-nav">
        <button type="button" className="vr-player-btn" onClick={() => go(-1)} disabled={active === 0} aria-label="Lajmi i mëparshëm">
          <ChevronUp size={22} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <button type="button" className="vr-player-btn" onClick={() => go(1)} disabled={active >= clips.length} aria-label="Lajmi tjetër">
          <ChevronDown size={22} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </span>
    </div>,
    document.body
  );
}

/** The words on screen a few at a time, as they are said: a new line at a pause or after five words. */
function phrases(words: EditionClip["words"]): [number, number][] {
  const out: [number, number][] = [];
  let from = 0;
  let chars = 0;
  for (let k = 0; k < words.length; k++) {
    chars += words[k][2].length + 1;
    const next = words[k + 1];
    const pause = next ? next[0] - words[k][1] > 0.28 : true;
    if (pause || k - from >= 4 || chars > 26) {
      out.push([from, k]);
      from = k + 1;
      chars = 0;
    }
  }
  return out;
}

type Burst = { id: number; x: number; y: number; tilt: number };

/** One story's clip: its photo, the words as they are said, the story's line and its buttons. */
function Slide({
  i,
  count,
  clip,
  active,
  playing,
  blocked,
  word,
  list,
  talking,
  onTalk,
  onToggle,
  onPlay,
  onRead,
}: {
  i: number;
  count: number;
  clip: EditionClip;
  active: boolean;
  playing: boolean;
  blocked: boolean;
  word: number;
  list: string;
  talking: boolean;
  onTalk: (open: boolean) => void;
  onToggle: () => void;
  onPlay: () => void;
  onRead: () => void;
}) {
  const reactions = useReactions();
  const gesture = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);
  const tapTimer = useRef<number | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [likePop, setLikePop] = useState(0);
  const lines = useMemo(() => phrases(clip.words), [clip.words]);
  const line = word < 0 ? (active ? lines[0] : undefined) : lines.find(([a, b]) => word >= a && word <= b);

  const like = (x: number, y: number) => {
    if (!reactions.ok) return;
    if (reactions.mine[clip.slug] !== LIKE) reactions.react(clip.slug, LIKE);
    const id = Date.now();
    setBursts((b) => [...b.slice(-3), { id, x, y, tilt: Math.round(Math.random() * 30 - 15) }]);
    setLikePop((n) => n + 1);
    window.setTimeout(() => setBursts((b) => b.filter((p) => p.id !== id)), 950);
    track("edition_react", { slug: clip.slug, reaction: LIKE, position: i + 1, list, how: "double-tap" });
  };

  return (
    <section className="vr-slide" data-i={i} data-active={active || undefined} data-playing={playing || undefined} aria-hidden={!active} inert={!active}>
      {clip.image && (
        // eslint-disable-next-line @next/next/no-img-element -- the story's photo, blurred behind the stage
        <img className="vr-slide-bg" src={clip.image} alt="" aria-hidden="true" loading="lazy" />
      )}
      <div className="vr-frame">
        {clip.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- the story's own photo
          <img
            className="vr-photo"
            src={clip.image}
            alt=""
            data-dir={i % 2 || undefined}
            style={{ ["--kb" as string]: `${clip.duration + 2}s` }}
          />
        ) : (
          <span className="vr-photo vr-photo-none" style={{ ["--c" as string]: clip.color }} aria-hidden="true" />
        )}
        {/* Soft dark at the top and bottom, so the buttons and words read on any photo. */}
        <span className="vr-vignette" aria-hidden="true" />
        {/* Taps here: one pauses, two give 👍; a swipe scrolls the edition. */}
        <button
          type="button"
          className="vr-touch"
          aria-label={playing ? "Ndalo" : "Luaj"}
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
              onToggle();
            }, 280);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onToggle();
          }}
        >
          {active && !playing && !blocked && (
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
        {blocked && (
          <button type="button" className="vr-start" onClick={onPlay}>
            <span>
              <Play size={30} strokeWidth={0} fill="currentColor" aria-hidden="true" />
            </span>
            Luaj me zë
          </button>
        )}

        {/* The words as they are said; the whole script for a reader with a screen reader. */}
        <p className="sr-only">{clip.script}</p>
        <div className="vr-caption" aria-hidden="true">
          {clip.words.length === 0 ? (
            active && <span className="vr-caption-plain">{clip.script}</span>
          ) : (
            line && (
              <span key={line[0]} className="vr-caption-line">
                {clip.words.slice(line[0], line[1] + 1).map((w, k) => (
                  <span key={k} data-now={line[0] + k === word || undefined} data-said={line[0] + k < word || undefined}>
                    {w[2]}
                  </span>
                ))}
              </span>
            )
          )}
        </div>

        <div className="vr-info">
          <span className="vr-player-meta">
            <i style={{ background: clip.color }} aria-hidden="true" />
            {clip.category}
            {clip.publishedAt && (
              <>
                {" · "}
                <TimeAgo iso={clip.publishedAt} />
              </>
            )}
            <span className="vr-count-of">
              {i + 1}/{count}
            </span>
          </span>
          <h3 className="vr-player-title">{clip.title}</h3>
          <div className="vr-player-actions">
            <Link href={`/article/${clip.slug}`} className="vr-player-read" onClick={onRead}>
              Lexo lajmin <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
            </Link>
            {clip.imageCreator && (
              <a
                className="vr-credit"
                href={clip.imageSourcePage || undefined}
                target="_blank"
                rel="noopener noreferrer"
              >
                Foto: {clip.imageCreator}
                {clip.imageLicense && <> · {clip.imageLicense}</>}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="vr-side">
        <Actions clip={clip} list={list} position={i + 1} likePop={likePop} onTalk={onTalk} />
      </div>
    </section>
  );
}

/** The last screen: caught up, the day's headlines, and when the next edition comes. */
function EndScreen({
  i,
  edition,
  active,
  streak,
  list,
  onAgain,
  onClose,
}: {
  i: number;
  edition: Edition;
  active: boolean;
  streak: number;
  list: string;
  onAgain: () => void;
  onClose: () => void;
}) {
  const [sharing, setSharing] = useState(false);
  const clips = edition.clips;
  return (
    <section className="vr-slide vr-end" data-i={i} data-active={active || undefined} aria-hidden={!active} inert={!active}>
      <div className="vr-end-inner">
        <span className="vr-check" aria-hidden="true">
          <svg viewBox="0 0 52 52" width="64" height="64">
            <circle cx="26" cy="26" r="24" />
            <path d="M15 27l7 7 15-16" />
          </svg>
        </span>
        <h2 className="vr-end-title">Je në dijeni.</h2>
        <p className="vr-end-sub">
          {clips.length} lajmet kryesore të sotme, në {minutes(clips)} minuta.
          {streak >= 2 && <span className="vr-streak"> 🔥 {streak} ditë radhazi</span>}
        </p>
        <ol className="vr-end-list">
          {clips.map((c) => (
            <li key={c.slug}>
              <Link href={`/article/${c.slug}`} onClick={() => track("edition_read", { slug: c.slug, list, how: "end" })}>
                <i style={{ background: c.color }} aria-hidden="true" />
                {c.title}
              </Link>
            </li>
          ))}
        </ol>
        <p className="vr-end-next">Edicioni përditësohet kur ka lajme të mëdha. I radhës: nesër në 07:00.</p>
        <div className="vr-end-actions">
          <button type="button" className="vr-end-btn" data-primary onClick={() => setSharing(true)}>
            <Share2 size={17} strokeWidth={2.4} aria-hidden="true" />
            Ndaje edicionin
          </button>
          <button type="button" className="vr-end-btn" onClick={onAgain}>
            <RotateCcw size={16} strokeWidth={2.4} aria-hidden="true" />
            Nga fillimi
          </button>
          <button type="button" className="vr-end-btn" onClick={onClose}>
            Mbyll
          </button>
        </div>
      </div>
      {sharing && (
        <ShareSheet
          url={`${SITE}/video`}
          title="Edicioni video i 383"
          label={`${clips.length} lajmet kryesore të sotme, në ${minutes(clips)} minuta`}
          image={clips.find((c) => c.image)?.image ?? ""}
          what="edition"
          list={list}
          onClose={() => setSharing(false)}
        />
      )}
    </section>
  );
}

/** The column beside the clip: 👍 Pëlqej, the reactions, comments, share — the story's own. */
function Actions({
  clip,
  list,
  position,
  likePop,
  onTalk,
}: {
  clip: EditionClip;
  list: string;
  position: number;
  /** Bumped by a double-tap, so the button celebrates too. */
  likePop: number;
  onTalk: (open: boolean) => void;
}) {
  const reactions = useReactions();
  const thread = useCommentThread(clip.slug, (n) => reactions.setComments(clip.slug, n));
  const [picking, setPicking] = useState(false);
  const [talking, setTalking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [pop, setPop] = useState(0);
  const [fly, setFly] = useState<{ id: number; emoji: string } | null>(null);
  const [sent, setSent] = useState(0);
  const tally = reactions.tallies[clip.slug] ?? {};
  const mine = reactions.mine[clip.slug];
  const likes = tally[LIKE] ?? 0;
  const total = Object.values(tally).reduce((a: number, b) => a + (Number(b) || 0), 0);
  const comments = reactions.comments[clip.slug] ?? 0;
  const likePops = pop + likePop;

  const react = (key: StoryReactionKey) => {
    const undo = mine === key;
    reactions.react(clip.slug, key);
    setPicking(false);
    if (key === LIKE) setPop((n) => n + 1);
    else if (!undo) {
      const emoji = STORY_REACTIONS.find((r) => r.key === key)?.emoji ?? "";
      const id = Date.now();
      setFly({ id, emoji });
      window.setTimeout(() => setFly((f) => (f?.id === id ? null : f)), 900);
    }
    track("edition_react", { slug: clip.slug, reaction: key, position, list });
  };

  const talk = (open: boolean) => {
    setTalking(open);
    onTalk(open);
    if (open) track("edition_comments", { slug: clip.slug, position, list });
  };

  const share = (open: boolean) => {
    setSharing(open);
    onTalk(open);
    if (open) setSent((n) => n + 1);
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
      {reactions.commentsOk && <CommentsSheet open={talking} onClose={() => talk(false)} thread={thread} title={clip.title} />}
      {sharing && (
        <ShareSheet
          url={clipUrl(clip)}
          title={clip.title}
          label={`${clip.category} · Edicioni video i 383`}
          image={clip.image}
          what={clip.slug}
          list={list}
          position={position}
          onClose={() => share(false)}
        />
      )}
    </div>
  );
}

/** Sharing: the picture, the title and the 383 link, to copy or send on. */
function ShareSheet({
  url,
  title,
  label,
  image,
  what,
  list,
  position,
  onClose,
}: {
  url: string;
  title: string;
  label: string;
  image: string;
  /** For analytics: the story's slug, or "edition". */
  what: string;
  list: string;
  position?: number;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const firstRef = useRef<HTMLButtonElement | null>(null);
  // The player re-renders with every word said; the sheet opens once.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
    firstRef.current?.focus({ preventScroll: true });
    track("edition_share", { what, position, list });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Once, when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
      track("edition_share_to", { what, to: "copy", position, list });
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
      onClick={() => track("edition_share_to", { what, to: where, position, list })}
    >
      {where}
    </a>
  );

  return (
    <div className="vr-share" role="dialog" aria-modal="true" aria-label="Ndaje">
      <button type="button" className="vr-share-scrim" aria-label="Mbyll" tabIndex={-1} onClick={onClose} />
      <div className="vr-share-card">
        <span className="vr-share-grip" aria-hidden="true" />
        <div className="vr-share-preview">
          {image && (
            // eslint-disable-next-line @next/next/no-img-element -- the story's own photo
            <img src={image} alt="" />
          )}
          <div>
            <small>{label}</small>
            <b>{title}</b>
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
                navigator.share({ title, text: title, url }).catch(() => {});
                track("edition_share_to", { what, to: "native", position, list });
              }}
            >
              <Share2 size={18} strokeWidth={2.4} aria-hidden="true" />
              Më shumë
            </button>
          )}
        </div>
        <div className="vr-share-row">
          {out("WhatsApp", `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`)}
          {out("Facebook", `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)}
          {out("X", `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`)}
          {out("Telegram", `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`)}
        </div>
        <button type="button" className="vr-share-close" onClick={onClose}>
          Mbyll
        </button>
      </div>
    </div>
  );
}
