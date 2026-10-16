"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ArrowRight, Check, Share2, X, Zap } from "lucide-react";
import Link from "next/link";
import SectionLabel from "./section-label";
import {
  marksLine,
  scoreAnswers,
  scoreVerdict,
  shareText,
  splitPercents,
  splitVerdict,
  splitVisible,
  type QuizQuestion,
} from "@/lib/kuizi-data.mjs";
import {
  activeStreak,
  advanceStreak,
  dateKeyInKosovo,
  formatAlbanianDate,
  parseStreak,
} from "@/lib/reagimi-data";
import { track } from "@/lib/analytics";
import type { KuiziServerData } from "@/lib/kuizi-server";

/** One anonymous identity across the site's daily cards. */
const VOTER_KEY = "383_voter_id";
const STREAK_KEY = "383_kuiz_streak";
const progressKey = (dateKey: string) => `383:kuiz:${dateKey}`;

type Answers = (number | null)[];
type Counts = number[][];

interface DayState {
  players: number;
  counts: Counts;
  mine: Answers;
}

const emptyCounts = (): Counts => Array.from({ length: 5 }, () => [0, 0, 0, 0]);
const emptyAnswers = (): Answers => [null, null, null, null, null];

/** kuizi_day / kuizi_answer payload → state, tolerant of anything malformed. */
function readDay(raw: unknown): DayState | null {
  const d = raw as { players?: unknown; counts?: unknown; mine?: unknown } | null;
  if (!d || typeof d !== "object") return null;
  const counts = Array.isArray(d.counts)
    ? d.counts.map((row) => (Array.isArray(row) ? row.map((n) => Number(n) || 0) : [0, 0, 0, 0]))
    : emptyCounts();
  const mine = Array.isArray(d.mine)
    ? d.mine.map((m) => (Number.isInteger(m) ? (m as number) : null))
    : emptyAnswers();
  return { players: Number(d.players) || 0, counts, mine };
}

/** Saved progress on this device. Stored data may predate this shape. */
function readProgress(dateKey: string): Answers {
  try {
    const raw = JSON.parse(localStorage.getItem(progressKey(dateKey)) ?? "null");
    const answers = raw?.answers;
    if (!Array.isArray(answers)) return emptyAnswers();
    return Array.from({ length: 5 }, (_, i) => (Number.isInteger(answers[i]) ? answers[i] : null));
  } catch {
    return emptyAnswers();
  }
}

function saveProgress(dateKey: string, answers: Answers) {
  try {
    localStorage.setItem(progressKey(dateKey), JSON.stringify({ answers }));
  } catch {
    /* Storage blocked: progress lasts for this page view only. */
  }
}

