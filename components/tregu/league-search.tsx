"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowRight, Plus, Search } from "lucide-react";
import LeagueEmblem from "@/components/tregu/league-emblem";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { leagueColor, leaguePurse, type SearchLeague } from "@/lib/tregu-leagues";

/** Asks the create sheet to open with a name filled in (leagues-card.tsx). */
export const LEAGUE_CREATE_EVENT = "tregu:league-create";

/**
 * Find any public league by name: results as you type, each with its own
 * one-tap join. Nothing found offers to create one under that name.
 */
export default function LeagueSearch({
  busy,
  onJoin,
}: {
  busy: string | null;
  onJoin: (league: SearchLeague) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchLeague[] | null>(null);
  const [loading, setLoading] = useState(false);
  const clean = query.trim();

  useEffect(() => {
    if (clean.length < 2) {
      setResults(null);
      return;
    }
    let live = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const { data } = await supabase.rpc("tregu_league_search", { p_query: clean });
      if (!live) return;
      setResults((data ?? []) as SearchLeague[]);
      setLoading(false);
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [clean, supabase]);

  const create = () => window.dispatchEvent(new CustomEvent(LEAGUE_CREATE_EVENT, { detail: { name: clean.slice(0, 40), listed: true } }));

  return (
    <div className="lgq">
      <label className="lgq-box">
        <Search size={17} aria-hidden />
        <span className="sr-only">Kërko ligë</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value.slice(0, 40))}
          placeholder="Kërko ligë me emër…"
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>

      <p className="sr-only" aria-live="polite">
        {results ? (results.length ? `${results.length} liga u gjetën` : "Asnjë ligë") : ""}
      </p>

      {results && results.length > 0 && (
        <ul className="lgq-list">
          {results.map((league) => {
            const full = league.members >= league.max_members;
            return (
              <li key={league.id} className="lgq-row" style={{ "--lg-color": leagueColor(league) } as CSSProperties}>
                <LeagueEmblem league={league} size={36} />
                <Link href={`/tregu/ligat/${league.id}`} className="lgq-name">
                  <b>{league.name}</b>
                  <small>
                    {league.kind === "public" ? "Zyrtare" : "Publike"} · {fmtNum(league.members)} lojtarë · {fmtNum(leaguePurse(league))} 383C
                  </small>
                </Link>
                {league.is_member ? (
                  <Link href={`/tregu/ligat/${league.id}`} className="lg-ghost">Je brenda <ArrowRight size={14} aria-hidden /></Link>
                ) : (
                  <button type="button" className="lg-btn" disabled={full || busy === league.id} onClick={() => onJoin(league)}>
                    {full ? "Plot" : busy === league.id ? "…" : Number(league.entry_fee) > 0 ? `Hyr · ${fmtNum(league.entry_fee)}` : "Hyr falas"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {results && results.length === 0 && !loading && (
        <div className="lgq-none">
          <span>Asnjë ligë me emrin “{clean}”.</span>
          <button type="button" className="lg-ghost" onClick={create}>
            <Plus size={15} aria-hidden /> Krijo një me këtë emër
          </button>
        </div>
      )}
    </div>
  );
}
