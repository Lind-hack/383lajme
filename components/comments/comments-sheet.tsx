"use client";

// The comments under a story, the way TikTok and Instagram show them: a sheet
// rising from the bottom over the story, the count on top, every comment with
// its round picture, name, time and "Përgjigju", replies tucked under their
// comment, and the box to write in pinned to the bottom. On a computer it is a
// panel in the middle of the screen.
//
// Signed-in readers write; everyone reads. Built on <dialog> (focus trap, Esc,
// the page behind it inert) and put on <body>, so a reel underneath never takes
// its scroll or taps. Dragged down by the handle to close.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useDragControls, useReducedMotion } from "framer-motion";
import { ArrowUp, X } from "lucide-react";
import TimeAgo from "@/components/time-ago";
import { MAX_BODY, avatarColor, bodyProblem, countLabel, initials, type CommentRow, type Thread } from "@/lib/article-comments.mjs";
import type { ThreadState } from "./use-comment-thread";
import "./comments.css";

function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span className={`cm-avatar${small ? " cm-avatar--small" : ""}`} style={{ background: avatarColor(name) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function Comment({
  c,
  small = false,
  thread,
  onReply,
  say,
}: {
  c: CommentRow;
  small?: boolean;
  thread: ThreadState;
  onReply: (c: CommentRow) => void;
  say: (text: string) => void;
}) {
  // "Raporto" and "Fshije" ask once, in place: no browser dialogs.
  const [asking, setAsking] = useState<null | "report" | "delete">(null);
  const [busy, setBusy] = useState(false);
  const act = async () => {
    if (!asking) return;
    setBusy(true);
    const ok = asking === "delete" ? await thread.remove(c.id) : await thread.report(c.id);
    setBusy(false);
    setAsking(null);
    if (asking === "report") say(ok ? "Faleminderit — redaksia do ta shikojë." : thread.viewer.signedIn ? "S'u raportua — provo sërish." : "Hyr në llogari për të raportuar.");
    else if (!ok) say("Nuk u fshi — provo sërish.");
  };
  return (
    <div className={`cm-item${small ? " cm-item--reply" : ""}`}>
      <Avatar name={c.name} small={small} />
      <div className="cm-item-main">
        <p className="cm-name">
          {c.name}
          {c.mine && <span className="cm-you">Ti</span>}
        </p>
        <p className="cm-body">{c.body}</p>
        <div className="cm-meta">
          <TimeAgo iso={c.createdAt} />
          {asking ? (
            <>
              <span className="cm-ask">{asking === "delete" ? "Ta fshij?" : "Ta raportoj?"}</span>
              <button type="button" className="cm-link cm-link--strong" onClick={act} disabled={busy}>
                Po
              </button>
              <button type="button" className="cm-link" onClick={() => setAsking(null)}>
                Jo
              </button>
            </>
          ) : (
            <>
              <button type="button" className="cm-link" onClick={() => onReply(c)}>
                Përgjigju
              </button>
              {c.mine ? (
                <button type="button" className="cm-link" onClick={() => setAsking("delete")}>
                  Fshije
                </button>
              ) : (
                thread.viewer.signedIn && (
                  <button type="button" className="cm-link" onClick={() => setAsking("report")}>
                    Raporto
                  </button>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadItem({ t, thread, onReply, say }: { t: Thread; thread: ThreadState; onReply: (c: CommentRow) => void; say: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const shown = open ? t.replies : t.replies.filter((r) => r.mine);
  const rest = t.replies.length - shown.length;
  return (
    <li className="cm-thread">
      <Comment c={t} thread={thread} onReply={onReply} say={say} />
      {shown.length > 0 && (
        <ul className="cm-replies">
          {shown.map((r) => (
            <li key={r.id}>
              <Comment c={r} small thread={thread} onReply={() => onReply(t)} say={say} />
            </li>
          ))}
        </ul>
      )}
      {rest > 0 && (
        <button type="button" className="cm-more" onClick={() => setOpen(true)}>
          <i aria-hidden="true" />
          Shiko {rest === 1 ? "1 përgjigje" : `${rest} përgjigje`}
        </button>
      )}
    </li>
  );
}

export default function CommentsSheet({
  open,
  onClose,
  thread,
  title,
  focusOnOpen = false,
}: {
  open: boolean;
  onClose: () => void;
  thread: ThreadState;
  /** The story's headline, small under the count. */
  title?: string;
  /** Opened from "Shto një koment…": straight into the box. */
  focusOnOpen?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const drag = useDragControls();
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { load } = thread;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      load();
      if (focusOnOpen) window.setTimeout(() => box.current?.focus(), 260);
    }
    if (!open && el.open) el.close();
  }, [open, mounted, load, focusOnOpen]);

  // The box grows with what is written, up to four lines.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [text]);

  const say = (value: string) => {
    setToast(value);
    window.setTimeout(() => setToast((t) => (t === value ? null : t)), 2400);
  };

  const reply = (c: CommentRow) => {
    setReplyTo(c);
    setError(null);
    box.current?.focus();
  };

  const send = async () => {
    const problem = bodyProblem(text);
    if (problem) {
      setError(problem);
      return;
    }
    setSending(true);
    setError(null);
    const failed = await thread.post(text, replyTo?.id ?? null);
    setSending(false);
    if (failed) {
      setError(failed);
      return;
    }
    setText("");
    setReplyTo(null);
    dialog.current?.querySelector(".cm-list")?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  const length = [...text].length;
  const here = typeof window !== "undefined" ? `${window.location.pathname}${window.location.hash}` : "/";

  if (!mounted) return null;
  return createPortal(
    <dialog
      ref={dialog}
      className="cm-sheet"
      aria-labelledby="cm-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        className="cm-panel"
        drag={reduce ? false : "y"}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 600) onClose();
        }}
      >
        <header className="cm-head" onPointerDown={(e) => drag.start(e)}>
          <i className="cm-handle" aria-hidden="true" />
          <h2 id="cm-title" tabIndex={-1}>
            {thread.status === "ready" ? countLabel(thread.count) : "Komentet"}
          </h2>
          {title && <p className="cm-story">{title}</p>}
          <button type="button" className="cm-close" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} aria-label="Mbyll komentet">
            <X size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </header>

        <div className="cm-list" aria-busy={thread.status === "loading"}>
          {thread.status === "loading" || thread.status === "idle" ? (
            <ul className="cm-skeleton" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li key={i}>
                  <span />
                  <div>
                    <i />
                    <i />
                  </div>
                </li>
              ))}
            </ul>
          ) : thread.status === "off" ? (
            <p className="cm-empty">Komentet nuk u ngarkuan. Provo pak më vonë.</p>
          ) : thread.list.length === 0 ? (
            <div className="cm-empty">
              <span className="cm-empty-icon" aria-hidden="true">
                💬
              </span>
              <b>Ende pa komente</b>
              <span>Bëhu i pari që thua diçka për këtë lajm.</span>
            </div>
          ) : (
            <ul className="cm-threads">
              {thread.list.map((t) => (
                <ThreadItem key={t.id} t={t} thread={thread} onReply={reply} say={say} />
              ))}
            </ul>
          )}
        </div>

        <footer className="cm-foot">
          {thread.status === "ready" && !thread.viewer.signedIn ? (
            <a className="cm-signin" href={`/hyr?next=${encodeURIComponent(here)}`}>
              Hyr për të komentuar
            </a>
          ) : (
            <>
              {replyTo && (
                <p className="cm-replying">
                  Po i përgjigjesh <b>{replyTo.name}</b>
                  <button type="button" onClick={() => setReplyTo(null)} aria-label="Anulo përgjigjen">
                    <X size={14} strokeWidth={2.6} aria-hidden="true" />
                  </button>
                </p>
              )}
              {error && (
                <p className="cm-error" role="alert">
                  {error}
                </p>
              )}
              <form
                className="cm-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <Avatar name={thread.viewer.name ?? "Ti"} small />
                <label className="cm-field">
                  <span className="cm-sr">Komenti yt</span>
                  <textarea
                    ref={box}
                    rows={1}
                    value={text}
                    maxLength={MAX_BODY + 50}
                    placeholder={replyTo ? `Përgjigju ${replyTo.name}…` : "Shto një koment…"}
                    disabled={thread.status !== "ready"}
                    onChange={(e) => {
                      setText(e.target.value);
                      if (error) setError(null);
                    }}
                    onKeyDown={(e) => {
                      // Enter sends on a computer; Shift+Enter is a new line.
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(hover: hover)").matches) {
                        e.preventDefault();
                        send();
                      }
                    }}
                  />
                  {length > MAX_BODY - 80 && (
                    <small className="cm-count" data-over={length > MAX_BODY || undefined}>
                      {MAX_BODY - length}
                    </small>
                  )}
                </label>
                <button type="submit" className="cm-send" disabled={sending || !text.trim() || thread.status !== "ready"} aria-label="Dërgo komentin">
                  <ArrowUp size={19} strokeWidth={2.8} aria-hidden="true" />
                </button>
              </form>
            </>
          )}
        </footer>
        <p className="cm-toast" role="status" data-on={toast ? "" : undefined}>
          {toast}
        </p>
      </motion.div>
    </dialog>,
    document.body
  );
}
