"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, Sparkles } from "lucide-react";
import DardaniFace, { usePreloadDardaniFaces, type DardaniFaceState } from "@/components/dardani/dardani-face";
import DardaniImage from "@/components/dardani/dardani-image";
import DardaniLoop from "@/components/dardani/dardani-loop";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { rememberQuestion, rememberName, readName, readFollowedTopics } from "@/lib/dardani-memory-store";
import { useLanguage } from "@/components/language/language-provider";
import type { SiteLanguage } from "@/lib/site-language.mjs";

/** A suggested question. `reason` marks one chosen for this reader ("Sepse ndjek Sport"). */
export type Chip = { label: string; question: string; reason?: string };

/**
 * One exchange. `reason` is why it was refused, as the API reports it
 * ("no-sources", "provider-down", …); `revealed` means the answer has been
 * written out on screen once and shows whole from then on.
 */
type Turn = {
  language?: SiteLanguage;
  id: number;
  question: string;
  state: "thinking" | "answered" | "refused";
  /** "chat" is small talk: an answer with no sources, because it makes no claims. */
  kind?: "news" | "chat";
  answer?: string;
  /** Questions Dardani suggests asking next, about the same articles. */
  followups?: string[];
  sources?: { title: string; href: string; meta: string | null }[];
  refusal?: { headline: string; detail: string; ctaLabel: string; ctaHref: string };
  reason?: string;
  revealed?: boolean;
};

/** What the Dardani around the panel (card header, bubble, overlay header) should show. */
export type AskStatus = {
  face: DardaniFaceState;
  status: string;
  busy: boolean;
  /** A conversation is under way in the panel. */
  started?: boolean;
};

/** How many earlier exchanges travel with the next question (the API caps it at 6 too). */
const MEMORY_TURNS = 6;

/** Refusals that are a failed request rather than an archive without the story. */
const FAILURES = new Set(["provider-down", "rate", "network"]);

const IDLE_STATUS = "Zgjidh një pyetje, Dardani e kërkon në arkiv";

function faceOf(turn: Turn | undefined): DardaniFaceState {
  if (!turn) return "neutral";
  if (turn.state === "thinking") return "thinking";
  if (turn.state === "answered") return turn.revealed ? "happy" : "talking";
  return FAILURES.has(turn.reason ?? "") ? "sad" : "confused";
}

function statusOf(turn: Turn | undefined): string {
  if (!turn) return IDLE_STATUS;
  if (turn.state === "thinking") return "Po kërkon në arkivin e 383…";
  if (turn.state === "answered") {
    if (!turn.revealed) return "Po shkruan përgjigjen…";
    return turn.kind === "chat" ? "Muhabet me Dardanin" : "Dardani u përgjigj";
  }
  return FAILURES.has(turn.reason ?? "") ? "Nuk munda të përgjigjem tani" : "Arkivi nuk e ka këtë ende";
}

/**
 * The reader-facing half of Pyet Dardanin.
 *
 * Shared by the search overlay and the article page because both render the
 * same contract: a grounded answer with the articles behind it, or a refusal.
 * The one answer without sources is small talk (`kind: "chat"`): the server
 * sends it only for messages with no subject in them, so it carries no claims
 * that would need a source.
 *
 * It is a thread, not a single question box. Readers ask "pse ndodhi kjo" and
 * then "po kush e tha këtë" — the second question means nothing on its own, so
 * the last few exchanges travel with it and the previous answers stay on
 * screen to be read against the new one. The conversation itself is not kept:
 * closing the overlay or leaving the page ends it.
 *
 * What is kept is what the reader asks about. Each question — how often it is
 * asked, and the people and cities in it — is remembered on the device
 * (lib/dardani-memory-store.ts), which is what makes the next suggestions and
 * the "Për ty" feed personal.
 *
 * Dardani's face follows each exchange (lib: components/dardani/dardani-face).
 * The API answers in one piece, so "talking" is the answer being written out on
 * screen over about a second — presentation only, the request is unchanged.
 */
