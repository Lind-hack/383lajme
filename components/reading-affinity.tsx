"use client";

// Lets "Për ty" and Dardani's suggestions learn from what the reader clicks and
// reads.
//
// Mounted on the article page. Opening an article is a click, and counts a
// little (half a read) straight away; staying ten seconds — long enough that
// an accidental tap or a bounce does not count — counts as a full read. Each
// time the article's category, the listed people it names and its city gain
// weight in the reader's device-stored interests. Nothing is sent anywhere; the feed
// ranks with it locally and "Harro historikun e leximit" clears it.
//
// Renders nothing.

import { useEffect } from "react";
import { readInterests, writeInterests, recordRead } from "@/lib/interests.mjs";
import { articleKeys } from "@/lib/per-ty-rank.mjs";

const DWELL_MS = 10_000;
/** A click without the read that should follow it weighs half a read. */
const CLICK_WEIGHT = 0.5;

export default function ReadingAffinity({
  title,
  excerpt,
  category,
  city,
}: {
  title: string;
  excerpt?: string;
  category?: string;
  city?: string;
}) {
  useEffect(() => {
    const keys = articleKeys({ title, excerpt, category, city });
    if (keys.length === 0) return;
    const record = (weight: number) => {
      const current = readInterests();
      writeInterests({ ...current, affinity: recordRead(current.affinity, keys, Date.now(), weight) });
    };
    record(CLICK_WEIGHT);
    const timer = window.setTimeout(() => record(1), DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [title, excerpt, category, city]);

  return null;
}
