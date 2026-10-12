"use client";

// The reader's paper as a reel (lib/paper-reel.mjs): one full screen at a
// time, swiped up like TikTok, each screen set like an Apple News story.
//
// Moving is the browser's own snap scrolling — a swipe on a phone, the wheel
// or trackpad on a computer — so it feels native everywhere and never sticks.
// ↑ ↓ (and j / k, Page Up / Down) step one screen; on a wide screen the list on
// the right shows everything in today's paper and jumps to any of it. The
// screen is in the address (#lajmi-4), so coming back from an article lands
// on the same story.
//
// Bars at the top show where the reader is inside the current group (today's
// edition, or one follow), the way Stories do.
//
// This component only moves between screens; app/per-ty/paper/slides.tsx
// draws them.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp } from "lucide-react";
import { hashForSlide, slideFromHash } from "@/lib/paper-reel.mjs";

export type ReelScreen = {
  key: string;
  kind: "cover" | "brief" | "story" | "section" | "end";
  title: string;
  /** Stories and the boxes: their group, place in it and its size, for the bars at the top. */
  group?: string;
  groupTitle?: string;
  pos?: number;
  of?: number;
  /** Stories: a small picture for the list on the right. */
  thumb?: string | null;
  read?: boolean;
  node: ReactNode;
};

