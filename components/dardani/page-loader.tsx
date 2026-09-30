"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { DardaniLoopName } from "@/lib/dardani-assets";
import DardaniLoop from "./dardani-loop";

/**
 * Dardani while a page loads: a full-screen cover on the sign-in screen's
 * orange plume field, Dardani animated in the middle with a line in a speech
 * bubble, and a pill underneath that fills 0–100%.
 *
 * Only for a real wait. Between pages the cover appears when a page has taken
 * longer than 3 seconds; anything quicker goes by without it, because a cover
 * that shows for a moment reads as a flicker, not a courtesy. There is no cover
 * on a first visit at all.
 *
 * Each time it appears it is the next of three Dardanis — running, flying, and
 * flying with the rolled-up map at his feet — so a reader who waits more than
 * once meets a different one.
 *
 * Progress moves on real events, never on a timer pretending to know:
 *
 *   navigation starts    12%   the router asks the server for the page
 *   the page's data in   70%   that request is answered
 *   the page is up      100%   the router commits the new URL
 *
 * and between those it only creeps toward the next stage. The start is the
 * router's own page request (fetch with `_rsc`, not a prefetch), so it covers
 * links, router.push and back/forward alike, and — unlike a click — only fires
 * when a page is really coming. A change of only the query on the same page (a
 * filter) is not a page load and gets no cover.
 */

const SHOW_AFTER_MS = 3000;
const ROTATION: DardaniLoopName[] = ["running", "flying", "flying-news"];
const ROTATION_KEY = "383:loader-turn";

/** The next Dardani in the rotation, remembered for the session. */
function nextLoop(): DardaniLoopName {
  let turn = 0;
  try {
    turn = Number(sessionStorage.getItem(ROTATION_KEY)) || 0;
    sessionStorage.setItem(ROTATION_KEY, String(turn + 1));
  } catch {
    turn = Math.floor(Math.random() * ROTATION.length);
  }
  return ROTATION[turn % ROTATION.length];
}

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
  const [loop, setLoop] = useState<DardaniLoopName>("running");
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
      if (!active.current) return;
      setLoop(nextLoop());
      setVisible(true);
    }, SHOW_AFTER_MS);
    // Creep toward, never past, the next real stage.
    creep.current = window.setInterval(() => {
      setProgress((p) => (p < 70 ? p + (70 - p) * 0.05 : p < 94 ? p + (94 - p) * 0.03 : p));
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
    }, 460);
  }, []);

  // The router asking for another page starts it, and its answer is the page's
  // data arriving. A page the router already holds arrives without a request,
  // and without a cover, because it is instant.
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

  // Never strand the cover: 15s is a navigation that failed, not a slow one.
  useEffect(() => {
    if (!visible || leaving) return;
    const timer = window.setTimeout(finish, 15000);
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

  if (!visible) return null;
  return <DardaniLoadingScreen loop={loop} progress={progress} leaving={leaving} />;
}

/**
 * The loading screen for a page that knows it is waiting but not how far along
 * it is (a Tregu market fetching its data): the next Dardani in the rotation,
 * and a pill that creeps toward — never past — 90% for as long as it is shown.
 */
export function DardaniWaiting({ label }: { label: string }) {
  // Picked after mount: the server render and the first client render must agree.
  const [loop, setLoop] = useState<DardaniLoopName>("running");
  const [progress, setProgress] = useState(10);
  useEffect(() => {
    setLoop(nextLoop());
    const timer = window.setInterval(() => setProgress((p) => p + (90 - p) * 0.06), 200);
    return () => window.clearInterval(timer);
  }, []);
  return <DardaniLoadingScreen loop={loop} progress={progress} label={label} />;
}

/**
 * The loading screen itself. Also used directly where a page knows it is
 * loading (a Tregu market fetching its data), with its own `label`.
 */
export function DardaniLoadingScreen({
  loop,
  progress,
  leaving = false,
  label = "Po ngarkohet…",
}: {
  loop: DardaniLoopName;
  progress: number;
  leaving?: boolean;
  label?: string;
}) {
  const pct = Math.round(Math.min(100, Math.max(0, progress)));
  const running = loop === "running";
  return (
    <div className="dardani-cover" data-leaving={leaving || undefined} data-loop={loop}>
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
        aria-label={label.replace(/…$/, "")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <p className="dardani-cover-say">{label}</p>
        <div className="dardani-cover-stage">
          {/* Motion under him that matches the loop: the ground rushing by
              under the runner, clouds drifting past the flyer. */}
          <span className="dardani-cover-trail" data-kind={running ? "ground" : "sky"} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <DardaniLoop name={loop} decorative className="dardani-cover-dardani" />
          <span className="dardani-cover-shadow" data-flying={!running || undefined} aria-hidden="true" />
        </div>
        <span className="dardani-cover-pill">
          <i style={{ width: `${pct}%` }} />
        </span>
        <span className="dardani-cover-pct">{pct}%</span>
      </div>
    </div>
  );
}
