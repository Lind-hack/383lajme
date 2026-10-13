"use client";

// Lets "Për ty" and Dardani's suggestions learn from what the reader clicks and
// reads — and for how long.
//
// Mounted on the article page, and in Për ty's reader (app/per-ty/paper/
// reader-sheet.tsx), where the story scrolls inside a sheet: `scroller` is
// that sheet. Opening an article is a click, and counts a
// little straight away (OPEN_WEIGHT). From then on the page measures engaged
// time: a second counts only while the tab is visible and the reader has
// scrolled, touched or moved within the last half minute, so a tab left open
// on the table adds nothing. It also measures how far down the story they got.
// lib/reading-engagement.mjs turns time, depth and the story's length into one
// weight, from a bounce (OPEN_WEIGHT) up to a full read (FULL_WEIGHT), and
// every key the story carries — its category, the listed people it names, its
// city — gains it in the reader's device-stored interests, with the engaged
// seconds alongside for "lexove 4 lajme, 12 minuta".
//
// The weight is saved as the visit goes (every few seconds, when the tab is
// hidden, when the page is left) and each save adds only what the visit gained
// since the last one, so a phone reader who just closes the app still counts
// and nothing counts twice.
//
// Ten engaged seconds make a real read: the story goes into the reader's
// ledger (lib/reader-ledger.mjs), the tally their monthly and yearly wrapped
// are made from, and anything waiting on it hears READ_EVENT (Dardani's "Ta
// bëra gazetën", components/paper-ready.tsx). The story is also remembered as
// opened, so Për ty files it below the ones not yet seen. Nothing is sent
// anywhere; "Harro historikun e leximit" clears it.
//
// Renders nothing.

import { useEffect } from "react";
import { readInterests, writeInterests, recordRead } from "@/lib/interests.mjs";
import { articleKeys } from "@/lib/per-ty-rank.mjs";
import { rememberRead } from "@/lib/perty-visits.mjs";
import { noteRead } from "@/lib/reader-ledger.mjs";
import { OPEN_WEIGHT, REAL_READ_S, visitWeight, weightToAdd } from "@/lib/reading-engagement.mjs";
import { READ_EVENT } from "@/components/paper-ready";

/** No scroll, touch or key for this long and the reader has stopped reading. */
const IDLE_MS = 30_000;
/** How often the visit is saved while it goes on. */
const SAVE_EVERY_S = 15;

export default function ReadingAffinity({
  slug,
  title,
  excerpt,
  category,
  city,
  words,
  scroller,
}: {
  slug: string;
  title: string;
  excerpt?: string;
  category?: string;
  city?: string;
  /** Words in the story's body, so a minute counts as finishing a short story and a skim of a long one. */
  words?: number;
  /** The box the story scrolls in, when it is not the page. */
  scroller?: HTMLElement | null;
}) {
  useEffect(() => {
    rememberRead(slug);
  }, [slug]);

  useEffect(() => {
    const keys = articleKeys({ title, excerpt, category, city });
    let engaged = 0;
    let depth = 0;
    let lastActive = Date.now();
    let credited = 0;
    let creditedSeconds = 0;
    let realRead = false;

    const save = (read = false) => {
      if (keys.length === 0) return;
      const add = weightToAdd(credited, visitWeight({ engagedS: engaged, depth, words }));
      const seconds = engaged - creditedSeconds;
      if (add <= 0 && seconds <= 0 && !read) return;
      try {
        const current = readInterests();
        writeInterests({ ...current, affinity: recordRead(current.affinity, keys, Date.now(), add, { seconds, read }) });
        credited += add;
        creditedSeconds = engaged;
      } catch {
        // Storage refused: the paper simply learns less from this visit.
      }
    };

    // The click itself.
    if (keys.length) {
      try {
        const current = readInterests();
        writeInterests({ ...current, affinity: recordRead(current.affinity, keys, Date.now(), OPEN_WEIGHT) });
        credited = OPEN_WEIGHT;
      } catch {
        // as above
      }
    }

    const story = () => document.querySelector<HTMLElement>(".article-story");
    const measureDepth = () => {
      if (scroller) {
        if (scroller.scrollHeight <= 0) return;
        const seen = (scroller.scrollTop + scroller.clientHeight) / scroller.scrollHeight;
        depth = Math.max(depth, Math.min(1, Math.max(0, seen)));
        return;
      }
      const el = story();
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.height <= 0) return;
      const seen = (window.innerHeight - rect.top) / rect.height;
      depth = Math.max(depth, Math.min(1, Math.max(0, seen)));
    };
    const active = () => {
      lastActive = Date.now();
    };
    const onScroll = () => {
      active();
      measureDepth();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };

    const tick = window.setInterval(() => {
      if (document.visibilityState !== "visible" || Date.now() - lastActive > IDLE_MS) return;
      engaged += 1;
      if (!realRead && engaged >= REAL_READ_S) {
        realRead = true;
        save(true);
        noteRead(slug, keys);
        window.dispatchEvent(new Event(READ_EVENT));
      } else if (engaged % SAVE_EVERY_S === 0) {
        save();
      }
    }, 1000);

    measureDepth();
    const scrolls: EventTarget = scroller ?? window;
    scrolls.addEventListener("scroll", onScroll, { passive: true });
    for (const type of ["pointermove", "pointerdown", "keydown", "touchstart", "wheel"] as const) {
      window.addEventListener(type, active, { passive: true });
    }
    const onLeave = () => save();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onLeave);

    return () => {
      window.clearInterval(tick);
      scrolls.removeEventListener("scroll", onScroll);
      for (const type of ["pointermove", "pointerdown", "keydown", "touchstart", "wheel"] as const) {
        window.removeEventListener(type, active);
      }
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onLeave);
      // Leaving for another page inside the site: the visit ends here.
      save();
    };
  }, [slug, title, excerpt, category, city, words, scroller]);

  return null;
}
