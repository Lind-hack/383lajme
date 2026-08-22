"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, Sparkles } from "lucide-react";

export type Chip = { label: string; question: string };

type Source = { title: string; href: string; meta: string | null };
type Refusal = { headline: string; detail: string; ctaLabel: string; ctaHref: string };

type Turn = {
  id: number;
  question: string;
  state: "thinking" | "answered" | "refused";
  answer?: string;
  sources?: Source[];
  refusal?: Refusal;
};

/** How many earlier exchanges travel with the next question. */
const MEMORY_TURNS = 3;

/**
 * The reader-facing half of Pyet 383.
 *
 * Shared by the search overlay and the article page because both render the
 * same contract: a grounded answer with the articles behind it, or a refusal.
 * There is no third rendering, which is the point — an answer without sources
 * never reaches this component, so there is no state here for "answered but
 * unattributed" and no way to accidentally introduce one.
 *
 * It is a thread, not a single question box. Readers ask "pse ndodhi kjo" and
 * then "po kush e tha këtë" — the second question means nothing on its own, so
 * the last few exchanges travel with it and the previous answers stay on
 * screen to be read against the new one.
 */
export default function AskPanel({
  slug = null,
  chips = [],
  variant = "article",
  autoFocus = false,
  seedQuestion = null,
  seedNonce = 0,
}: {
  slug?: string | null;
  chips?: Chip[];
  variant?: "article" | "overlay";
  autoFocus?: boolean;
  /** A question handed in from outside (a suggestion bubble, a deep link). */
  seedQuestion?: string | null;
  seedNonce?: number;
}) {
  const [typed, setTyped] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const tailRef = useRef<HTMLDivElement>(null);
  const ticket = useRef(0);
  // Read inside `ask` without making it a dependency, so a question in flight
  // never captures a stale thread.
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;

  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (question.length < 6) return;

      const id = ++ticket.current;
      setTyped("");
      setTurns((prev) => [...prev, { id, question, state: "thinking" }]);

      // Only exchanges that produced an answer are worth remembering; a refusal
      // adds nothing the model can build on.
      const history = turnsRef.current
        .filter((t) => t.state === "answered" && t.answer)
        .slice(-MEMORY_TURNS)
        .map((t) => ({ question: t.question, answer: t.answer }));

      const settle = (patch: Partial<Turn>) =>
        setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

      try {
        const res = await fetch("/api/pyet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, slug, history }),
        });
        const data = await res.json();

        if (data?.grounded) {
          settle({
            state: "answered",
            answer: String(data.answer ?? ""),
            sources: Array.isArray(data.sources) ? data.sources : [],
          });
        } else {
          settle({ state: "refused", refusal: data.refusal });
        }
      } catch {
        settle({
          state: "refused",
          refusal: {
            headline: "Nuk munda të përgjigjem tani.",
            detail: "Kontrollo lidhjen dhe provo sërish.",
            ctaLabel: "Shiko LAJMET E FUNDIT",
            ctaHref: "/#lajmet-e-fundit",
          },
        });
      }
    },
    [slug],
  );

  // A question handed in from outside — the suggestion bubble on an article.
  useEffect(() => {
    if (seedNonce > 0 && seedQuestion) void ask(seedQuestion);
    // Keyed on the nonce alone: re-running on the text would re-ask on every
    // render that happens to carry the same suggestion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedNonce]);

  useEffect(() => {
    if (autoFocus) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [autoFocus]);

  // Keep the newest exchange in view as the thread grows.
  useEffect(() => {
    if (turns.length > 0) tailRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns]);

  const busy = turns.some((t) => t.state === "thinking");
  const started = turns.length > 0;

  return (
    <div className="pyet" data-variant={variant}>
      {started && (
        <div className="pyet-thread">
          {turns.map((turn) => (
            <article className="pyet-turn" key={turn.id}>
              <p className="pyet-asked">{turn.question}</p>

              {turn.state === "thinking" && (
                <div className="pyet-thinking">
                  <span className="pyet-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <p>Po lexoj arkivin…</p>
                </div>
              )}

              {turn.state === "answered" && (
                <div className="pyet-answer" aria-live="polite">
                  <p className="pyet-text">{turn.answer}</p>
                  {turn.sources && turn.sources.length > 0 && (
                    <div className="pyet-sources">
                      <h4>BAZUAR NË</h4>
                      <ul>
                        {turn.sources.map((s) => (
                          <li key={s.href}>
                            <Link href={s.href}>
                              <span>{s.title}</span>
                              {s.meta && <em>{s.meta}</em>}
                              <ArrowRight size={13} strokeWidth={2.5} aria-hidden="true" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {turn.state === "refused" && (
                <div className="pyet-refusal" aria-live="polite">
                  <p className="pyet-refusal-head">{turn.refusal?.headline}</p>
                  <p className="pyet-refusal-detail">{turn.refusal?.detail}</p>
                  <Link className="pyet-refusal-cta" href={turn.refusal?.ctaHref ?? "/"}>
                    {turn.refusal?.ctaLabel ?? "Shiko LAJMET E FUNDIT"}
                    <ArrowRight size={14} strokeWidth={2.6} aria-hidden="true" />
                  </Link>
                </div>
              )}
            </article>
          ))}
          <div ref={tailRef} />
        </div>
      )}

      <form
        className="pyet-form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(typed);
        }}
      >
        <Sparkles size={15} strokeWidth={2.2} aria-hidden="true" />
        <input
          ref={inputRef}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={
            started
              ? "Pyet diçka tjetër…"
              : variant === "overlay"
                ? "Bëj një pyetje për lajmet…"
                : "Pyet për këtë lajm…"
          }
          aria-label="Bëj një pyetje"
          maxLength={280}
          autoComplete="off"
          disabled={busy}
        />
        <button
          type="submit"
          className="pyet-send"
          disabled={busy || typed.trim().length < 6}
          aria-label="Dërgo pyetjen"
        >
          <ArrowUp size={15} strokeWidth={2.8} aria-hidden="true" />
        </button>
      </form>

      {chips.length > 0 && !started && (
        <ul className="pyet-chips">
          {chips.map((chip, i) => (
            <li key={chip.question} style={{ "--i": i } as React.CSSProperties}>
              <button type="button" onClick={() => void ask(chip.question)}>
                {chip.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!started && (
        <p className="pyet-hint">
          Përgjigjet vijnë vetëm nga artikujt e botuar te 383 — nëse arkivi nuk e ka, do
          ta them.
        </p>
      )}

      {started && !busy && (
        <button type="button" className="pyet-again" onClick={() => setTurns([])}>
          Fillo bisedë të re
        </button>
      )}
    </div>
  );
}
