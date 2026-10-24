"use client";

// "Ruaj artikullin": one save, wherever its button is (the desktop sidebar,
// the phone's share row). A save lives on the device (localStorage
// `bookmarks`, article ids) and, for a signed-in reader, in the account's
// saved articles too; a save made as a guest is copied up once they sign in.
// Every save and unsave is also announced to Për ty (lib/story-actions), which
// learns from what is kept.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { announceStoryAction } from "@/lib/story-actions.mjs";

const KEY = "bookmarks";

function readSaved(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeSaved(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Storage refused: the save holds for this visit only.
  }
}

export function useArticleSave(article: { id: string; slug: string }) {
  const [saved, setSaved] = useState(false);
  const [account, setAccount] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const localSaved = readSaved().includes(article.id);
    setSaved(localSaved);

    createClient()
      .auth.getUser()
      .then(async ({ data: { user } }) => {
        if (!active || !user) return;
        setAccount(true);
        try {
          const response = await fetch("/api/profile/saved-articles", { cache: "no-store" });
          if (!response.ok) return;
          const data = await response.json();
          const remoteSaved = (data?.articles ?? []).some((item: { article_id?: string }) => item?.article_id === article.id);
          if (localSaved && !remoteSaved) {
            await fetch("/api/profile/saved-articles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ articleId: article.id, slug: article.slug }),
            });
          }
          if (active) setSaved(localSaved || remoteSaved);
        } catch {
          // The device list stays usable while the account service recovers.
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [article.id, article.slug]);

  async function toggle() {
    if (busy) return;
    const next = !saved;
    const ids = readSaved();
    writeSaved(next ? [...new Set([...ids, article.id])] : ids.filter((id) => id !== article.id));
    setSaved(next);
    // Për ty learns from what is kept (components/reading-affinity.tsx).
    announceStoryAction(article.slug, next ? "save" : "unsave");

    if (!account) return;
    setBusy(true);
    try {
      const response = await fetch("/api/profile/saved-articles", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.id, slug: article.slug }),
      });
      if (!response.ok) throw new Error("save");
    } catch {
      // The account refused: put the device back the way it was.
      setSaved(!next);
      const now = readSaved();
      writeSaved(next ? now.filter((id) => id !== article.id) : [...new Set([...now, article.id])]);
      announceStoryAction(article.slug, next ? "unsave" : "save");
    } finally {
      setBusy(false);
    }
  }

  return { saved, account, busy, toggle };
}
