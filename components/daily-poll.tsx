"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ArrowRight, Check, Zap } from "lucide-react";
import Link from "next/link";
import SectionLabel from "./section-label";
import {
  dateKeyInKosovo,
  pollPercentages,
  resultStatusLabel,
  stakeLabel,
  standingLabel,
  tallyFromCounts,
  voteCountLabel,
} from "@/lib/sondazhi-data.mjs";
import { activeStreak, advanceStreak, parseStreak } from "@/lib/reagimi-data";
import type { SondazhiServerData } from "@/lib/sondazhi-server";

/** Shared with ReagimiDites and the pre-rewrite poll: one anonymous identity. */
const VOTER_KEY = "383_voter_id";
const STREAK_KEY = "383_sondazhi_streak";

type LoadState = "loading" | "ready" | "error";

export default function DailyPoll({ data }: { data: SondazhiServerData }) {
  // The server key is the first paint's guess. ISR means this HTML can be up to
  // an hour old, so the client re-derives the real Kosovo date on mount.
  const [todayKey, setTodayKey] = useState(data.todayKey);
  const [counts, setCounts] = useState<number[]>(() => new Array(data.options.length).fill(0));
  const [myVote, setMyVote] = useState<number | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [pending, setPending] = useState(false);
  const [streak, setStreak] = useState(0);
  const [barsArmed, setBarsArmed] = useState(false);

  const voterRef = useRef("");
  const supabaseRef = useRef<SupabaseClient | null>(null);

  const total = counts.reduce((a, b) => a + b, 0);
  const percentages = useMemo(() => pollPercentages(counts), [counts]);

  useEffect(() => {
    setTodayKey(dateKeyInKosovo());

    try {
      let vid = localStorage.getItem(VOTER_KEY);
      if (!vid) {
        vid = crypto.randomUUID();
        localStorage.setItem(VOTER_KEY, vid);
      }
      voterRef.current = vid;
    } catch {
      // Storage blocked. An in-memory id still lets this session vote once.
      voterRef.current = crypto.randomUUID();
    }

    try {
      setStreak(activeStreak(parseStreak(localStorage.getItem(STREAK_KEY)), dateKeyInKosovo()));
    } catch {
      /* Storage blocked. The streak is a flourish, not the feature. */
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      // Read-only card: the question still renders, voting is simply unavailable.
      setState("ready");
      return;
    }

    const supabase = createClient(url, key);
    supabaseRef.current = supabase;

    let cancelled = false;
    (async () => {
      const { data: day, error } = await supabase.rpc("sondazhi_day", {
        p_date: data.pollDate,
        p_voter: voterRef.current,
      });
      if (cancelled) return;

      if (error) {
        // This is the failure that used to render as a confident "0 vota".
        console.error("[sondazhi] tally unavailable", error);
        setState("error");
        return;
      }

      const payload = day as { counts?: Record<string, unknown>; my_vote?: number | null } | null;
      setCounts(tallyFromCounts(payload?.counts, data.options.length).counts);
      setMyVote(typeof payload?.my_vote === "number" ? payload.my_vote : null);
      setState("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [data.pollDate, data.options.length]);

  // Bars hold at zero for one committed frame so the CSS transition has
  // something to animate from. Without this the results mount at their final
  // width and the reveal, the actual payoff for voting, never plays.
  useEffect(() => {
    if (myVote === null) {
      setBarsArmed(false);
      return;
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setBarsArmed(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [myVote]);

  const castVote = useCallback(
    async (idx: number) => {
      if (myVote !== null || pending) return;
      const supabase = supabaseRef.current;
      if (!supabase) return;

      setPending(true);
      setMyVote(idx);
      setCounts((c) => c.map((v, i) => (i === idx ? v + 1 : v)));

      try {
        const next = advanceStreak(parseStreak(localStorage.getItem(STREAK_KEY)), todayKey);
        localStorage.setItem(STREAK_KEY, JSON.stringify(next));
        setStreak(next.count);
      } catch {
        /* Storage blocked. The vote itself still counts. */
      }

      const { error } = await supabase.from("poll_votes").insert({
        poll_date: data.pollDate,
        option_index: idx,
        voter_id: voterRef.current,
      });

      if (error) {
        // 23505 = the one-vote-per-day unique index. This browser already voted,
        // so the vote state is right and only the local count is double-counted.
        if (error.code === "23505") {
          setCounts((c) => c.map((v, i) => (i === idx ? Math.max(0, v - 1) : v)));
        } else {
          setMyVote(null);
          setCounts((c) => c.map((v, i) => (i === idx ? Math.max(0, v - 1) : v)));
        }
      }
      setPending(false);
    },
    [myVote, pending, todayKey, data.pollDate]
  );

  const voted = myVote !== null;
  // Reading the tally and casting a vote are independent operations, so a
  // failed read must not take the vote down with it. Without this split, the
  // one day the tally query breaks is also the day nobody can answer.
  const tallyKnown = state === "ready";
  const canVote = state !== "loading" && supabaseRef.current !== null;
  const standing = standingLabel(myVote, counts);

  return (
    <div className="sondazhi" style={{ marginBottom: "var(--space-section)" }}>
      <SectionLabel
        label="SONDAZHI I DITËS"
        marginBottom={20}
        right={
          <span className="sondazhi-meta">
            {streak >= 2 && (
              <span className="sondazhi-streak" title={`Ke votuar ${streak} ditë radhazi`}>
                <Zap size={11} strokeWidth={2.5} aria-hidden="true" />
                {streak} ditë radhazi
              </span>
            )}
            {tallyKnown && <span>{voteCountLabel(total)}</span>}
          </span>
        }
      />

      <div className="sondazhi-card">
        {/* Yesterday's outcome. The payoff for having voted then, and the frame
            for today's question — today's own split stays hidden until you vote,
            because showing it first would drag the vote toward it. */}
        {data.callback && (
          <div className="sondazhi-callback">
            <span className="sondazhi-callback-kicker">DJE</span>
            <p className="sondazhi-callback-text">
              <strong>{data.callback.pct}%</strong> zgjodhën{" "}
              <em>{data.callback.option}</em>
              <span className="sondazhi-callback-q"> · {data.callback.question}</span>
            </p>
            {data.callback.slug && (
              <Link href={`/article/${data.callback.slug}`} className="sondazhi-callback-link">
                Lexo <ArrowRight size={12} strokeWidth={2.5} aria-hidden="true" />
              </Link>
            )}
          </div>
        )}

        {data.contextLine && <p className="sondazhi-context">{data.contextLine}</p>}

        <h3 className="sondazhi-question">{data.question}</h3>

        {voted && !tallyKnown ? (
          <p className="sondazhi-error" role="status">
            Vota jote u regjistrua. Rezultatet nuk u ngarkuan dot tani — provo të
            rifreskosh faqen.
          </p>
        ) : voted ? (
          <div className="sondazhi-results" aria-live="polite">
            {data.options.map((opt, i) => (
              <div
                key={i}
                className="sondazhi-row"
                data-mine={myVote === i ? "true" : undefined}
                style={
                  {
                    "--pct": barsArmed ? percentages[i] / 100 : 0,
                    "--reveal-delay": `${i * 40}ms`,
                  } as React.CSSProperties
                }
              >
                <span className="sondazhi-row-label">
                  {myVote === i && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                  {opt}
                </span>
                <span className="sondazhi-row-value">
                  {percentages[i]}%<span className="sondazhi-row-count">({counts[i]})</span>
                </span>
                <span className="sondazhi-track">
                  <span className="sondazhi-fill" />
                </span>
              </div>
            ))}

            <div className="sondazhi-verdict">
              {standing && <p className="sondazhi-standing">{standing}</p>}
              <p className="sondazhi-status">
                {resultStatusLabel(total, data.pollDate, todayKey)}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="sondazhi-options">
              {data.options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  className="poll-option"
                  onClick={() => castVote(i)}
                  disabled={!canVote || pending}
                >
                  {opt}
                </button>
              ))}
            </div>
            <p className="sondazhi-stake">
              {!canVote
                ? "Votimi nuk është i disponueshëm tani."
                : tallyKnown
                  ? stakeLabel(total)
                  : "Vota jote e ndryshon rezultatin."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
