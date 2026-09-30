"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BOOTED_KEY } from "@/lib/dardani-boot";
import { DARDANI_LOOPS, type DardaniLoopName } from "@/lib/dardani-assets";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

/**
 * Dardani while a page loads — a full-screen cover with him animated in the
 * middle and a pill-shaped progress bar underneath, counting 0–100%.
 *
 * Moving between pages: Dardani runs — but only on a slow page. The cover
 * appears when a page has taken longer than 1.2s to arrive; anything quicker
 * goes by without it, because a cover on every page change is an annoyance,
 * not a courtesy.
 * Its progress moves on real events, never on a timer pretending to know:
 *
 *   navigation starts    12%   the router asks the server for the page
 *   the page's data in   70%   the router's page request answered
 *   the page is up      100%   the router committed the new URL
 *
 * and between those it only creeps toward the next stage. The start is caught
 * from the router's own page request (fetch with `_rsc`, not a prefetch), so it
 * covers every way a page is opened — links, router.push from a button, the
 * search overlay, back and forward — without touching each caller. A change of only the query on
 * the same page (a filter) is not a page load and gets no cover.
 *
 * First load of a session: Dardani flies, and the bar counts what has actually
 * loaded — the fonts and the images on screen. The video is in the server HTML
 * so it plays before any JavaScript runs; an inline script in the root layout
 * hides the cover before paint for a reader who has already had it this session,
 * and a CSS timer removes it if JavaScript never arrives.
 *
 * Both covers use the sign-in screen's background — its warm cream gradient and
 * drifting orange plumes — with Dardani and the pill on a cream card in the
 * middle, the way the sign-in form sits on its card. The card is exactly the
 * cream the MP4 is flattened onto, so the MP4 plays in every browser, Safari
 * included, with no transparency to support; its edges are feathered so the
 * last shade of decoder difference never reads as a box. Under
 * prefers-reduced-motion the loop's first frame stands still.
 */

const SHOW_AFTER_MS = 1200;
const BOOT_MAX_MS = 3500;

/** A router request for a page (not a prefetch, not a server action), and its path. */
function routerPageRequest(input: RequestInfo | URL, init?: RequestInit): string | null {
  try {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (url.origin !== window.location.origin || !url.searchParams.has("_rsc")) return null;
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
    if (headers.has("next-router-prefetch") || headers.has("next-action")) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

export default function PageLoader() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const active = useRef(false);
  const showTimer = useRef(0);
  const creep = useRef(0);
  const doneTimer = useRef(0);

  const raise = useCallback((to: number) => setProgress((p) => Math.max(p, to)), []);

  const start = useCallback(() => {
    if (active.current) return;
    window.clearTimeout(showTimer.current);
    window.clearTimeout(doneTimer.current);
    window.clearInterval(creep.current);
    active.current = true;
    setLeaving(false);
    setProgress(12);
    showTimer.current = window.setTimeout(() => {
      if (active.current) setVisible(true);
    }, SHOW_AFTER_MS);
    // Creep toward, never past, the next real stage.
    creep.current = window.setInterval(() => {
      setProgress((p) => (p < 70 ? p + (70 - p) * 0.06 : p < 94 ? p + (94 - p) * 0.03 : p));
    }, 200);
  }, []);

  const finish = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    window.clearTimeout(showTimer.current);
    window.clearInterval(creep.current);
    setProgress(100);
    setLeaving(true);
    doneTimer.current = window.setTimeout(() => {
      setVisible(false);
      setLeaving(false);
      setProgress(0);
    }, 420);
  }, []);

  // Warm the running loop, so he is running the moment the cover appears.
  useEffect(() => {
    const idle = window.setTimeout(() => {
      void fetch(DARDANI_LOOPS.running.mp4).catch(() => {});
      const img = new window.Image();
      img.src = DARDANI_LOOPS.running.poster;
    }, 1500);
    return () => window.clearTimeout(idle);
  }, []);

  // The router asking for another page starts it, and its answer is the page's
  // data arriving. This is the one start signal on purpose: it fires for links,
  // router.push and back/forward alike, and — unlike a click or popstate — only
  // when a page is really coming, so the cover can never be left waiting for a
  // navigation some click handler cancelled. A page the router already holds
  // arrives without a request, and without a cover, because it is instant.
  useEffect(() => {
    const original = window.fetch;
    const watched: typeof window.fetch = async (input, init) => {
      const path = routerPageRequest(input, init);
      const forAnotherPage = path !== null && path !== window.location.pathname;
      if (forAnotherPage) start();
      const response = await original.call(window, input, init);
      if (forAnotherPage && active.current) raise(70);
      return response;
    };
    window.fetch = watched;
    return () => {
      window.fetch = original;
    };
  }, [start, raise]);

  // The router committed the new URL: the page is on screen.
  useEffect(() => {
    const push = history.pushState;
    const replace = history.replaceState;
    const commit = (fn: typeof history.pushState) =>
      function (this: History, ...args: Parameters<typeof history.pushState>) {
        const before = window.location.pathname + window.location.search;
        const result = fn.apply(this, args);
        const after = window.location.pathname + window.location.search;
        // Deferred, never inline: the router commits the URL from inside a React
        // insertion effect, where scheduling a state update throws — and that
        // throw breaks the navigation itself.
        if (after !== before) window.setTimeout(finish, 0);
        return result;
      };
    history.pushState = commit(push);
    history.replaceState = commit(replace);
    return () => {
      history.pushState = push;
      history.replaceState = replace;
    };
  }, [finish]);

  // Belt and braces: a pathname change always means we have arrived.
  useEffect(() => {
    finish();
  }, [pathname, finish]);

  // Never strand the cover: 10s is a navigation that failed, not a slow one.
  useEffect(() => {
    if (!visible || leaving) return;
    const timer = window.setTimeout(finish, 10000);
    return () => window.clearTimeout(timer);
  }, [visible, leaving, finish]);

  useEffect(
    () => () => {
      window.clearTimeout(showTimer.current);
      window.clearTimeout(doneTimer.current);
      window.clearInterval(creep.current);
    },
    [],
  );

  return (
    <>
      {visible && <LoaderCover loop="running" progress={progress} leaving={leaving} />}
      <BootLoader />
    </>
  );
}

