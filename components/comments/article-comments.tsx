"use client";

// "Komentet" at the end of a story: the count, the newest two comments, and a
// box that looks like the one in the sheet — a tap on any of it opens the full
// comments (components/comments/comments-sheet.tsx), TikTok-style.

import { useEffect, useRef, useState } from "react";
import { ChevronRight, MessageCircle } from "lucide-react";
import TimeAgo from "@/components/time-ago";
import { avatarColor, countLabel, initials } from "@/lib/article-comments.mjs";
import CommentsSheet from "./comments-sheet";
import { useCommentThread } from "./use-comment-thread";

export default function ArticleComments({ slug, title, accent = "#ff4422" }: { slug: string; title: string; accent?: string }) {
  const thread = useCommentThread(slug);
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const { load } = thread;
  const ref = useRef<HTMLElement>(null);

  // Loaded when the reader gets near the end of the story, not on every open.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      load();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        load();
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [load]);

  // Without the comments table there is nothing to show; the story ends as before.
  if (thread.status === "off") return null;

  const preview = thread.list.slice(0, 2);
  const show = (withBox: boolean) => {
    setFocus(withBox);
    setOpen(true);
  };

  return (
    <section ref={ref} className="cm-inline" aria-labelledby="cm-inline-title" style={{ "--cm-accent": accent } as React.CSSProperties}>
      <h2 id="cm-inline-title" className="cm-inline-h">
        <button type="button" className="cm-inline-head" onClick={() => show(false)}>
          <MessageCircle size={20} strokeWidth={2.4} aria-hidden="true" />
          <span className="cm-inline-title">Komentet</span>
          <span className="cm-inline-count">{thread.status === "ready" ? countLabel(thread.count) : "…"}</span>
          <ChevronRight size={18} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </h2>

      {preview.length > 0 && (
        <ul className="cm-inline-list">
          {preview.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => show(false)}>
                <span className="cm-avatar cm-avatar--small" style={{ background: avatarColor(c.name) }} aria-hidden="true">
                  {initials(c.name)}
                </span>
                <span className="cm-inline-text">
                  <span className="cm-inline-who">
                    <b>{c.name}</b> · <TimeAgo iso={c.createdAt} className="cm-inline-time" />
                  </span>
                  <span className="cm-inline-body">{c.body}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="cm-inline-box" onClick={() => show(true)}>
        {thread.count === 0 && thread.status === "ready" ? "Bëhu i pari që komenton…" : "Shto një koment…"}
      </button>
      {thread.count > preview.length && (
        <button type="button" className="cm-inline-all" onClick={() => show(false)}>
          Shiko të gjitha {countLabel(thread.count)}
        </button>
      )}

      <CommentsSheet open={open} onClose={() => setOpen(false)} thread={thread} title={title} focusOnOpen={focus} />
    </section>
  );
}
