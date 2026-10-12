"use client";

// One story's comments: loaded once when first wanted, then kept in step with
// what the reader posts, deletes and reports (app/api/comments).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { threads, type CommentRow } from "@/lib/article-comments.mjs";

export type Viewer = { signedIn: boolean; name: string | null };
export type ThreadState = ReturnType<typeof useCommentThread>;

export function useCommentThread(slug: string, onCount?: (n: number) => void) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "off">("idle");
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [viewer, setViewer] = useState<Viewer>({ signedIn: false, name: null });
  const started = useRef(false);
  const countRef = useRef(onCount);
  countRef.current = onCount;

  const load = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    setStatus("loading");
    try {
      const r = await fetch(`/api/comments?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      const json = r.ok ? await r.json() : null;
      if (!json?.ok) {
        setStatus("off");
        started.current = false;
        return;
      }
      setViewer({ signedIn: json.viewer?.signedIn === true, name: typeof json.viewer?.name === "string" ? json.viewer.name : null });
      setRows(Array.isArray(json.comments) ? (json.comments as CommentRow[]) : []);
      setStatus("ready");
    } catch {
      setStatus("off");
      started.current = false;
    }
  }, [slug]);

  /** Posts a comment or a reply; the error to show, or null once it is saved. */
  const post = useCallback(
    async (body: string, parentId: number | null): Promise<string | null> => {
      try {
        const r = await fetch("/api/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, body, parentId }),
        });
        const json = await r.json().catch(() => null);
        if (r.status === 401) setViewer({ signedIn: false, name: null });
        if (!r.ok || !json?.comment) return typeof json?.error === "string" ? json.error : "Nuk u ruajt — provo sërish.";
        setRows((prev) => [json.comment as CommentRow, ...prev]);
        return null;
      } catch {
        return "S'ka lidhje — provo sërish.";
      }
    },
    [slug]
  );

  // A comment taken away takes its replies with it.
  const drop = (id: number) => setRows((prev) => prev.filter((c) => c.id !== id && c.parentId !== id));

  // Whoever shows the count hears it once the thread is known, and after every change.
  useEffect(() => {
    if (status === "ready") countRef.current?.(rows.length);
  }, [status, rows.length]);

  const remove = useCallback(async (id: number) => {
    try {
      const r = await fetch("/api/comments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!r.ok) return false;
      drop(id);
      return true;
    } catch {
      return false;
    }
  }, []);

  /** Reported comments leave this reader's view at once, whatever the count. */
  const report = useCallback(async (id: number) => {
    try {
      const r = await fetch("/api/comments/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (r.status === 401) {
        setViewer({ signedIn: false, name: null });
        return false;
      }
      if (!r.ok) return false;
      drop(id);
      return true;
    } catch {
      return false;
    }
  }, []);

  const list = useMemo(() => threads(rows), [rows]);
  return { status, list, count: rows.length, viewer, load, post, remove, report };
}
