"use client";

// A story's key points for its card in the reel (app/api/per-ty/story), fetched
// once a story is near the screen and kept for the visit, so the card fills in
// before the reader gets to it.

import { useEffect, useState } from "react";

export type StoryData = { points: string[] };

const cache = new Map<string, StoryData | "off">();
const pending = new Map<string, Promise<StoryData | "off">>();

function fetchStory(slug: string): Promise<StoryData | "off"> {
  const known = cache.get(slug);
  if (known) return Promise.resolve(known);
  const going = pending.get(slug);
  if (going) return going;
  const p = fetch(`/api/per-ty/story?slug=${encodeURIComponent(slug)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j): StoryData | "off" =>
      j?.ok
        ? { points: Array.isArray(j?.points) ? j.points.filter((s: unknown) => typeof s === "string") : [] }
        : "off"
    )
    .catch((): "off" => "off")
    .then((data) => {
      // A failed fetch is not remembered: the next approach tries again.
      if (data !== "off") cache.set(slug, data);
      pending.delete(slug);
      return data;
    });
  pending.set(slug, p);
  return p;
}

/** The story's data once `want` has been true; null while it comes, "off" if it cannot. */
export function useStoryData(slug: string, want: boolean): StoryData | "off" | null {
  const [data, setData] = useState<StoryData | "off" | null>(() => cache.get(slug) ?? null);
  useEffect(() => {
    if (!want || data) return;
    let alive = true;
    fetchStory(slug).then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [slug, want, data]);
  return data;
}
