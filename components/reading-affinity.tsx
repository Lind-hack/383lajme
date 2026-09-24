"use client";

// Lets "Për ty" learn a little from what the reader actually reads.
//
// Mounted on the article page. After the reader has stayed ten seconds — long
// enough that an accidental tap or a bounce does not count — the article's
// category, the listed people it names and its city each gain a small weight
// in the reader's device-stored interests. Nothing is sent anywhere; the feed
// ranks with it locally and "Harro historikun e leximit" clears it.
//
// Renders nothing.

import { useEffect } from "react";
import { readInterests, writeInterests, recordRead } from "@/lib/interests.mjs";
import { articleKeys } from "@/lib/per-ty-rank.mjs";

const DWELL_MS = 10_000;

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
    const timer = window.setTimeout(() => {
      const keys = articleKeys({ title, excerpt, category, city });
      if (keys.length === 0) return;
      const current = readInterests();
      writeInterests({ ...current, affinity: recordRead(current.affinity, keys) });
    }, DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [title, excerpt, category, city]);

  return null;
}
