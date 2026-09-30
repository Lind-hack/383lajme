// The one Pyet Dardanin conversation a reader has, shared by every surface.
//
// The navbar overlay and the card under an article used to each hold their own
// thread in component state, so closing the overlay or moving to another page
// threw the conversation away. It now lives in sessionStorage: it carries on
// across pages and across opening and closing the overlay, and ends when the
// reader starts a new one ("Fillo bisedë të re") or closes the tab.
//
// Two surfaces can be mounted at once (the overlay over an article), so every
// write is announced with an event and each panel re-reads the thread.
//
// Anything read back is untrusted: it may predate this shape, or be edited by
// hand. A turn that was still waiting when the page unloaded has no request
// behind it any more, so it is dropped rather than left spinning.

export type PyetSource = { title: string; href: string; meta: string | null };
export type PyetRefusal = { headline: string; detail: string; ctaLabel: string; ctaHref: string };

export type PyetTurn = {
  id: number;
  question: string;
  state: "thinking" | "answered" | "refused";
  answer?: string;
  sources?: PyetSource[];
  refusal?: PyetRefusal;
  reason?: string;
  revealed?: boolean;
};

const KEY = "383:pyet-thread";
export const THREAD_EVENT = "383-pyet-thread";
/** The screen keeps the whole conversation; storage keeps the last 40 turns. */
const MAX_STORED = 40;

function clean(raw: unknown): PyetTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: PyetTurn[] = [];
  for (const t of raw) {
    const turn = t as Partial<PyetTurn> | null;
    if (!turn || typeof turn.question !== "string" || typeof turn.id !== "number") continue;
    if (turn.state === "answered" && typeof turn.answer === "string") {
      out.push({
        id: turn.id,
        question: turn.question,
        state: "answered",
        answer: turn.answer,
        sources: Array.isArray(turn.sources) ? turn.sources.filter((s) => typeof s?.href === "string") : [],
        revealed: true,
      });
    } else if (turn.state === "refused") {
      out.push({
        id: turn.id,
        question: turn.question,
        state: "refused",
        refusal: turn.refusal,
        reason: typeof turn.reason === "string" ? turn.reason : undefined,
      });
    }
  }
  return out;
}

export function readThread(): PyetTurn[] {
  try {
    return clean(JSON.parse(sessionStorage.getItem(KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function writeThread(turns: PyetTurn[]) {
  try {
    const settled = turns.filter((t) => t.state !== "thinking").slice(-MAX_STORED);
    sessionStorage.setItem(KEY, JSON.stringify(settled));
  } catch {
    // Storage refused: the thread still lives for as long as this page does.
  }
  window.dispatchEvent(new CustomEvent(THREAD_EVENT));
}

export const PYET_OPEN_EVENT = "383-pyet-open";

/**
 * Open the Pyet Dardanin overlay from anywhere (the navbar owns it), optionally
 * asking a question straight away — "Pyet Dardanin për këtë" on a feed story.
 */
export function openPyet(question?: string) {
  window.dispatchEvent(new CustomEvent(PYET_OPEN_EVENT, { detail: { question: question ?? "" } }));
}

export function clearThread() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing stored to clear.
  }
  window.dispatchEvent(new CustomEvent(THREAD_EVENT));
}
