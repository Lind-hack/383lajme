"use client";

// The general-purpose toast, deliberately built on the same window-event
// contract CoinToast already uses (383:coins-earned), with the same 2600ms +
// 340ms timing, so the two read as one system rather than two.
//
//   toast("U ruajt në këtë pajisje.");
//   toast("Nuk u lidhëm dot. Po provojmë sërish.", "error");
//
// A toast auto-dismisses, so it is only ever for messages a reader can afford
// to miss — "saved", "copied", "retrying". Anything they must act on belongs
// inline, next to the thing that failed (InlineError), or in a blocking dialog
// that offers a way forward. Never put a payment failure or a permissions error
// in here.

import { useEffect, useState } from "react";

const VISIBLE_MS = 2600;
const EXIT_MS = 340;
const MAX_QUEUE = 2;

export type ToastKind = "ok" | "info" | "error";

type ToastItem = { id: number; text: string; kind: ToastKind; leaving?: boolean };

/** Fire a toast from anywhere on the client, without importing the component. */
export function toast(text: string, kind: ToastKind = "info") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("383:toast", { detail: { text, kind } })
  );
}

const ACCENT: Record<ToastKind, string> = {
  ok: "#00A651",
  info: "#111111",
  error: "#E41E20",
};

export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const timers: number[] = [];

    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<{ text?: unknown; kind?: unknown }>).detail;
      const text = typeof detail?.text === "string" ? detail.text.trim() : "";
      if (!text) return;

      const kind: ToastKind =
        detail?.kind === "ok" || detail?.kind === "error" ? detail.kind : "info";
      const id = performance.now();

      // Cap the queue: a stack of toasts is noise, and the oldest is the least
      // relevant by definition.
      setItems((prev) => [...prev, { id, text, kind }].slice(-MAX_QUEUE));

      timers.push(
        window.setTimeout(
          () =>
            setItems((prev) =>
              prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
            ),
          VISIBLE_MS
        ),
        window.setTimeout(
          () => setItems((prev) => prev.filter((t) => t.id !== id)),
          VISIBLE_MS + EXIT_MS
        )
      );
    };

    window.addEventListener("383:toast", onToast);
    return () => {
      window.removeEventListener("383:toast", onToast);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="ui-toaster" role="status" aria-live="polite">
      {items.map((item) => (
        <div
          key={item.id}
          className="ui-toast"
          data-leaving={item.leaving ? "true" : undefined}
          style={{ borderLeft: `4px solid ${ACCENT[item.kind]}` }}
        >
          <span>{item.text}</span>
          <button
            type="button"
            aria-label="Mbyll"
            onClick={() =>
              setItems((prev) => prev.filter((t) => t.id !== item.id))
            }
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