/** The full-screen cover: Dardani animated, "Po ngarkohet…", and the pill. */
function LoaderCover({
  loop,
  progress,
  leaving,
  boot = false,
}: {
  loop: DardaniLoopName;
  progress: number;
  leaving: boolean;
  boot?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const clip = DARDANI_LOOPS[loop];
  const pct = Math.round(Math.min(100, Math.max(0, progress)));

  // React sets `muted` as a property and never writes the attribute, which
  // iOS wants before it will autoplay. Reduced motion stops on frame one.
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.setAttribute("muted", "");
    if (reduced) {
      v.pause();
      v.currentTime = 0;
    } else if (v.paused) {
      void v.play().catch(() => {});
    }
  }, [reduced]);

  return (
    <div className="dardani-cover" data-boot={boot || undefined} data-leaving={leaving || undefined}>
      {/* The sign-in screen's orange plume field (globals.css .auth-plume*),
          reused as is so the two stay one look. */}
      <div className="auth-plumes" aria-hidden="true">
        {["l1", "l2", "l3", "r1", "r2", "r3"].map((id) => (
          <div key={id} className={`auth-plume auth-plume-${id}`}>
            <div className="auth-plume-body" />
          </div>
        ))}
      </div>
      <div className="auth-grain" aria-hidden="true" />
      <div
        className="dardani-cover-inner"
        role="progressbar"
        aria-label="Po ngarkohet faqja"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <video
          ref={videoRef}
          className="dardani-cover-video"
          src={clip.mp4}
          poster={clip.poster}
          width={clip.width}
          height={clip.height}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
        />
        <p className="dardani-cover-label">Po ngarkohet…</p>
        <span className="dardani-cover-pill">
          <i style={{ width: `${pct}%` }} />
        </span>
        <span className="dardani-cover-pct">{pct}%</span>
      </div>
    </div>
  );
}

/** The first-load cover with the flying Dardani, once per session. */
function BootLoader() {
  const [progress, setProgress] = useState(8);
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let alreadyBooted = false;
    try {
      alreadyBooted = sessionStorage.getItem(BOOTED_KEY) === "1";
      sessionStorage.setItem(BOOTED_KEY, "1");
    } catch {
      // Without session storage it shows on each full load, which is harmless.
    }
    if (alreadyBooted) {
      setGone(true);
      return;
    }

    const startedAt = performance.now();
    let done = false;
    let fontsReady = false;
    document.fonts?.ready.then(() => {
      fontsReady = true;
    });

    const inView = () =>
      Array.from(document.images).filter((img) => {
        if (img.closest(".dardani-cover")) return false;
        const r = img.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
      });

    const leave = () => {
      if (done) return;
      done = true;
      setProgress(100);
      setLeaving(true);
      window.setTimeout(() => setGone(true), 460);
    };

    const tick = () => {
      if (done) return;
      const images = inView();
      const loaded = images.filter((img) => img.complete).length;
      const parts = images.length + 1;
      const doneParts = loaded + (fontsReady ? 1 : 0);
      setProgress(Math.max(8, Math.round((doneParts / parts) * 100)));
      if (doneParts >= parts || performance.now() - startedAt > BOOT_MAX_MS) leave();
      else window.setTimeout(tick, 120);
    };
    tick();
  }, []);

  if (gone) return null;
  return <LoaderCover loop="flying" progress={progress} leaving={leaving} boot />;
}
