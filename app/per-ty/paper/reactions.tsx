"use client";

// Readers' reactions in the reel: one fetch of every story's tally when the
// paper opens, the reader's own picks remembered on the device, and saving a
// pick (app/api/per-ty/reactions). When the server says reactions are not
// available, `ok` stays false and the story screens leave them out.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MINE_KEY, normalizeMine, type StoryReactionKey, type Tally } from "@/lib/story-reactions.mjs";

/** The same anonymous device id the daily poll and Reagimi i Ditës use. */
const VOTER_KEY = "383_voter_id";

type Reactions = {
  ok: boolean;
  tallies: Record<string, Tally>;
  mine: Record<string, StoryReactionKey>;
  react: (slug: string, key: StoryReactionKey) => Promise<boolean>;
};

const Ctx = createContext<Reactions>({ ok: false, tallies: {}, mine: {}, react: async () => false });

export const useReactions = () => useContext(Ctx);

function voterId() {
  try {
    let id = localStorage.getItem(VOTER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VOTER_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function ReactionsProvider({ slugs, children }: { slugs: string[]; children: ReactNode }) {
  const [ok, setOk] = useState(false);
  const [tallies, setTallies] = useState<Record<string, Tally>>({});
  const [mine, setMine] = useState<Record<string, StoryReactionKey>>({});
  const key = slugs.join(",");

  useEffect(() => {
    try {
      setMine(normalizeMine(JSON.parse(localStorage.getItem(MINE_KEY) ?? "null")));
    } catch {
      // No storage: picks last for this visit only.
    }
  }, []);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    fetch(`/api/per-ty/reactions?slugs=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!alive || !json) return;
        setOk(json.ok === true);
        if (json.tallies && typeof json.tallies === "object") setTallies(json.tallies);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);

  const react = useCallback(async (slug: string, reaction: StoryReactionKey) => {
    const before = mine[slug];
    // Optimistic: the pick and its count move at once.
    setMine((m) => {
      const next = { ...m, [slug]: reaction };
      try {
        localStorage.setItem(MINE_KEY, JSON.stringify(next));
      } catch {
        // fine
      }
      return next;
    });
    setTallies((t) => {
      const cur = { ...(t[slug] ?? {}) };
      if (before) cur[before] = Math.max(0, (cur[before] ?? 0) - 1);
      cur[reaction] = (cur[reaction] ?? 0) + 1;
      return { ...t, [slug]: cur };
    });
    try {
      const r = await fetch("/api/per-ty/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, reaction, voter: voterId() }),
      });
      if (!r.ok) return false;
      const json = await r.json();
      if (json?.tally && typeof json.tally === "object") setTallies((t) => ({ ...t, [slug]: json.tally }));
      return true;
    } catch {
      return false;
    }
  }, [mine]);

  const value = useMemo(() => ({ ok, tallies, mine, react }), [ok, tallies, mine, react]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