export default function AskPanel({
  slug = null,
  chips = [],
  variant = "article",
  autoFocus = false,
  seedQuestion = null,
  seedNonce = 0,
  onStatus,
}: {
  slug?: string | null;
  chips?: Chip[];
  variant?: "article" | "overlay";
  autoFocus?: boolean;
  /** A question handed in from outside (a suggestion bubble, a deep link). */
  seedQuestion?: string | null;
  seedNonce?: number;
  /** Told whenever the face or status line around the panel should change. */
  onStatus?: (status: AskStatus) => void;
}) {
  const [typed, setTyped] = useState("");
  const { language } = useLanguage();
  const [turns, setTurns] = useState<Turn[]>([]);
  // Read after mount: the name lives in this device's storage, which the
  // server render cannot see.
  const [readerName, setReaderName] = useState<string | null>(null);
  useEffect(() => setReaderName(readName()), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const tailRef = useRef<HTMLDivElement>(null);
  const ticket = useRef(0);
  // Read inside `ask` without making it a dependency, so a question in flight
  // never captures a stale thread.
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;

  usePreloadDardaniFaces();

  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (question.length < 2) return;

      const id = ++ticket.current;
      setTyped("");
      setTurns((prev) => [...prev, { id, question, language, state: "thinking" }]);
      rememberQuestion(question);

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
          body: JSON.stringify({
            question,
            slug,
            history,
            language,
            name: readName(),
            interests: readFollowedTopics(),
          }),
        });
        const data = await res.json();

        // "Quhem Lind": the server recognised a name in the message.
        if (typeof data?.name === "string" && data.name) {
          rememberName(data.name);
          setReaderName(data.name);
        }

        if (data?.grounded) {
          settle({
            state: "answered",
            kind: data.kind === "chat" ? "chat" : "news",
            answer: String(data.answer ?? ""),
            sources: Array.isArray(data.sources) ? data.sources : [],
            followups: Array.isArray(data.followups)
              ? data.followups.filter((q: unknown): q is string => typeof q === "string").slice(0, 2)
              : [],
          });
        } else {
          settle({ state: "refused", refusal: data.refusal, reason: data?.reason });
        }
      } catch {
        settle({
          state: "refused",
          reason: "network",
          refusal: {
            headline: "Nuk munda të përgjigjem tani.",
            detail: "Kontrollo lidhjen dhe provo sërish.",
            ctaLabel: "Shiko LAJMET E FUNDIT",
            ctaHref: "/#lajmet-e-fundit",
          },
        });
      }
    },
    [slug, language],
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

  const last = turns[turns.length - 1];
  const busy = turns.some((t) => t.state === "thinking");
  const writing = turns.some((t) => t.state === "answered" && !t.revealed);
  const started = turns.length > 0;
  const overlay = variant === "overlay";
  const face = faceOf(last);
  const status = statusOf(last);

  useEffect(() => {
    onStatus?.({ face, status, busy: busy || writing, started });
  }, [onStatus, face, status, busy, writing, started]);

  const markRevealed = useCallback((id: number) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, revealed: true } : t)));
  }, []);

  // "Pyet edhe": what Dardani suggests after his last answer, then the page's
  // own suggestions, never one already asked. This is what keeps a
  // conversation going instead of ending at every answer.
  const asked = new Set(turns.map((t) => t.question));
  const suggested: Chip[] = (last?.state === "answered" ? (last.followups ?? []) : []).map((q) => ({
    label: q,
    question: q,
  }));
  const followUps = [...suggested, ...chips]
    .filter((c, i, all) => !asked.has(c.question) && all.findIndex((x) => x.question === c.question) === i)
    .slice(0, overlay ? 2 : 3);

  return (
    <div className="pyet" data-variant={variant}>
      {overlay && !started && (
        <div className="pyet-hello">
          <DardaniImage name="wave" alt="Dardani përshëndet" className="pyet-hello-img dardani-peek" />
          <div className="pyet-hello-say">
            <strong>{readerName ? `Tung, ${readerName}! Ç'kemi?` : "Tungjatjeta! Unë jam Dardani."}</strong>
            <p>Bisedo me mua ose më pyet për çdo lajm. Për lajmet të them vetëm atë që ka shkruar 383.</p>
          </div>
        </div>
      )}

      {!overlay && !started && chips.length > 0 && (
        <ul className="pyet-questions">
          {chips.map((chip, i) => (
            <li key={chip.question} style={{ "--i": i } as React.CSSProperties}>
              <button type="button" className="pyet-q" onClick={() => void ask(chip.question)}>
                <span>
                  {chip.reason && <small className="pyet-q-reason">{chip.reason}</small>}
                  {chip.label}
                </span>
                <span className="pyet-q-arrow" aria-hidden="true">→</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {started && (
        <div className="pyet-thread">
          {turns.map((turn) =>
            overlay ? (
              <article className="pyet-turn pyet-turn--chat" key={turn.id}>
                <p className="pyet-asked" data-no-translate>{turn.question}</p>
                <div className="pyet-reply">
                  <DardaniFace state={faceOf(turn)} size={44} className="pyet-reply-face" />
                  <div className="pyet-reply-bubble">
                    <TurnBody turn={turn} variant={variant} onRevealed={markRevealed} />
                  </div>
                </div>
              </article>
            ) : (
              <article className="pyet-turn" key={turn.id}>
                <p className="pyet-asked" data-no-translate>{turn.question}</p>
                <TurnBody turn={turn} variant={variant} onRevealed={markRevealed} />
              </article>
            ),
          )}
          <div ref={tailRef} />
        </div>
      )}

      {started && !busy && !writing && followUps.length > 0 && (
        <div className="pyet-more">
          <h4>PYET EDHE</h4>
          <ul className="pyet-chips">
            {followUps.map((chip, i) => (
              <li key={chip.question} style={{ "--i": i } as React.CSSProperties}>
                <button type="button" onClick={() => void ask(chip.question)}>
                  {chip.label}
                </button>
              </li>
            ))}
          </ul>
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
              : overlay
                ? "Shkruaji Dardanit…"
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
          disabled={busy || typed.trim().length < 2}
          aria-label="Dërgo pyetjen"
        >
          <ArrowUp size={15} strokeWidth={2.8} aria-hidden="true" />
        </button>
      </form>

      {overlay && chips.length > 0 && !started && (
        <ul className="pyet-chips">
          {chips.map((chip, i) => (
            <li key={chip.question} style={{ "--i": i } as React.CSSProperties}>
              <button type="button" onClick={() => void ask(chip.question)} data-personal={chip.reason ? "" : undefined}>
                {chip.reason && <span className="pyet-chip-reason">{chip.reason}</span>}
                {chip.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="pyet-hint">
        {overlay
          ? "Për lajmet, Dardani përgjigjet vetëm nga artikujt e botuar te 383. Nëse arkivi nuk e ka, ta thotë."
          : "Dardani përgjigjet vetëm nga lajmet e botuara te 383."}
      </p>

      {started && !busy && !writing && (
        <button
          type="button"
          className="pyet-again"
          onClick={() => setTurns([])}
        >
          Fillo bisedë të re
        </button>
      )}
    </div>
  );
}

/** One exchange's answer side: waiting, writing, answered, or refused. */
function TurnBody({
  turn,
  variant,
  onRevealed,
}: {
  turn: Turn;
  variant: "article" | "overlay";
  onRevealed: (id: number) => void;
}) {
  if (turn.state === "thinking") {
    return variant === "overlay" ? (
      <div className="pyet-thinking">
        <span className="pyet-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <p>Po kërkon në arkivin e 383…</p>
      </div>
    ) : (
      <div className="pyet-searching">
        <DardaniLoop name="researching" className="pyet-searching-loop" />
        <div className="pyet-skeleton" aria-hidden="true">
          <i style={{ width: "92%" }} />
          <i style={{ width: "78%" }} />
          <i style={{ width: "54%" }} />
        </div>
      </div>
    );
  }

  if (turn.state === "answered") {
    return (
      <div className="pyet-answer" aria-live="polite">
        {turn.revealed ? (
          <p className="pyet-text" data-no-translate lang={turn.language??"sq"}>{turn.answer}</p>
        ) : (
          <Reveal text={turn.answer ?? ""} language={turn.language??"sq"} onDone={() => onRevealed(turn.id)} />
        )}
        {/* No "Bazuar në" list: Lind wants the answer to read as Dardani's own.
            The server still refuses any news answer that cites no article. */}
      </div>
    );
  }

  const failed = FAILURES.has(turn.reason ?? "");
  return (
    <div className="pyet-refusal" aria-live="polite">
      <p className="pyet-refusal-head">{turn.refusal?.headline}</p>
      <p className="pyet-refusal-detail">{turn.refusal?.detail}</p>
      {/* "no-sources" already says this in its own detail line. */}
      {!failed && turn.reason !== "no-sources" && (
        <p className="pyet-refusal-note">
          Dardani përgjigjet vetëm nga artikujt e 383. Kur arkivi nuk e ka, e thotë hapur.
        </p>
      )}
      <Link className="pyet-refusal-cta" href={turn.refusal?.ctaHref ?? "/"}>
        {turn.refusal?.ctaLabel ?? "Shiko LAJMET E FUNDIT"}
        <ArrowRight size={14} strokeWidth={2.6} aria-hidden="true" />
      </Link>
    </div>
  );
}

/** Ticks per reveal: at 28ms a tick, the whole answer is out in about 1.3s. */
const REVEAL_TICKS = 45;
const REVEAL_TICK_MS = 28;

/**
 * Writes the answer out with a caret, then hands over to the finished answer.
 * Screen readers get the full text at once; the partial text is visual only.
 */
function Reveal({ text, onDone, language }: { text: string; onDone: () => void; language: SiteLanguage }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (reduced) {
      doneRef.current();
      return;
    }
    const step = Math.max(1, Math.ceil(text.length / REVEAL_TICKS));
    let at = 0;
    const timer = window.setInterval(() => {
      at += step;
      if (at >= text.length) {
        window.clearInterval(timer);
        doneRef.current();
      } else {
        setShown(at);
      }
    }, REVEAL_TICK_MS);
    return () => window.clearInterval(timer);
  }, [text, reduced]);

  return (
    <p className="pyet-text" data-no-translate lang={language}>
      <span aria-hidden="true">
        {text.slice(0, shown)}
        <span className="pyet-caret" />
      </span>
      <span className="sr-only">{text}</span>
    </p>
  );
}