function reducedMotion() {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

/** Can this box still scroll in the wheel's direction? */
function canScroll(el: Element | null, dy: number) {
  const box = el as HTMLElement | null;
  if (!box || box.scrollHeight <= box.clientHeight + 1) return false;
  return dy > 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 1 : box.scrollTop > 0;
}

function isEditable(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  return Boolean(node?.closest?.("input, textarea, select, [contenteditable='true'], [role='dialog']"));
}

/** A small picture in the list; a broken one becomes a plain tile. */
function ListThumb({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="fy-list-thumb fy-list-thumb--none" aria-hidden="true" />;
  return (
    <span className="fy-list-thumb">
      <Image src={src} alt="" fill sizes="56px" style={{ objectFit: "cover" }} onError={() => setFailed(true)} />
    </span>
  );
}

export default function Reel({
  screens,
  look,
  label,
  name,
  sub,
  tools,
  hint = false,
  onShown,
  onMove,
}: {
  screens: ReelScreen[];
  look: string;
  /** "Gazeta e Lindit" — names the whole paper for assistive tech. */
  label: string;
  /** The paper's name, at the top of the list on a wide screen and over the screen on a phone. */
  name: ReactNode;
  /** One line under the name in the list: the date, how much is in it. */
  sub?: ReactNode;
  /** Share, arrange, how it works. */
  tools?: ReactNode;
  /** First visit: say how to move on. */
  hint?: boolean;
  /** The screen on view, once it has settled. */
  onShown?: (index: number) => void;
  /** The reader moved on from the first screen (any way at all). */
  onMove?: () => void;
}) {
  const count = screens.length;
  const [index, setIndex] = useState(0);
  const reelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const indexRef = useRef(0);
  // Where a move already asked for is heading, until the reel gets there.
  const headingRef = useRef<number | null>(null);
  const ready = useRef(false);
  // The parent's callbacks change identity every render; read them through refs.
  const shownRef = useRef(onShown);
  shownRef.current = onShown;
  const moveRef = useRef(onMove);
  moveRef.current = onMove;

  const jump = useCallback((to: number, smooth = true) => {
    const reel = reelRef.current;
    const target = reel?.children[Math.min(Math.max(to, 0), (reel?.children.length ?? 1) - 1)] as HTMLElement | undefined;
    if (!reel || !target) return;
    headingRef.current = Number(target.dataset.index);
    reel.scrollTo({ top: target.offsetTop, behavior: smooth && !reducedMotion() ? "smooth" : "auto" });
  }, []);

  // Start on the screen in the address.
  useEffect(() => {
    const start = slideFromHash(window.location.hash, count);
    indexRef.current = start;
    setIndex(start);
    requestAnimationFrame(() => {
      jump(start, false);
      ready.current = true;
    });
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which screen is on view: the one covering most of the reel.
  useEffect(() => {
    const reel = reelRef.current;
    if (!reel) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!ready.current) return;
        for (const e of entries) {
          if (!e.isIntersecting || e.intersectionRatio < 0.6) continue;
          const i = Number((e.target as HTMLElement).dataset.index);
          if (Number.isFinite(i) && i !== indexRef.current) {
            if (indexRef.current === 0) moveRef.current?.();
            if (headingRef.current === i) headingRef.current = null;
            indexRef.current = i;
            setIndex(i);
          }
        }
      },
      { root: reel, threshold: [0.6] }
    );
    for (const child of Array.from(reel.children)) io.observe(child);
    return () => io.disconnect();
  }, [count]);

  useEffect(() => {
    if (!screens[index]) return;
    try {
      window.history.replaceState(window.history.state, "", hashForSlide(index));
    } catch {
      // A sandboxed frame may refuse; the reel still works.
    }
    shownRef.current?.(index);
    listRef.current?.querySelector("[aria-current='true']")?.scrollIntoView({ block: "nearest" });
    // screens change identity every render; the index is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Links inside the paper ("Fillo", the cover's headlines) move by address.
  useEffect(() => {
    const onHash = () => jump(slideFromHash(window.location.hash, count));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [jump, count]);

  // ↑ ↓, j k, Page Up / Down
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isEditable(e.target)) return;
      if (document.querySelector("dialog[open]")) return;
      const down = e.key === "ArrowDown" || e.key === "PageDown" || e.key === "j";
      const up = e.key === "ArrowUp" || e.key === "PageUp" || e.key === "k";
      if (!down && !up) return;
      e.preventDefault();
      jump((headingRef.current ?? indexRef.current) + (down ? 1 : -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jump]);

  // Wheel and trackpad: one gesture, one screen. The browser's own snapping
  // needs half a screen of wheel before it moves on, and a notch is far less.
  // A light screen with more in it scrolls first; at either end of the paper
  // the wheel is left to the page.
  useEffect(() => {
    const reel = reelRef.current;
    if (!reel) return;
    let acc = 0;
    let last = 0;
    let spent = false;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom
      const now = performance.now();
      if (now - last > 260) {
        acc = 0;
        spent = false;
      }
      last = now;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      if (!d) return;
      if (canScroll((e.target as HTMLElement)?.closest?.(".fy-panel") ?? null, d)) return;
      const target = (headingRef.current ?? indexRef.current) + (d > 0 ? 1 : -1);
      if (target < 0 || target >= count) return;
      e.preventDefault();
      if (spent) return;
      acc += d;
      if (Math.abs(acc) >= 30) {
        acc = 0;
        spent = true;
        jump(target);
      }
    };
    reel.addEventListener("wheel", onWheel, { passive: false });
    return () => reel.removeEventListener("wheel", onWheel);
  }, [count, jump]);

  const current = screens[index];
  const bars = (current?.kind === "story" || current?.kind === "brief") && current.of ? current : null;

  return (
    <div className="fy" data-look={look}>
      <div className="fy-main" data-tone={current?.kind === "end" ? "light" : "dark"}>
        <div className="fy-top">
          {bars ? (
            <div className="fy-bars" aria-hidden="true">
              {Array.from({ length: bars.of ?? 0 }, (_, i) => (
                <span key={i} data-on={i <= (bars.pos ?? 0) || undefined} />
              ))}
            </div>
          ) : (
            <div className="fy-bars fy-bars--all" aria-hidden="true">
              <span style={{ transform: `scaleX(${count > 1 ? index / (count - 1) : 1})` }} />
            </div>
          )}
          <div className="fy-top-row">
            <p className="fy-top-where">
              <b>{name}</b>
              {bars?.groupTitle ? <span>{bars.groupTitle}</span> : null}
            </p>
            {tools && <div className="fy-tools fy-tools--top">{tools}</div>}
          </div>
        </div>

        <div ref={reelRef} className="fy-reel" role="feed" aria-label={label} aria-busy="false">
          {screens.map((s, i) => (
            <article
              key={s.key}
              className="fy-screen"
              data-index={i}
              data-kind={s.kind}
              data-active={i === index || undefined}
              data-dir={i % 2 ? "b" : "a"}
              aria-posinset={i + 1}
              aria-setsize={count}
              aria-label={s.title}
            >
              {s.node}
            </article>
          ))}
        </div>

        <div className="fy-steps">
          <button type="button" onClick={() => jump(index - 1)} disabled={index === 0} aria-label="Lajmi i mëparshëm">
            <ChevronUp size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => jump(index + 1)} disabled={index >= count - 1} aria-label="Lajmi tjetër">
            <ChevronDown size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>

        {/* What comes next, so there is always a reason to keep going. */}
        {screens[index + 1] && (
          <button type="button" className="fy-peek" onClick={() => jump(index + 1)}>
            <span className="fy-peek-label">Më pas</span>
            <span className="fy-peek-title">
              {screens[index + 1].kind === "section" ? `${screens[index + 1].title} — lajmet e tua` : screens[index + 1].title}
            </span>
            <ChevronDown size={16} strokeWidth={2.6} aria-hidden="true" />
          </button>
        )}

        {hint && index === 0 && (
          <button type="button" className="fy-hint" onClick={() => jump(1)}>
            <span className="fy-hint-phone">Rrëshqit lart për lajmin e parë</span>
            <span className="fy-hint-wide">Rrotullo ose shtyp ↓ për lajmin e parë</span>
            <ChevronUp size={18} strokeWidth={2.6} aria-hidden="true" />
          </button>
        )}
      </div>

      <aside className="fy-side" aria-label="Në këtë numër">
        <header className="fy-side-head">
          <p className="fy-side-name">{name}</p>
          {sub && <p className="fy-side-sub">{sub}</p>}
          {tools && <div className="fy-tools">{tools}</div>}
        </header>
        <ol ref={listRef} className="fy-list">
          {screens.map((s, i) =>
            s.kind === "section" ? (
              <li key={s.key} className="fy-list-group">
                <button type="button" onClick={() => jump(i)} aria-current={i === index ? "true" : undefined}>
                  {s.title}
                </button>
              </li>
            ) : (
              <li key={s.key}>
                <button type="button" className="fy-list-item" onClick={() => jump(i)} aria-current={i === index ? "true" : undefined} data-read={s.read || undefined}>
                  {s.kind === "story" ? (
                    s.thumb ? (
                      <ListThumb src={s.thumb} />
                    ) : (
                      <span className="fy-list-thumb fy-list-thumb--none" aria-hidden="true" />
                    )
                  ) : null}
                  <span className="fy-list-title">{s.title}</span>
                </button>
              </li>
            )
          )}
        </ol>
      </aside>
    </div>
  );
}
