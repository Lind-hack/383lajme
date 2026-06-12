"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Check } from "lucide-react";
import { getDefaultPoll } from "@/lib/polls-data";
import SectionLabel from "./section-label";
import type { SupabaseClient } from "@supabase/supabase-js";

export default function DailyPoll() {
  const [pollDate, setPollDate] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [counts, setCounts] = useState<number[]>([]);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const voterIdRef = useRef("");
  const supabaseRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    const date = new Date().toISOString().slice(0, 10);
    setPollDate(date);

    let vid = localStorage.getItem("383_voter_id");
    if (!vid) {
      vid = crypto.randomUUID();
      localStorage.setItem("383_voter_id", vid);
    }
    voterIdRef.current = vid;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      const def = getDefaultPoll(date);
      setQuestion(def.question);
      setOptions(def.options);
      setCounts(new Array(def.options.length).fill(0));
      setLoading(false);
      return;
    }

    const supabase = createClient(url, key);
    supabaseRef.current = supabase;

    async function loadPoll() {
      const { data: adminPoll } = await supabase
        .from("daily_polls")
        .select("question, options")
        .eq("poll_date", date)
        .single();

      let q: string;
      let opts: string[];

      if (adminPoll) {
        q = adminPoll.question;
        opts = adminPoll.options as string[];
      } else {
        const def = getDefaultPoll(date);
        q = def.question;
        opts = def.options;
      }

      setQuestion(q);
      setOptions(opts);

      const { data: votes } = await supabase
        .from("poll_votes")
        .select("option_index, voter_id")
        .eq("poll_date", date);

      const c = new Array(opts.length).fill(0);
      let voted: number | null = null;

      if (votes) {
        for (const v of votes) {
          if (v.option_index >= 0 && v.option_index < opts.length) {
            c[v.option_index]++;
          }
          if (v.voter_id === vid) voted = v.option_index;
        }
      }

      setCounts(c);
      setMyVote(voted);
      setLoading(false);
    }

    loadPoll();
  }, []);

  async function castVote(idx: number) {
    if (myVote !== null) return;
    const supabase = supabaseRef.current;
    if (!supabase) return;

    const prev = myVote;
    setMyVote(idx);
    setCounts((c) => c.map((v, i) => (i === idx ? v + 1 : v)));

    const { error } = await supabase.from("poll_votes").insert({
      poll_date: pollDate,
      option_index: idx,
      voter_id: voterIdRef.current,
    });

    if (error) {
      setMyVote(prev);
      setCounts((c) => c.map((v, i) => (i === idx ? v - 1 : v)));
    }
  }

  const total = counts.reduce((a, b) => a + b, 0);

  return (
    <div style={{ marginBottom: "var(--space-section)" }}>
      <SectionLabel
        label="SONDAZHI I DITËS"
        marginBottom={20}
        right={
          !loading ? (
            <span style={{ fontSize: "11px", color: "#6B6B6B", fontWeight: 500 }}>
              {total} {total === 1 ? "votë" : "vota"}
            </span>
          ) : undefined
        }
      />

      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          border: "1.5px solid #E8E3DB",
          padding: "28px 32px",
        }}
      >
        {loading ? (
          <div style={{ height: "100px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#bbb", fontSize: "14px" }}>Duke ngarkuar...</div>
          </div>
        ) : (
          <>
            <p
              style={{
                margin: "0 0 20px",
                fontSize: "17px",
                fontWeight: 700,
                color: "#111",
                lineHeight: 1.4,
                fontFamily: "var(--font-manrope), sans-serif",
              }}
            >
              {question}
            </p>

            {myVote === null ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {options.map((opt, i) => (
                  <VoteButton key={i} label={opt} onClick={() => castVote(i)} />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {options.map((opt, i) => (
                  <ResultBar
                    key={i}
                    label={opt}
                    pct={total > 0 ? Math.round((counts[i] / total) * 100) : 0}
                    count={counts[i]}
                    isMyVote={myVote === i}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function VoteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="poll-option">
      {label}
    </button>
  );
}

function ResultBar({
  label,
  pct,
  count,
  isMyVote,
}: {
  label: string;
  pct: number;
  count: number;
  isMyVote: boolean;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "7px",
        }}
      >
        <span
          style={{
            fontSize: "14px",
            fontWeight: isMyVote ? 700 : 500,
            color: isMyVote ? "#FF4422" : "#111",
            fontFamily: "var(--font-manrope), sans-serif",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {isMyVote && <Check size={12} strokeWidth={3} />}
          {label}
        </span>
        <span style={{ fontSize: "13px", color: "#6B6B6B", fontWeight: 600, fontFamily: "var(--font-manrope), sans-serif" }}>
          {pct}%
          <span style={{ color: "#bbb", fontWeight: 400, marginLeft: "5px" }}>({count})</span>
        </span>
      </div>
      <div
        style={{
          height: "8px",
          borderRadius: "4px",
          background: "#F0ECE6",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: "4px",
            background: isMyVote ? "#FF4422" : "#D4CBC0",
            transition: "width 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>
    </div>
  );
}
