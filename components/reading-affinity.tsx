"use client";

// Lets "Për ty" and Dardani's suggestions learn from what the reader clicks and
// reads — and for how long.
//
// Mounted on the article page. Opening an article is a click, and counts a
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
// opened, so Për ty files it below the ones not yet seen. Nothing of this is
// sent anywhere; "Harro historikun e leximit" clears it.
//
// Saving the story or commenting on it counts on top of the reading
// (lib/story-actions.mjs): the save button and the comment box announce it,
// and this, which knows the story's keys, credits them. The one exception is
// a visit that came from a Për ty row: GA (with consent) hears how long it was
// read and how far, against the slug and the row's place (lib/perty-measure).
//
// Renders nothing.

import { useEffect } from "react";
import { readInterests, writeInterests, recordRead, nudgeAffinity } from "@/lib/interests.mjs";
import { articleKeys } from "@/lib/per-ty-rank.mjs";
import { rememberRead } from "@/lib/perty-visits.mjs";
import { noteRead } from "@/lib/reader-ledger.mjs";
import { takeClick, trackPerty } from "@/lib/perty-measure";
import { OPEN_WEIGHT, REAL_READ_S, visitWeight, weightToAdd } from "@/lib/reading-engagement.mjs";
import { READ_EVENT } from "@/components/paper-ready";
import { STORY_ACTION_EVENT, actionWeight } from "@/lib/story-actions.mjs";

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
}: {
  slug: string;
  title: string;
  excerpt?: string;
  category?: string;
  city?: string;
  /** Words in the story's body, so a minute counts as finishing a short story and a skim of a long one. */
  words?: number;
}) {
  useEffect(() => {
    rememberRead(slug);
  }, [slug]);

  // A save, an unsave or a comment on this story.
  useEffect(() => {
    const keys = articleKeys({ title, excerpt, category, city });
    if (keys.length === 0) return;
    const onAction = (event: Event) => {
      const weight = actionWeight((event as CustomEvent).detail, slug);
      if (!weight) return;
      try {
        const current = readInterests();
        let affinity = current.affinity;
        if (weight > 0) affinity = recordRead(affinity, keys, Date.now(), weight);
        else for (const key of keys) affinity = nudgeAffinity(affinity, key, weight);
        writeInterests({ ...current, affinity });
      } catch {
        // Storage refused: the paper learns less from this one.
      }
    };
    window.addEventListener(STORY_ACTION_EVENT, onAction);
    return () => window.removeEventListener(STORY_ACTION_EVENT, onAction);
  }, [slug, title, excerpt, category, city]);

  useEffect(() => {
    const keys = articleKeys({ title, excerpt, category, city });
    let engaged = 0;
    let depth = 0;
    let lastActive = Date.now();
    let credited = 0;
    let creditedSeconds = 0;
    let realRead = false;
    // Came from a Për ty row? Then GA hears how this visit went, once.
    const from = takeClick(slug);
    const mountedAt = Date.now();
    let reported = false;
    const report = () => {
      if (!from || reported) return;
      // React's dev double-mount tears the first mount down at once; that is
      // not a visit.
      if (engaged === 0 && Date.now() - mountedAt < 2000) return;
      reported = true;
      trackPerty("perty_read", {
        slug,
        position: from.position,
        kind: from.kind,
        list: from.list,
        seconds: engaged,
        depth: Math.round(depth * 100),
        real_read: realRead,
      });
    };

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
      if (document.visibilityState === "hidden") {
        save();
        report();
      }
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
    window.addEventListener("scroll", onScroll, { passive: true });
    for (const type of ["pointermove", "pointerdown", "keydown", "touchstart", "wheel"] as const) {
      window.addEventListener(type, active, { passive: true });
    }
    const onLeave = () => {
      save();
      report();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onLeave);

    return () => {
      window.clearInterval(tick);
      window.removeEventListener("scroll", onScroll);
      for (const type of ["pointermove", "pointerdown", "keydown", "touchstart", "wheel"] as const) {
        window.removeEventListener(type, active);
      }
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onLeave);
      // Leaving for another page inside the site: the visit ends here.
      save();
      report();
    };
  }, [slug, title, excerpt, category, city, words]);

  return null;
}
