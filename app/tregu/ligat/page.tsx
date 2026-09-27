"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, KeyRound, Lock, Plus, Trophy, Users } from "lucide-react";
import Navbar from "@/components/navbar";
import { untilLabel } from "@/components/tregu/trader-leaderboard";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  LEAGUE_CODE_PATTERN,
  LEAGUE_DURATIONS,
  LEAGUE_FEES,
  leagueError,
  leaguePhase,
  leaguePrizes,
  type LeagueSummary,
} from "@/lib/tregu-leagues";
import styles from "./ligat.module.css";

type Preview = LeagueSummary;

function PhaseLabel({ league, now }: { league: LeagueSummary; now: number }) {
  const phase = leaguePhase(league, now);
  if (phase === "ended") return <span className={styles.phase} data-phase="ended">Përfundoi</span>;
  if (phase === "upcoming") return <span className={styles.phase} data-phase="upcoming">Fillon për {untilLabel(Date.parse(league.starts_at), now)}</span>;
  return <span className={styles.phase} data-phase="live"><i aria-hidden /> Mbyllet për {untilLabel(Date.parse(league.ends_at), now)}</span>;
}

function PrizeLine({ league }: { league: LeagueSummary }) {
  const prizes = leaguePrizes(league);
  if (!prizes.length) {
    return <span className={styles.prizeNone}>{league.kind === "private" ? "Pa tarifë · për lavdi" : "Pa shpërblime"}</span>;
  }
  return (
    <span className={styles.prizes}>
      {prizes.map((prize, index) => (
        <b key={index} data-place={index + 1}>{fmtNum(prize)}</b>
      ))}
      <small>383C</small>
    </span>
  );
}

/**
 * Ligat: compete with everyone (public leagues 383 runs and pays) or with
 * friends (private leagues, joined by a 6-character code, paid from their own
 * entry-fee pot). Ranking is the leaderboard's rule — profit from trades that
 * close inside the league's window, from the moment each member joined.
 */
