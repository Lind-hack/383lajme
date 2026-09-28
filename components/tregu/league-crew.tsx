"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowRight, Flame, Image as ImageIcon, Share2 } from "lucide-react";
import { untilLabel } from "@/components/tregu/trader-leaderboard";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { leagueShareUrl, type LeagueStanding, type LeagueSummary } from "@/lib/tregu-leagues";

const signed = (value: number) => `${value > 0 ? "+" : ""}${fmtNum(Math.round(value))}`;
const tone = (value: number) => (value > 0 ? "up" : value < 0 ? "down" : undefined);
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * Your private league, on the floor, right under the stadium card: who is in
 * it, where everyone stands, who won today, and — the line that brings people
 * back — exactly how far you are from the friend above you.
 */
export default function LeagueCrew({ leagues }: { leagues: LeagueSummary[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [activeId, setActiveId] = useState(leagues[0]?.id);
  const [rows, setRows] = useState<LeagueStanding[]>([]);
  const [overtaken, setOvertaken] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const league = leagues.find((item) => item.id === activeId) ?? leagues[0];

  const load = useCallback(async () => {
    if (!league) return;
    const { data } = await supabase.rpc("tregu_league_standings", { p_league_id: league.id });
    const next = (data ?? []) as LeagueStanding[];
    setRows(next);

    // "X të kaloi": compare with the rank this device last saw.
    const me = next.find((row) => row.is_me);
    if (!me) return;
    const key = `383:crew-rank:${league.id}`;
    try {
      const previous = JSON.parse(localStorage.getItem(key) ?? "null") as { rank: number } | null;
      if (previous && me.rank > previous.rank) {
        const passer = next.find((row) => row.rank === me.rank - 1);
        setOvertaken(passer ? firstName(passer.display_name) : null);
      } else {
        setOvertaken(null);
      }
      localStorage.setItem(key, JSON.stringify({ rank: me.rank }));
    } catch {
      // Storage can be unavailable; the nudge is a nicety.
    }
  }, [league, supabase]);

  useEffect(() => {
    void load();
    const refresh = window.setInterval(() => void load(), 60_000);
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    const onBalance = () => void load();
    window.addEventListener("tregu:balance", onBalance);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(tick);
      window.removeEventListener("tregu:balance", onBalance);
    };
  }, [load]);

  if (!league) return null;

  const me = rows.find((row) => row.is_me);
  const above = me ? rows.find((row) => row.rank === me.rank - 1) : undefined;
  const below = me ? rows.find((row) => row.rank === me.rank + 1) : undefined;
  const todayBest = [...rows].sort((a, b) => Number(b.today_profit ?? 0) - Number(a.today_profit ?? 0))[0];
  const shown = rows.slice(0, 5);
  if (me && me.rank > 5) shown.push(me);

  const invite = async () => {
    if (!league.code) return;
    const url = leagueShareUrl(league.code);
    const text = `Hyr në ligën "${league.name}" në 383 Tregu. Kodi: ${league.code}`;
    if (typeof navigator.share === "function") await navigator.share({ title: league.name, text, url }).catch(() => undefined);
    else window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
  };

  const shareTable = async () => {
    const imageUrl = `/api/tregu/league-card/${league.id}`;
    try {
      const blob = await fetch(imageUrl).then((response) => (response.ok ? response.blob() : Promise.reject()));
      const file = new File([blob], "383-liga.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: league.name });
        return;
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "383-liga.png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch {
      window.open(imageUrl, "_blank", "noopener");
    }
  };

  return (
    <section className="crew" aria-label={`Liga ${league.name}`}>
      {leagues.length > 1 && (
        <div className="crew-tabs" role="group" aria-label="Ligat e tua private">
          {leagues.map((item) => (
            <button key={item.id} type="button" aria-pressed={item.id === league.id} onClick={() => setActiveId(item.id)}>
              {item.name}
            </button>
          ))}
        </div>
      )}

      <header className="crew-head">
        <div className="crew-titles">
          <h3>{league.name}</h3>
          <p>
            {league.members} {league.members === 1 ? "anëtar" : "anëtarë"} · poti {fmtNum(league.pot)} 383C · mbyllet për{" "}
            {untilLabel(Date.parse(league.ends_at), now)}
          </p>
        </div>
        <div className="crew-faces" aria-hidden>
          {rows.slice(0, 6).map((row, index) => (
            <span key={row.rank} style={{ "--i": index } as CSSProperties}>{firstName(row.display_name).slice(0, 1).toUpperCase()}</span>
          ))}
          {rows.length > 6 && <em>+{rows.length - 6}</em>}
        </div>
      </header>

      <div className="crew-grid">
        <ol className="crew-table">
          {shown.map((row) => (
            <li key={row.rank} className="crew-row" data-me={row.is_me || undefined} data-place={row.rank}>
              <span className="crew-rank">{row.rank}</span>
              <span className="crew-name">
                <b>{row.display_name}</b>
                {row.is_me && <span className="crew-you">TI</span>}
                {Number(row.streak) >= 2 && (
                  <i title={`${row.streak} ditë radhazi`}><Flame size={12} aria-hidden /> {row.streak}</i>
                )}
              </span>
              <span className="crew-today" data-tone={tone(Number(row.today_profit ?? 0))}>
                {Number(row.today_profit ?? 0) !== 0 ? `sot ${signed(Number(row.today_profit))}` : ""}
              </span>
              <span className="crew-profit" data-tone={tone(row.profit)}>{signed(row.profit)}</span>
            </li>
          ))}
          {rows.length === 1 && (
            <li className="crew-row"><span className="crew-rank">2</span><span className="crew-name"><b style={{ color: "#6B6B6B" }}>Fto një mik — liga nis kur jeni dy</b></span><span /><span /></li>
          )}
        </ol>

        <div className="crew-side">
          <div className="crew-tile" data-tone="rival">
            <small>{overtaken ? `${overtaken} të kaloi` : me?.rank === 1 ? "Je i pari" : "Rivali yt"}</small>
            {me && above ? (
              <>
                <strong>{fmtNum(Math.max(0, above.profit - me.profit) + 1)} 383C pas {firstName(above.display_name)}</strong>
                <span>Mbyll një tregti me fitim sot dhe kaloje.</span>
              </>
            ) : me && below ? (
              <>
                <strong>{fmtNum(Math.max(0, me.profit - below.profit))} para {firstName(below.display_name)}</strong>
                <span>Mbaje vendin — {firstName(below.display_name)} po të ndjek.</span>
              </>
            ) : (
              <>
                <strong>Ende pa rival</strong>
                <span>Dërgo kodin dhe fillo garën.</span>
              </>
            )}
          </div>
          <div className="crew-tile">
            <small>Fituesi i sotëm</small>
            {todayBest && Number(todayBest.today_profit ?? 0) > 0 ? (
              <>
                <strong>{firstName(todayBest.display_name)} {signed(Number(todayBest.today_profit))}</strong>
                <span>Dita mbyllet në mesnatë.</span>
              </>
            ) : (
              <>
                <strong>Askush ende</strong>
                <span>Mbyll e para një tregti me fitim sot.</span>
              </>
            )}
          </div>
          <div className="crew-tile">
            <small>Seria jote</small>
            {me && Number(me.streak) > 0 ? (
              <strong><Flame size={15} aria-hidden style={{ color: "#C2410C", verticalAlign: "-2px" }} /> {me.streak} {me.streak === 1 ? "ditë" : "ditë radhazi"}</strong>
            ) : (
              <strong>Tregto sot</strong>
            )}
            <span>Çdo ditë me një tregti e zgjat serinë.</span>
          </div>
        </div>
      </div>

      <div className="crew-actions">
        {league.code && (
          <button type="button" className="crew-primary" onClick={() => void invite()}>
            <Share2 size={15} aria-hidden /> Fto miqtë · {league.code}
          </button>
        )}
        <button type="button" onClick={() => void shareTable()}>
          <ImageIcon size={15} aria-hidden /> Shpërndaj tabelën
        </button>
        <Link href={`/tregu/ligat/${league.id}`}>
          Renditja e plotë <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
