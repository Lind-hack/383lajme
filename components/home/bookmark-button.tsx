"use client";

// Save-for-later on a homepage card.
//
// Deliberately the SAME contract components/article-sidebar.tsx already uses —
// a `bookmarks` key holding an array of article ids — because the site must have
// one reading list, not one per surface. Storing slugs here instead would have
// been easier and would have silently broken the merge in profile-hub.tsx,
// which reconciles on id.
//
// Guests are first-class: saving works with no account and says so. Signing in
// later merges the device list into the profile rather than replacing it.

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";

const KEY = "bookmarks";

function readSaved(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeSaved(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(ids)]));
    return true;
  } catch {
    return false;
  }
}

export default function BookmarkButton({
  articleId,
  slug,
  title,
  size = 40,
}: {
  articleId: string;
  slug: string;
  title: string;
  size?: number;
}) {
  const [saved, setSaved] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setSaved(readSaved().includes(articleId));

    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (active && user) setHasAccount(true);
      })
      // Auth is unreachable often enough to plan for — the project can be
      // rate-limited or restricted. The device list still works without it.
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [articleId]);

  async function toggle() {
    if (busy) return;
    const next = !saved;

    const current = readSaved();
    const stored = writeSaved(
      next ? [...current, articleId] : current.filter((id) => id !== articleId)
    );

    if (!stored) {
      toast("Shfletuesi nuk lejon ruajtjen në këtë pajisje.", "error");
      return;
    }

    setSaved(next);

    // Feedback is the point: a save with no acknowledgement leaves the reader
    // unsure it happened, and unsure is the state this whole redesign exists to
    // remove. The message also names WHERE it was saved, because that differs.
    if (next) {
      toast(hasAccount ? "U ruajt në profilin tënd." : "U ruajt në këtë pajisje.", "ok");
    }

    if (!hasAccount) return;

    setBusy(true);
    try {
      const response = await fetch("/api/profile/saved-articles", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, slug }),
      });
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      // Roll back both the flag and the stored list, so what the reader sees and
      // what is stored never disagree.
      setSaved(!next);
      const rollback = readSaved();
      writeSaved(
        next ? rollback.filter((id) => id !== articleId) : [...rollback, articleId]
      );
      toast("Nuk u ruajt në profil. Provo përsëri.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? `Hiq nga të ruajturat: ${title}` : `Ruaj për më vonë: ${title}`}
      title={saved ? "E ruajtur" : "Ruaj për më vonë"}
      className="home-bookmark"
      data-saved={saved ? "true" : undefined}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <Bookmark
        size={Math.round(size * 0.45)}
        strokeWidth={2.2}
        fill={saved ? "#FF4422" : "none"}
        color={saved ? "#FF4422" : "#5A5A5A"}
        aria-hidden="true"
      />
    </button>
  );
}
