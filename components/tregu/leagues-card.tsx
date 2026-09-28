"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, Check, Copy, Settings2, Share2, Zap } from "lucide-react";
import LeagueCrew from "@/components/tregu/league-crew";
import LeagueEmblem from "@/components/tregu/league-emblem";
import LeaguePay, { type LeaguePayment } from "@/components/tregu/league-pay";
import { primeSellSound } from "@/components/tregu/trade-success-sound";
import { untilLabel } from "@/components/tregu/trader-leaderboard";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  DURATION_LABEL,
  LEAGUE_CODE_PATTERN,
  LEAGUE_DURATIONS,
  LEAGUE_FEE_MIN,
  LEAGUE_FEES,
  leagueColor,
  leagueError,
  leaguePhase,
  leaguePurse,
  leagueShareUrl,
  scopeOf,
  type LeagueSummary,
} from "@/lib/tregu-leagues";

type Pulse = { players: number; leagues: number; faces: string[] };
type Created = { id: string; code: string; name: string; days: number; fee: number };
type Stage =
  | { kind: "idle" }
  | { kind: "created"; league: Created }
  | { kind: "joined"; id: string; name: string };


/** Gold trophy, drawn for this card: a cup that catches the floodlight. */
function GoldTrophy() {
  return (
    <svg className="lgc-trophy" viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id="lgc-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF0B8" />
          <stop offset=".38" stopColor="#F2C14E" />
          <stop offset=".7" stopColor="#C8901F" />
          <stop offset="1" stopColor="#8A5A12" />
        </linearGradient>
      </defs>
      <path fill="url(#lgc-gold)" d="M14 6h20v9c0 6.2-4.1 11.2-10 11.9-5.9-.7-10-5.7-10-11.9V6Zm20 3h5.5c.8 0 1.5.7 1.5 1.5 0 5.4-3.5 9.6-8.3 10.4.8-1.6 1.3-3.4 1.3-5.4V9ZM14 9v6.5c0 2 .5 3.8 1.3 5.4C10.5 20.1 7 15.9 7 10.5 7 9.7 7.7 9 8.5 9H14Zm7.5 18.6h5v6.4h5.3c1 0 1.7.8 1.7 1.7V40h-19v-4.3c0-.9.7-1.7 1.7-1.7h5.3v-6.4Z" />
      <path fill="#fff" opacity=".45" d="M17 8.5h2.2v7.2c0 2.6 1 5 2.7 6.7-3-.9-4.9-3.6-4.9-6.8V8.5Z" />
    </svg>
  );
}

/** A number that counts up once, when the card is first seen. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const step = (time: number) => {
        const t = Math.min(1, (time - start) / 1100);
        setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    setShown(0);
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);
  return <span ref={ref}>{fmtNum(shown)}</span>;
}

/** Gold, orange and white paper, thrown once from the middle of the card. */
function Confetti({ burst }: { burst: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        id: `${burst}-${i}`,
        x: Math.round((Math.random() - 0.5) * 520),
        y: Math.round(-120 - Math.random() * 180),
        r: Math.round((Math.random() - 0.5) * 900),
        d: Math.round(Math.random() * 120),
        c: ["#F2C14E", "#FF4422", "#FFF0B8", "#F1ECE3", "#E3B341"][i % 5],
        w: 5 + Math.round(Math.random() * 5),
      })),
    [burst]
  );
  if (!burst) return null;
  return (
    <span className="lgc-confetti" aria-hidden key={burst}>
      {pieces.map((p) => (
        <i
          key={p.id}
          style={{ "--x": `${p.x}px`, "--y": `${p.y}px`, "--r": `${p.r}deg`, "--d": `${p.d}ms`, "--c": p.c, "--w": `${p.w}px` } as CSSProperties}
        />
      ))}
    </span>
  );
}

/**
 * The Ligat card on the Tregu floor — the one night-stadium moment on the
 * cream floor. Everything happens here: one tap makes a week-long league (10
 * coins in) and turns the card into its invite; a friend's code joins in
 * place; the open public leagues join in one tap. Every entry pays with the
 * briefcase moment. Your private leagues' tables sit right under the card.
 */