export default function LigatPage() {
  const supabase = useMemo(() => createClient(), []);
  const [auth, setAuth] = useState<"checking" | "in" | "out">("checking");
  const [leagues, setLeagues] = useState<LeagueSummary[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [days, setDays] = useState<number>(7);
  const [fee, setFee] = useState<number>(0);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("tregu_leagues_overview");
    if (!error) setLeagues((data ?? []) as LeagueSummary[]);
    else setLeagues([]);
  }, [supabase]);

  const loadBalance = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setAuth(user ? "in" : "out");
    if (!user) return;
    const { data } = await supabase.from("profiles").select("coins").eq("id", user.id).single();
    if (typeof data?.coins === "number") setBalance(Number(data.coins));
  }, [supabase]);

  const lookUp = useCallback(async (raw: string) => {
    const clean = raw.trim().toUpperCase();
    setPreviewError(null);
    setPreview(null);
    if (!LEAGUE_CODE_PATTERN.test(clean)) {
      setPreviewError("Kodi ka 6 shkronja e shifra, p.sh. K7MQ2P.");
      return;
    }
    const { data, error } = await supabase.rpc("tregu_league_preview", { p_code: clean });
    const found = (data as Preview[] | null)?.[0];
    if (error || !found) setPreviewError("Nuk gjetëm ligë me këtë kod.");
    else setPreview({ ...found, code: clean });
  }, [supabase]);

  useEffect(() => {
    void load();
    void loadBalance();
    // A shared link lands here as ?kodi=XXXXXX: open that league's card.
    const shared = new URLSearchParams(window.location.search).get("kodi");
    if (shared) {
      setCode(shared.toUpperCase());
      void lookUp(shared);
    }
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, [load, loadBalance, lookUp]);

  const announce = (next: unknown) => {
    const value = Number(next);
    if (Number.isFinite(value)) {
      setBalance(value);
      window.dispatchEvent(new CustomEvent("tregu:balance", { detail: value }));
    }
  };

  const join = async (league: { id: string; kind: string; name: string }, joinCode?: string) => {
    if (auth !== "in") {
      window.location.href = `/hyr?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    setBusy(league.id);
    setNotice(null);
    const { data, error } = await supabase.rpc(
      "tregu_league_join",
      joinCode ? { p_code: joinCode } : { p_league_id: league.id }
    );
    setBusy(null);
    if (error) {
      setNotice({ ok: false, text: leagueError(error) });
      return;
    }
    announce((data as { balance: number }[] | null)?.[0]?.balance);
    setNotice({ ok: true, text: `U bashkove në "${league.name}". Tregtitë që mbyll tani e tutje numërohen.` });
    setPreview(null);
    setCode("");
    await load();
  };

  const create = async () => {
    setCreateError(null);
    setBusy("create");
    const { data, error } = await supabase.rpc("tregu_league_create", { p_name: name.trim(), p_days: days, p_entry_fee: fee });
    setBusy(null);
    if (error) {
      setCreateError(leagueError(error));
      return;
    }
    const row = (data as { id: string; code: string; balance: number }[] | null)?.[0];
    announce(row?.balance);
    if (row?.id) window.location.href = `/tregu/ligat/${row.id}?e-re=1`;
  };

  const mine = (leagues ?? []).filter((league) => league.is_member);
  const open = (leagues ?? []).filter((league) => league.kind === "public" && !league.is_member && leaguePhase(league, now) !== "ended");

  return (
    <div className="tregu-scope">
      <Navbar />
      <main className={styles.page}>
        <header className={styles.hero}>
          <Link href="/tregu" className={styles.back}><span aria-hidden>&#8592;</span> Kthehu te Tregu</Link>
          <h1>Ligat</h1>
          <p>
            Garo me gjithë Kosovën ose vetëm me miqtë. Renditjen e vendos fitimi nga tregtitë që mbyll gjatë ligës — tre të parët fitojnë.
          </p>
        </header>

        {notice && <p className={styles.notice} data-ok={notice.ok || undefined} role="status">{notice.text}</p>}

        <section className={styles.actions} aria-label="Hyr ose krijo">
          <article className={`tregu-glass ${styles.action}`}>
            <span className={styles.actionMark} aria-hidden><KeyRound size={18} /></span>
            <h2>Hyr me kod</h2>
            <p>Ke një kod nga një mik? Shkruaje këtu.</p>
            <form
              className={styles.codeRow}
              onSubmit={(event) => { event.preventDefault(); void lookUp(code); }}
            >
              <input
                className={styles.codeInput}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                placeholder="K7MQ2P"
                aria-label="Kodi i ligës"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
              />
              <button type="submit" className={styles.dark} disabled={code.length !== 6}>Gjej</button>
            </form>
            {previewError && <p className={styles.fieldError} role="alert">{previewError}</p>}
            {preview && (
              <div className={styles.preview}>
                <div>
                  <strong>{preview.name}</strong>
                  <span>
                    <Users size={13} aria-hidden /> {preview.members}/{preview.max_members} ·{" "}
                    {preview.entry_fee > 0 ? `Tarifa ${fmtNum(preview.entry_fee)} 383C` : "Pa tarifë"} ·{" "}
                    <PhaseLabel league={preview} now={now} />
                  </span>
                </div>
                {preview.is_member ? (
                  <Link className={styles.ghost} href={`/tregu/ligat/${preview.id}`}>Hap ligën <ArrowRight size={14} aria-hidden /></Link>
                ) : leaguePhase(preview, now) === "ended" ? (
                  <span className={styles.muted}>Ka përfunduar</span>
                ) : (
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={busy === preview.id || (balance !== null && preview.entry_fee > balance)}
                    onClick={() => void join(preview, preview.code ?? undefined)}
                  >
                    {busy === preview.id ? "Duke u bashkuar…" : preview.entry_fee > 0 ? `Bashkohu · ${fmtNum(preview.entry_fee)} 383C` : "Bashkohu"}
                  </button>
                )}
              </div>
            )}
          </article>

          <article className={`tregu-glass ${styles.action}`}>
            <span className={styles.actionMark} aria-hidden><Lock size={17} /></span>
            <h2>Krijo ligë private</h2>
            <p>Deri në 50 miq. Tarifa e hyrjes mblidhet në një pot që ndahet 50/30/20.</p>
            {!creating ? (
              <button type="button" className={styles.dark} onClick={() => (auth === "out" ? (window.location.href = "/hyr?next=/tregu/ligat") : setCreating(true))}>
                <Plus size={15} aria-hidden /> Krijo ligën
              </button>
            ) : (
              <form className={styles.createForm} onSubmit={(event) => { event.preventDefault(); void create(); }}>
                <label>
                  <span>Emri</span>
                  <input value={name} onChange={(event) => setName(event.target.value.slice(0, 40))} placeholder="Shokët e Prishtinës" autoFocus />
                </label>
                <fieldset>
                  <legend>Zgjat</legend>
                  <div className={styles.chips}>
                    {LEAGUE_DURATIONS.map((value) => (
                      <button type="button" key={value} aria-pressed={days === value} onClick={() => setDays(value)}>
                        {value === 1 ? "1 ditë" : value === 30 ? "1 muaj" : value === 7 ? "1 javë" : value === 14 ? "2 javë" : `${value} ditë`}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>Tarifa e hyrjes</legend>
                  <div className={styles.chips}>
                    {LEAGUE_FEES.map((value) => (
                      <button type="button" key={value} aria-pressed={fee === value} onClick={() => setFee(value)} disabled={balance !== null && value > balance}>
                        {value === 0 ? "Falas" : `${fmtNum(value)} 383C`}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <p className={styles.hint}>
                  {fee > 0
                    ? `Paguan ${fmtNum(fee)} 383C tani. Me 10 anëtarë poti bëhet ${fmtNum(fee * 10)} 383C.`
                    : "Pa tarifë nuk ka pot: liga luhet për vendin e parë."}
                </p>
                {createError && <p className={styles.fieldError} role="alert">{createError}</p>}
                <div className={styles.formActions}>
                  <button type="submit" className={styles.primary} disabled={busy === "create" || name.trim().length < 3}>
                    {busy === "create" ? "Duke krijuar…" : "Krijo dhe merr kodin"}
                  </button>
                  <button type="button" className={styles.ghost} onClick={() => setCreating(false)}>Anulo</button>
                </div>
              </form>
            )}
          </article>
        </section>

        {mine.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Ligat e mia</h2>
            <div className={styles.grid}>
              {mine.map((league) => (
                <Link key={league.id} href={`/tregu/ligat/${league.id}`} className={`tregu-glass ${styles.card}`}>
                  <div className={styles.cardTop}>
                    <span className={styles.kind} data-kind={league.kind}>{league.kind === "public" ? "Publike" : "Private"}</span>
                    <PhaseLabel league={league} now={now} />
                  </div>
                  <h3>{league.name}</h3>
                  <div className={styles.standing}>
                    <span>
                      <small>Vendi yt</small>
                      <strong>{league.my_rank ? `#${league.my_rank}` : "—"}<em> / {league.members}</em></strong>
                    </span>
                    <span>
                      <small>Fitimi</small>
                      <strong data-tone={Number(league.my_profit) > 0 ? "up" : Number(league.my_profit) < 0 ? "down" : undefined}>
                        {Number(league.my_profit) > 0 ? "+" : ""}{fmtNum(Number(league.my_profit) || 0)}
                      </strong>
                    </span>
                  </div>
                  <div className={styles.cardFoot}>
                    <PrizeLine league={league} />
                    <ArrowRight size={16} aria-hidden />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Ligat publike</h2>
          {leagues === null ? (
            <div className={styles.grid}>{[0, 1, 2].map((key) => <i key={key} className={styles.skeleton} />)}</div>
          ) : open.length ? (
            <div className={styles.grid}>
              {open.map((league) => (
                <article key={league.id} className={`tregu-glass ${styles.card}`}>
                  <div className={styles.cardTop}>
                    <span className={styles.kind} data-kind="public"><Trophy size={12} aria-hidden /> 383 paguan</span>
                    <PhaseLabel league={league} now={now} />
                  </div>
                  <h3><Link href={`/tregu/ligat/${league.id}`}>{league.name}</Link></h3>
                  <p className={styles.meta}><Users size={13} aria-hidden /> {league.members} tregtarë</p>
                  <div className={styles.cardFoot}>
                    <PrizeLine league={league} />
                    <button type="button" className={styles.primary} disabled={busy === league.id} onClick={() => void join(league)}>
                      {busy === league.id ? "…" : <><Check size={14} aria-hidden /> Bashkohu</>}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <p>{mine.some((league) => league.kind === "public") ? "Je në të gjitha ligat publike të hapura." : "Asnjë ligë publike e hapur tani. Krijo një private me miqtë."}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
