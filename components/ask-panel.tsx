"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, Sparkles } from "lucide-react";

export type Chip = { label: string; question: string };

type Source = { title: string; href: string; meta: string | null };
type Refusal = { headline: string; detail: string; ctaLabel: string; ctaHref: string };

type Answer =
  | { state: "idle" }
  | { state: "thinking"; question: string }
  | { state: "answered"; question: string; answer: string; sources: Source[] }
  | { state: "refused"; question: string; refusal: Refusal };

/**
 * The reader-facing half of Pyet 383.
 *
 * Shared by the search overlay and the article page because both render the
 * same contract: a grounded answer with the articles behind it, or a refusal.
 * There is no third rendering, which is the point — an answer without sources
 * never reaches this component, so there is no state here for "answered but
 * unattributed" and no way to accidentally introduce one.
 *
 * The overlay already owns an input, so it drives this one externally via
 * `question` + `askNonce`. The article page has no input of its own and gets
 * the one below.
 */
export default function AskPanel({
  slug = null,
  chips = [],
  variant = "article",
  question: externalQuestion,
  askNonce = 0,
  hideInput = false,
}: {
  slug?: string | null;
  chips?: Chip[];
  variant?: "article" | "overlay";
  question?: string;
  askNonce?: number;
  hideInput?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const [answer, setAnswer] = useState<Answer>({ state: "idle" });
  const answerRef = useRef<HTMLDivElement>(null);
  // Only the most recent question may write to state: a reader who clicks a
  // second chip while the first is in flight should not have the first answer
  // land on top of the second.
  const latest = useRef(0);

  const ask = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (q.length < 6) return;

      const ticket = ++latest.current;
      setAnswer({ state: "thinking", question: q });

      try {
        const res = await fetch("/api/pyet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, slug }),
        });
        const data = await res.json();
        if (ticket !== latest.current) return;

        if (data?.grounded) {
          setAnswer({
            state: "answered",
            question: q,
            answer: String(data.answer ?? ""),
            sources: Array.isArray(data.sources) ? data.sources : [],
          });
        } else {
          setAnswer({ state: "refused", question: q, refusal: data.refusal });
        }
      } catch {
        if (ticket !== latest.current) return;
        setAnswer({
          state: "refused",
          question: q,
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

  // The overlay's own field drives this panel; the nonce is what says "the
  // reader pressed Enter", as distinct from "the reader is still typing".
  useEffect(() => {
    if (askNonce > 0 && externalQuestion) void ask(externalQuestion);
    // Deliberately keyed on the nonce alone: re-running on every keystroke of
    // externalQuestion would fire a request per character.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askNonce]);

  const busy = answer.state === "thinking";

  return (
    <div className="pyet" data-variant={variant}>
      {!hideInput && (
        <form
          className="pyet-form"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(typed);
          }}
        >
          <Sparkles size={15} strokeWidth={2.2} aria-hidden="true" />
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Pyet për këtë lajm…"
            aria-label="Pyet 383 për këtë artikull"
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
      )}

      {chips.length > 0 && answer.state === "idle" && (
        <ul className="pyet-chips">
          {chips.map((chip) => (
            <li key={chip.question}>
              <button type="button" onClick={() => void ask(chip.question)}>
                {chip.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {variant === "overlay" && answer.state === "idle" && (
        <p className="pyet-hint">
          Shkruaj pyetjen dhe shtyp Enter. Përgjigjet vijnë vetëm nga artikujt e botuar te
          383 — nëse arkivi nuk e ka, do ta them.
        </p>
      )}

      <div className="pyet-out" ref={answerRef} aria-live="polite">
        {answer.state === "thinking" && (
          <div className="pyet-thinking">
            <span className="pyet-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <p>Po lexoj arkivin…</p>
          </div>
        )}

        {answer.state === "answered" && (
          <div className="pyet-answer">
            <p className="pyet-asked">{answer.question}</p>
            <p className="pyet-text">{answer.answer}</p>
            {answer.sources.length > 0 && (
              <div className="pyet-sources">
                <h4>BAZUAR NË</h4>
                <ul>
                  {answer.sources.map((s) => (
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

        {answer.state === "refused" && (
          <div className="pyet-refusal">
            <p className="pyet-asked">{answer.question}</p>
            <p className="pyet-refusal-head">{answer.refusal?.headline}</p>
            <p className="pyet-refusal-detail">{answer.refusal?.detail}</p>
            <Link className="pyet-refusal-cta" href={answer.refusal?.ctaHref ?? "/"}>
              {answer.refusal?.ctaLabel ?? "Shiko LAJMET E FUNDIT"}
              <ArrowRight size={14} strokeWidth={2.6} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>

      {answer.state !== "idle" && !busy && (
        <button
          type="button"
          className="pyet-again"
          onClick={() => {
            setAnswer({ state: "idle" });
            setTyped("");
          }}
        >
          Bëj një pyetje tjetër
        </button>
      )}
    </div>
  );
}