export default function LeaguesCard({ loggedIn, variant = "floor" }: { loggedIn: boolean; variant?: "floor" | "page" }) {
  // On /tregu/ligat the public leagues and your leagues have sections of their
  // own below the card, so the card keeps to creating and joining.
  const compact = variant === "page";
  const supabase = useMemo(() => createClient(), []);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<LeagueSummary | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ name: string; days: number; fee: number }>({ name: "", days: 7, fee: LEAGUE_FEE_MIN });
  const [payment, setPayment] = useState<LeaguePayment | null>(null);
  // What to show once the briefcase closes.
  const afterPay = useRef<Stage | null>(null);
  const [copied, setCopied] = useState(false);
  const [burst, setBurst] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const [pulseResult, overview] = await Promise.all([
      supabase.rpc("tregu_leagues_pulse"),
      supabase.rpc("tregu_leagues_overview"),
    ]);
    const row = (pulseResult.data as Pulse[] | null)?.[0];
    if (row) setPulse({ players: row.players ?? 0, leagues: row.leagues ?? 0, faces: row.faces ?? [] });
    setLeagues((overview.data ?? []) as LeagueSummary[]);
  }, [supabase]);

  useEffect(() => {
    void load();
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, [load]);

  useEffect(() => {
    if (!loggedIn) return;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("display_name, coins").eq("id", user.id).single();
      const name = String(data?.display_name ?? user.email?.split("@")[0] ?? "").trim().split(/\s+/)[0];
      setFirstName(name || null);
      if (typeof data?.coins === "number") setBalance(Number(data.coins));
    });
  }, [loggedIn, supabase]);

  const signIn = () => {
    window.location.href = `/hyr?next=${encodeURIComponent("/tregu")}`;
  };

  const announce = (value: unknown) => {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    setBalance(next);
    window.dispatchEvent(new CustomEvent("tregu:balance", { detail: next }));
  };

  const celebrate = () => setBurst((value) => value + 1);

  const createNow = async () => {
    if (!loggedIn) return signIn();
    if (balance !== null && balance < LEAGUE_FEE_MIN) {
      setError(`Duhen të paktën ${LEAGUE_FEE_MIN} 383C për të krijuar një ligë.`);
      return;
    }
    primeSellSound();
    setBusy("create");
    setError(null);
    const name = `${firstName ?? "Liga"} & miqtë`.slice(0, 40);
    const { data, error: rpcError } = await supabase.rpc("tregu_league_create", { p_name: name, p_days: 7, p_entry_fee: LEAGUE_FEE_MIN });
    setBusy(null);
    if (rpcError) {
      setError(leagueError(rpcError));
      return;
    }
    const row = (data as { id: string; code: string; balance: number }[] | null)?.[0];
    if (!row) return;
    announce(row.balance);
    const league = { id: row.id, code: row.code, name, days: 7, fee: LEAGUE_FEE_MIN };
    setDraft({ name, days: 7, fee: LEAGUE_FEE_MIN });
    afterPay.current = { kind: "created", league };
    setPayment({ amount: LEAGUE_FEE_MIN, pot: LEAGUE_FEE_MIN, league: name, kind: "create" });
    void load();
  };

  const finishPay = () => {
    setPayment(null);
    if (afterPay.current) {
      setStage(afterPay.current);
      afterPay.current = null;
      celebrate();
    }
  };

  const saveEdits = async () => {
    if (stage.kind !== "created") return;
    setBusy("save");
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("tregu_league_update", {
      p_league_id: stage.league.id,
      p_name: draft.name.trim(),
      p_days: draft.days,
      p_entry_fee: draft.fee,
    });
    setBusy(null);
    if (rpcError) {
      setError(leagueError(rpcError));
      return;
    }
    announce((data as { balance: number }[] | null)?.[0]?.balance);
    setStage({ kind: "created", league: { ...stage.league, name: draft.name.trim(), days: draft.days, fee: draft.fee } });
    setEditing(false);
    void load();
  };

  const lookUp = async () => {
    const clean = code.trim().toUpperCase();
    setError(null);
    setPreview(null);
    if (!LEAGUE_CODE_PATTERN.test(clean)) {
      setError("Kodi ka 6 shkronja e shifra, p.sh. K7MQ2P.");
      return;
    }
    setBusy("lookup");
    const { data } = await supabase.rpc("tregu_league_preview", { p_code: clean });
    setBusy(null);
    const found = (data as LeagueSummary[] | null)?.[0];
    if (!found) setError("Nuk gjetëm ligë me këtë kod.");
    else setPreview({ ...found, code: clean });
  };

  const join = async (league: { id: string; name: string; entry_fee?: number; pot?: number }, joinCode?: string) => {
    if (!loggedIn) return signIn();
    primeSellSound();
    setBusy(league.id);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc(
      "tregu_league_join",
      joinCode ? { p_code: joinCode } : { p_league_id: league.id }
    );
    setBusy(null);
    if (rpcError) {
      setError(leagueError(rpcError));
      return;
    }
    announce((data as { balance: number }[] | null)?.[0]?.balance);
    setPreview(null);
    setCode("");
    const fee = Number(league.entry_fee) || 0;
    const joined: Stage = { kind: "joined", id: league.id, name: league.name };
    if (fee > 0) {
      afterPay.current = joined;
      setPayment({ amount: fee, pot: (Number(league.pot) || 0) + fee, league: league.name, kind: "join" });
    } else {
      setStage(joined);
      celebrate();
    }
    void load();
  };

  const invite = async (league: Created) => {
    const url = leagueShareUrl(league.code);
    const text = `Hyr në ligën time "${league.name}" në 383 Tregu. Kodi: ${league.code}`;
    if (typeof navigator.share === "function") {
      await navigator.share({ title: league.name, text, url }).catch(() => undefined);
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
    }
  };

  const copy = async (league: Created) => {
    try {
      await navigator.clipboard.writeText(leagueShareUrl(league.code));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(`Kopjimi nuk u lejua. Kodi: ${league.code}`);
    }
  };

  // Open public leagues, the ones you are not in first, biggest purse first.
  const publics = leagues
    .filter((league) => league.kind === "public" && leaguePhase(league, now) !== "ended")
    .sort((a, b) => Number(a.is_member) - Number(b.is_member) || leaguePurse(b) - leaguePurse(a))
    .slice(0, 3);
  const mine = leagues.filter((league) => league.is_member && leaguePhase(league, now) !== "ended").slice(0, 4);
  const crew = leagues.filter((league) => league.is_member && league.kind === "private" && leaguePhase(league, now) !== "ended");
  const players = pulse?.players ?? 0;
  const faces = pulse?.faces ?? [];

  return (
    <>
    <section className="lgc" aria-labelledby="lgc-title" data-stage={stage.kind}>
      <LeaguePay payment={payment} onDone={finishPay} />
      <span className="lgc-lights" aria-hidden />
      <span className="lgc-pitch" aria-hidden />
      <Confetti burst={burst} />

      {!compact && (
      <header className="lgc-head">
        <GoldTrophy />
        <div className="lgc-titles">
          <h2 id="lgc-title">Ligat</h2>
          <p>Garo me miqtë. Fitimi vendos kampionin.</p>
        </div>
        {players > 0 && (
          <div className="lgc-pulse" aria-label={`${players} tregtarë po luajnë në ${pulse?.leagues ?? 0} liga`}>
            <span className="lgc-faces" aria-hidden>
              {faces.slice(0, 4).map((face, index) => (
                <b key={`${face}-${index}`} style={{ "--i": index } as CSSProperties}>{face.slice(0, 1).toUpperCase()}</b>
              ))}
            </span>
            <span><i aria-hidden /> <strong>{fmtNum(players)}</strong> po luajnë</span>
          </div>
        )}
      </header>
      )}

      {stage.kind === "idle" && (
        <div className="lgc-body">
          <button type="button" className="lgc-create" onClick={() => void createNow()} disabled={busy === "create"}>
            <Zap size={18} strokeWidth={2.4} aria-hidden />
            <span>{busy === "create" ? "Duke krijuar…" : "Krijo ligë me një prekje"}</span>
            <small>{LEAGUE_FEE_MIN} 383C hyrja · 1 javë · poti për tre të parët</small>
          </button>

          <form className="lgc-code" onSubmit={(event) => { event.preventDefault(); void lookUp(); }}>
            <label htmlFor="lgc-code-input">Ke kod nga një mik?</label>
            <div>
              <input
                id="lgc-code-input"
                value={code}
                onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)); setPreview(null); }}
                placeholder="K7MQ2P"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
              <button type="submit" disabled={code.length !== 6 || busy === "lookup"}>
                {busy === "lookup" ? "…" : <>Hyr <ArrowRight size={15} aria-hidden /></>}
              </button>
            </div>
          </form>

          {preview && (
            <div className="lgc-preview">
              <div>
                <strong>{preview.name}</strong>
                <span>
                  {preview.members} anëtarë · {preview.entry_fee > 0 ? `hyrja ${fmtNum(preview.entry_fee)} 383C` : "falas"} · poti {fmtNum(preview.pot)} 383C
                </span>
              </div>
              {preview.is_member ? (
                <Link href={`/tregu/ligat/${preview.id}`} className="lgc-ghost">Je brenda <ArrowRight size={14} aria-hidden /></Link>
              ) : (
                <button
                  type="button"
                  className="lgc-gold"
                  onClick={() => void join(preview, preview.code ?? undefined)}
                  disabled={busy === preview.id || leaguePhase(preview, now) === "ended" || (balance !== null && preview.entry_fee > balance)}
                >
                  {busy === preview.id ? "…" : leaguePhase(preview, now) === "ended" ? "Ka përfunduar" : preview.entry_fee > 0 ? `Bashkohu · ${fmtNum(preview.entry_fee)}` : "Bashkohu"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {stage.kind === "created" && (
        <div className="lgc-body lgc-reveal">
          <p className="lgc-done"><Check size={16} strokeWidth={3} aria-hidden /> {stage.league.name} u krijua</p>
          <div className="lgc-codebig" aria-label={`Kodi i ligës: ${stage.league.code}`}>
            {stage.league.code.split("").map((char, index) => (
              <span key={index} style={{ "--i": index } as CSSProperties}>{char}</span>
            ))}
          </div>
          <div className="lgc-row">
            <button type="button" className="lgc-gold lgc-wide" onClick={() => void invite(stage.league)}>
              <Share2 size={16} aria-hidden /> Fto miqtë
            </button>
            <button type="button" className="lgc-ghost" onClick={() => void copy(stage.league)}>
              {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? "U kopjua" : "Kopjo"}
            </button>
          </div>
          {!editing ? (
            <div className="lgc-terms">
              <span>{DURATION_LABEL[stage.league.days]} · hyrja {fmtNum(stage.league.fee)} 383C</span>
              <button type="button" onClick={() => setEditing(true)}><Settings2 size={14} aria-hidden /> Ndrysho</button>
              <Link href={`/tregu/ligat/${stage.league.id}`}>Renditja <ArrowRight size={13} aria-hidden /></Link>
            </div>
          ) : (
            <form className="lgc-edit" onSubmit={(event) => { event.preventDefault(); void saveEdits(); }}>
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value.slice(0, 40) })} aria-label="Emri i ligës" />
              <div className="lgc-chips" role="group" aria-label="Zgjat">
                {LEAGUE_DURATIONS.map((value) => (
                  <button type="button" key={value} aria-pressed={draft.days === value} onClick={() => setDraft({ ...draft, days: value })}>{DURATION_LABEL[value]}</button>
                ))}
              </div>
              <div className="lgc-chips" role="group" aria-label="Tarifa e hyrjes">
                {LEAGUE_FEES.map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={draft.fee === value}
                    disabled={balance !== null && value - stage.league.fee > balance}
                    onClick={() => setDraft({ ...draft, fee: value })}
                  >
                    {fmtNum(value)}
                  </button>
                ))}
              </div>
              <p className="lgc-note">Çdo mik paguan {fmtNum(draft.fee)} 383C për të hyrë. Poti ndahet 50/30/20 për tre të parët. Ndryshohet derisa të hyjë miku i parë.</p>
              <div className="lgc-row">
                <button type="submit" className="lgc-gold" disabled={busy === "save" || draft.name.trim().length < 3}>{busy === "save" ? "Duke ruajtur…" : "Ruaj"}</button>
                <button type="button" className="lgc-ghost" onClick={() => setEditing(false)}>Anulo</button>
              </div>
            </form>
          )}
          <button type="button" className="lgc-back" onClick={() => { setStage({ kind: "idle" }); setEditing(false); }}>Mbyll</button>
        </div>
      )}

      {stage.kind === "joined" && (
        <div className="lgc-body lgc-reveal">
          <p className="lgc-done lgc-done-big"><Check size={20} strokeWidth={3} aria-hidden /> U bashkove në {stage.name}</p>
          <p className="lgc-note">Tregtitë që mbyll tani e tutje numërohen. Tre të parët fitojnë.</p>
          <div className="lgc-row">
            <Link href={`/tregu/ligat/${stage.id}`} className="lgc-gold lgc-wide">Shiko renditjen <ArrowRight size={15} aria-hidden /></Link>
            <button type="button" className="lgc-ghost" onClick={() => setStage({ kind: "idle" })}>Mbyll</button>
          </div>
        </div>
      )}

      {error && <p className="lgc-error" role="alert">{error}</p>}

      {!compact && publics.length > 0 && stage.kind === "idle" && (
        <div className="lgc-publics">
          <div className="lgc-publics-head">
            <strong>Ligat publike · 383 paguan</strong>
            <Link href="/tregu/ligat">Të gjitha</Link>
          </div>
          {publics.map((league) => (
            <div key={league.id} className="lgc-pub" style={{ "--lg-color": leagueColor(league) } as CSSProperties}>
              <LeagueEmblem league={league} size={40} />
              <div className="lgc-pub-copy">
                <Link href={`/tregu/ligat/${league.id}`}>{league.name}</Link>
                <small>
                  {scopeOf(league).label} · {fmtNum(league.members)} brenda ·{" "}
                  {leaguePhase(league, now) === "upcoming"
                    ? `fillon për ${untilLabel(Date.parse(league.starts_at), now)}`
                    : `${untilLabel(Date.parse(league.ends_at), now)} mbetur`}
                </small>
              </div>
              <div className="lgc-pub-purse">
                <strong><CountUp value={leaguePurse(league)} /></strong>
                <small>383C në lojë</small>
              </div>
              {league.is_member ? (
                <Link href={`/tregu/ligat/${league.id}`} className="lgc-ghost">{league.my_rank ? `#${league.my_rank}` : "Brenda"}</Link>
              ) : (
                <button
                  type="button"
                  className="lgc-gold"
                  onClick={() => void join(league)}
                  disabled={busy === league.id || (balance !== null && league.entry_fee > balance)}
                >
                  {busy === league.id ? "…" : `Hyr · ${fmtNum(league.entry_fee)}`}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!compact && mine.length > 0 && stage.kind === "idle" && (
        <nav className="lgc-mine" aria-label="Ligat e tua">
          {mine.map((league) => (
            <Link key={league.id} href={`/tregu/ligat/${league.id}`}>
              <span>{league.name}</span>
              <b>{league.my_rank ? `#${league.my_rank}` : "—"}<em>/{league.members}</em></b>
            </Link>
          ))}
          <Link href="/tregu/ligat" className="lgc-all">Të gjitha <ArrowRight size={13} aria-hidden /></Link>
        </nav>
      )}
    </section>
    {crew.length > 0 && <LeagueCrew leagues={crew} />}
    </>
  );
}
