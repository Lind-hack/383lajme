"use client";

// Lets "Për ty" and Dardani's suggestions learn from what the reader clicks and
// reads.
//
// Mounted on the article page. Opening an article is a click, and counts a
// little (half a read) straight away; staying ten seconds — long enough that
// an accidental tap or a bounce does not count — counts as a full read. Each
// time the article's category, the listed people it names and its city gain
// weight in the reader's device-stored interests, and the story is remembered as
// opened, so Për ty files it below the ones not yet seen. A full read also goes
// into the reader's ledger (lib/reader-ledger.mjs), the tally their monthly and
// yearly wrapped are made from. Nothing is sent anywhere; the feed ranks with it
// locally and "Harro historikun e leximit" clears it.
//
// Renders nothing.

import { useEffect } from "react";
import { readInterests, writeInterests, recordRead } from "@/lib/interests.mjs";
import { articleKeys } from "@/lib/per-ty-rank.mjs";
import { rememberRead } from "@/lib/perty-visits.mjs";
import { noteRead } from "@/lib/reader-ledger.mjs";
import { READ_EVENT } from "@/components/paper-ready";

const DWELL_MS = 10_000;
/** A click without the read that should follow it weighs half a read. */
const CLICK_WEIGHT = 0.5;

export default function ReadingAffinity({
  slug,
  title,
  excerpt,
  category,
  city,
}: {
  slug: string;
  title: string;
  excerpt?: string;
  category?: string;
  city?: string;
}) {
  useEffect(() => {
    rememberRead(slug);
  }, [slug]);

  // The ledger counts a read once the reader has stayed: a tap that bounces is
  // not a story they read. Every story counts, whatever it is about.
  useEffect(() => {
    const timer = window.setTimeout(() => noteRead(slug, articleKeys({ title, excerpt, category, city })), DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [slug, title, excerpt, category, city]);

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

  // Once both the ledger and the affinity above hold this read, tell anything
  // waiting on it (Dardani's "Ta bëra gazetën", components/paper-ready.tsx).
  useEffect(() => {
    const timer = window.setTimeout(() => window.dispatchEvent(new Event(READ_EVENT)), DWELL_MS + 50);
    return () => window.clearTimeout(timer);
  }, [slug]);

  return null;
}