export default function KuiziDites({
  data,
  standalone = false,
}: {
  data: KuiziServerData;
  /** On /kuiz the card is the page, so it skips the section label. */
  standalone?: boolean;
}) {
  const quiz = data.questions;
  const [todayKey, setTodayKey] = useState(data.todayKey);
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [step, setStep] = useState(0);
  const [day, setDay] = useState<DayState | null>(null);
  const [splitFailed, setSplitFailed] = useState(false);
  const [streak, setStreak] = useState(0);
  const [shared, setShared] = useState<"idle" | "copied">("idle");
  const [seen, setSeen] = useState(false);

  const supabaseRef = useRef<SupabaseClient | null>(null);
  const voterRef = useRef("");
  const rootRef = useRef<HTMLElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  /** Latest answers for async callbacks, which would otherwise see a stale closure. */
  const answersRef = useRef<Answers>(emptyAnswers());

  const isToday = data.dateKey === todayKey;
  const answeredCount = answers.filter((a) => a !== null).length;
  const done = answeredCount === quiz.length;
  const { marks, score } = useMemo(
    () => scoreAnswers(quiz, answers.map((a) => (a === null ? -1 : a))),
    [quiz, answers]
  );

  // ── Identity, saved progress, the room's split so far ─────────────────────
  useEffect(() => {
    setTodayKey(dateKeyInKosovo());

    try {
      let vid = localStorage.getItem(VOTER_KEY);
      if (!vid) {
        vid = crypto.randomUUID();
        localStorage.setItem(VOTER_KEY, vid);
      }
      voterRef.current = vid;
      setStreak(activeStreak(parseStreak(localStorage.getItem(STREAK_KEY)), dateKeyInKosovo()));
    } catch {
      voterRef.current = crypto.randomUUID();
    }

    const local = readProgress(data.dateKey);
    answersRef.current = local;
    setAnswers(local);
    const firstOpen = local.findIndex((a) => a === null);
    setStep(firstOpen === -1 ? quiz.length : firstOpen);
    restoredRef.current = true;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setSplitFailed(true);
      return;
    }
    const supabase = createClient(url, key);
    supabaseRef.current = supabase;

    let cancelled = false;
    (async () => {
      const { data: raw, error } = await supabase.rpc("kuizi_day", {
        p_date: data.dateKey,
        p_voter: voterRef.current,
      });
      if (cancelled) return;
      const state = error ? null : readDay(raw);
      if (!state) {
        setSplitFailed(true);
        return;
      }
      setDay(state);
      // Answers given on this id from another visit or tab count too: the
      // server keeps the first answer, so it wins over this device's copy.
      // This response can land after the reader has already answered here, so
      // the card only moves on when the server knew an answer this device did
      // not; otherwise it would skip past the result the reader is looking at.
      const prev = answersRef.current;
      const merged = prev.map((a, i) => state.mine[i] ?? a);
      const learned = merged.some((a, i) => a !== null && prev[i] === null);
      if (!learned) return;
      answersRef.current = merged;
      setAnswers(merged);
      saveProgress(data.dateKey, merged);
      const open = merged.findIndex((a) => a === null);
      setStep((s) => (merged[s] === null ? s : open === -1 ? quiz.length : open));
    })();

    return () => {
      cancelled = true;
    };
  }, [data.dateKey, quiz.length]);

  // Entrance waits until the card is actually looked at: it sits mid-page.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ── Answering ─────────────────────────────────────────────────────────────
  const answer = useCallback(
    async (qi: number, choice: number) => {
      if (answers[qi] !== null) return;
      const next = answers.map((a, i) => (i === qi ? choice : a));
      answersRef.current = next;
      setAnswers(next);
      saveProgress(data.dateKey, next);

      // Optimistic: count this answer into the split straight away, so the
      // bars appear on the tap rather than after a round trip.
      setDay((d) =>
        d
          ? {
              ...d,
              counts: d.counts.map((row, i) =>
                i === qi ? row.map((n, o) => (o === choice ? n + 1 : n)) : row
              ),
            }
          : d
      );

      const right = choice === quiz[qi].correct;
      if (answers.every((a) => a === null)) track("kuiz_start", { date: data.dateKey });
      track("kuiz_answer", { q: qi + 1, correct: right });

      if (next.every((a) => a !== null)) {
        const final = scoreAnswers(quiz, next as number[]).score;
        track("kuiz_complete", { score: final, date: data.dateKey });
        if (isToday) {
          try {
            const s = advanceStreak(parseStreak(localStorage.getItem(STREAK_KEY)), todayKey);
            localStorage.setItem(STREAK_KEY, JSON.stringify(s));
            setStreak(s.count);
          } catch {
            /* Storage blocked. The streak is a flourish. */
          }
        }
      }

      const supabase = supabaseRef.current;
      if (!supabase) return;
      const { data: raw, error } = await supabase.rpc("kuizi_answer", {
        p_date: data.dateKey,
        p_voter: voterRef.current,
        p_q: qi,
        p_choice: choice,
      });
      const state = error ? null : readDay(raw);
      if (state) {
        setDay(state);
        setSplitFailed(false);
      } else {
        // The answer still counts on this device; only the room is unknown.
        console.error("[kuiz] answer not recorded", error);
        setSplitFailed(true);
      }
    },
    [answers, data.dateKey, quiz, isToday, todayKey]
  );

  // After an answer, focus moves to "next" so a keyboard reader can continue.
  useEffect(() => {
    if (!restoredRef.current) return;
    if (step < quiz.length && answers[step] !== null) nextRef.current?.focus({ preventScroll: true });
  }, [answers, step, quiz.length]);

  const goNext = () => {
    const open = answers.findIndex((a) => a === null);
    setStep(open === -1 ? quiz.length : open);
    // Keep the card's top in view on phones, where the next question would
    // otherwise start below the fold of the long result.
    const top = stageRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) stageRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const share = async () => {
    const url = `${window.location.origin}/kuiz`;
    const text = shareText({
      dateLabel: formatAlbanianDate(data.dateKey),
      score,
      marks,
      url,
    });
    track("kuiz_share", { score });
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShared("copied");
      window.setTimeout(() => setShared("idle"), 2200);
    } catch {
      /* Share sheet dismissed. Nothing to do. */
    }
  };

  const label = isToday ? "KUIZI I DITËS" : "KUIZI I DJESHËM";

  return (
    <section
      ref={rootRef}
      id="kuizi-i-dites"
      className="kuiz"
      data-seen={seen ? "true" : undefined}
      data-standalone={standalone ? "true" : undefined}
      aria-label="Kuizi i ditës"
    >
      {!standalone && (
        <SectionLabel
          label={label}
          marginBottom={16}
          right={
            <span className="kuiz-meta">
              {streak >= 2 && (
                <span className="kuiz-streak" title={`Ke luajtur ${streak} ditë radhazi`}>
                  <Zap size={11} strokeWidth={2.5} aria-hidden="true" />
                  {streak} ditë radhazi
                </span>
              )}
              <span>{formatAlbanianDate(data.dateKey)}</span>
            </span>
          }
        />
      )}

      <div className="kuiz-card" ref={stageRef}>
        <ol className="kuiz-progress" aria-label={`${answeredCount} nga ${quiz.length} pyetje`}>
          {quiz.map((_, i) => (
            <li
              key={i}
              className="kuiz-pip"
              data-state={answers[i] === null ? (i === step ? "current" : "open") : marks[i] ? "right" : "wrong"}
            />
          ))}
        </ol>

        {done && step >= quiz.length ? (
          <EndCard
            quiz={quiz}
            answers={answers as number[]}
            marks={marks}
            score={score}
            day={day}
            streak={isToday ? streak : 0}
            shared={shared}
            onShare={share}
            onReview={(i) => setStep(i)}
          />
        ) : (
          <QuestionStage
            key={step}
            index={Math.min(step, quiz.length - 1)}
            question={quiz[Math.min(step, quiz.length - 1)]}
            picked={answers[Math.min(step, quiz.length - 1)]}
            counts={day?.counts[Math.min(step, quiz.length - 1)] ?? null}
            splitFailed={splitFailed}
            total={quiz.length}
            isLast={answers.filter((a) => a === null).length === 0}
            nextRef={nextRef}
            onAnswer={answer}
            onNext={goNext}
          />
        )}
      </div>
    </section>
  );
}

function QuestionStage({
  index,
  question,
  picked,
  counts,
  splitFailed,
  total,
  isLast,
  nextRef,
  onAnswer,
  onNext,
}: {
  index: number;
  question: QuizQuestion;
  picked: number | null;
  counts: number[] | null;
  splitFailed: boolean;
  total: number;
  isLast: boolean;
  nextRef: React.RefObject<HTMLButtonElement | null>;
  onAnswer: (qi: number, choice: number) => void;
  onNext: () => void;
}) {
  const answered = picked !== null;
  const gotIt = picked === question.correct;
  const split = counts ? splitPercents(counts, question.options.length) : null;
  const showSplit = answered && split !== null && splitVisible(split.total);
  const verdict = showSplit && split ? splitVerdict(split.pct, question.correct, gotIt) : null;
  const qid = `kuiz-q-${index}`;

  return (
    <div className="kuiz-stage" data-answered={answered ? "true" : undefined}>
      <p className="kuiz-kicker">
        Pyetja {index + 1}/{total}
        {question.category ? <span> · {question.category}</span> : null}
      </p>
      <h3 id={qid} className="kuiz-question">
        {question.q}
      </h3>

      <div className="kuiz-options" role="group" aria-labelledby={qid}>
        {question.options.map((opt, o) => {
          const state = !answered
            ? undefined
            : o === question.correct
              ? "correct"
              : o === picked
                ? "wrong"
                : "other";
          const pct = showSplit && split ? split.pct[o] : null;
          return (
            <button
              key={o}
              type="button"
              className="kuiz-option"
              data-usage-action="quiz_answer"
              data-state={state}
              data-mine={picked === o ? "true" : undefined}
              aria-pressed={answered ? picked === o : undefined}
              disabled={answered}
              onClick={() => onAnswer(index, o)}
              style={{ "--pct": pct === null ? "0%" : `${pct}%` } as React.CSSProperties}
            >
              <span className="kuiz-option-mark" aria-hidden="true">
                {state === "correct" ? (
                  <Check size={14} strokeWidth={3} />
                ) : state === "wrong" ? (
                  <X size={14} strokeWidth={3} />
                ) : (
                  String.fromCharCode(65 + o)
                )}
              </span>
              <span className="kuiz-option-label">{opt}</span>
              {state === "correct" && <span className="kuiz-sr"> (përgjigjja e saktë)</span>}
              {state === "wrong" && <span className="kuiz-sr"> (përgjigjja jote, e gabuar)</span>}
              {pct !== null && <span className="kuiz-option-pct">{pct}%</span>}
            </button>
          );
        })}
      </div>

      <div className="kuiz-reveal" aria-live="polite">
        {answered && (
          <>
            <p className="kuiz-result" data-right={gotIt ? "true" : "false"}>
              {gotIt ? "E qëllove." : "Jo këtë herë."}
              {verdict && <span className="kuiz-verdict"> {verdict}</span>}
            </p>
            <p className="kuiz-room">
              {showSplit && split
                ? `${split.total} lexues janë përgjigjur deri tani.`
                : splitFailed
                  ? "Përgjigjet e të tjerëve nuk u ngarkuan tani."
                  : split === null
                    ? "Po shohim si u përgjigjën të tjerët…"
                    : "Je ndër të parët që përgjigjen sot. Rezultati i të tjerëve shfaqet së shpejti."}
            </p>
            <p className="kuiz-explain">
              <strong>Çfarë do të thotë:</strong> {question.explain}
            </p>
            <div className="kuiz-actions">
              <Link
                href={`/article/${question.slug}`}
                className="kuiz-read"
                onClick={() => track("kuiz_read_click", { q: index + 1 })}
              >
                Lexo lajmin
              </Link>
              <button ref={nextRef} type="button" className="kuiz-next" data-usage-action="quiz_next" onClick={onNext}>
                {isLast ? "Shiko rezultatin" : "Pyetja tjetër"}
                <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EndCard({
  quiz,
  answers,
  marks,
  score,
  day,
  streak,
  shared,
  onShare,
  onReview,
}: {
  quiz: QuizQuestion[];
  answers: number[];
  marks: boolean[];
  score: number;
  day: DayState | null;
  streak: number;
  shared: "idle" | "copied";
  onShare: () => void;
  onReview: (i: number) => void;
}) {
  return (
    <div className="kuiz-end">
      <div className="kuiz-score">
        <p className="kuiz-score-num">
          {score}
          <span>/{quiz.length}</span>
        </p>
        <div>
          <p className="kuiz-score-marks" aria-label={`${score} të sakta nga ${quiz.length}`}>
            {marksLine(marks)}
          </p>
          <p className="kuiz-score-verdict">{scoreVerdict(score)}</p>
          {streak >= 2 && <p className="kuiz-score-streak">{streak} ditë radhazi.</p>}
        </div>
      </div>

      <ol className="kuiz-recap">
        {quiz.map((q, i) => {
          const split = day ? splitPercents(day.counts[i], q.options.length) : null;
          const rightPct = split && splitVisible(split.total) ? split.pct[q.correct] : null;
          return (
            <li key={i} className="kuiz-recap-row" data-right={marks[i] ? "true" : "false"}>
              <span className="kuiz-recap-mark" aria-hidden="true">
                {marks[i] ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
              </span>
              <button type="button" className="kuiz-recap-q" onClick={() => onReview(i)}>
                {q.q}
                <span className="kuiz-sr">{marks[i] ? " (e saktë)" : " (gabim)"}</span>
              </button>
              {rightPct !== null && <span className="kuiz-recap-pct">{rightPct}% e qëlluan</span>}
              {answers[i] !== q.correct && (
                <span className="kuiz-recap-answer">Përgjigjja: {q.options[q.correct]}</span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="kuiz-end-actions">
        <button type="button" className="kuiz-next" onClick={onShare}>
          <Share2 size={15} strokeWidth={2.5} aria-hidden="true" />
          {shared === "copied" ? "U kopjua" : "Ndaje rezultatin"}
        </button>
        <p className="kuiz-tomorrow">Kuizi i ri del nesër në mëngjes.</p>
      </div>
    </div>
  );
}
