"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, Check, ChevronRight, Copy, ImagePlus, Plus, Share2, Trophy, Zap } from "lucide-react";
import LeagueEmblem from "@/components/tregu/league-emblem";
import LeaguePay, { type LeaguePayment } from "@/components/tregu/league-pay";
import PublicLeagueCard from "@/components/tregu/public-league-card";
import { primeSellSound } from "@/components/tregu/trade-success-sound";
import { untilLabel } from "@/components/tregu/trader-leaderboard";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  DURATION_LABEL,
  LEAGUE_CODE_PATTERN,
  LEAGUE_COLORS,
  LEAGUE_DURATIONS,
  LEAGUE_EMOJIS,
  LEAGUE_FEE_MAX,
  LEAGUE_FEE_MIN,
  LEAGUE_FEES,
  isImageEmblem,
  leagueColor,
  leagueError,
  leaguePhase,
  leaguePurse,
  leagueShareUrl,
  potSplit,
  privateBonusPct,
  privatePurse,
  type LeagueSummary,
} from "@/lib/tregu-leagues";
import "./leagues.css";

type Pulse = { players: number; leagues: number; faces: string[] };
type Created = { id: string; code: string; name: string; days: number; fee: number; emblem: string; color: string };
type Draft = { name: string; emblem: string; color: string; fee: number; days: number };
type Stage =
  | { kind: "idle" }
  | { kind: "create" }
  | { kind: "created"; league: Created }
  | { kind: "joined"; id: string; name: string };

/** The prize maths, worked out in front of the creator for a guessed crowd. */
function PotMath({ fee, days }: { fee: number; days: number }) {
  const [members, setMembers] = useState(8);
  const pot = fee * members;
  const bonus = privateBonusPct(days);
  const purse = privatePurse(pot, days);
  const split = potSplit(purse, 3);
  return (
    <div className="lgc-math" aria-live="polite">
      <label className="lgc-math-members">
        Nëse hyjnë <b>{members}</b> miq
        <input type="range" min={2} max={30} value={members} onChange={(event) => setMembers(Number(event.target.value))} aria-label="Sa miq hyjnë" />
      </label>
      <p className="lgc-math-line">
        Poti <b>{fmtNum(pot)}</b> + 383 shton <em>+{bonus}%</em> = <b>{fmtNum(purse)} 383C</b>
      </p>
      <div className="lgc-math-split">
        {["1-rë", "2-të", "3-të"].map((place, index) => (
          <span key={place}>{place} · {[50, 30, 20][index]}%<b>{fmtNum(split[index] ?? 0)}</b></span>
        ))}
      </div>
      <p className="lgc-note">Bonusi i 383 rritet me kohën: deri në një javë +10%, dy javë +15%, një muaj +25%. Ndahet vetëm mes atyre me pikë.</p>
    </div>
  );
}

/**
 * Ligat on the Tregu floor, under Sportet në Treg. Your leagues first, with
 * your place in each; then create or join by code; then 383's public leagues.
 * A league is a prediction game: pick outcomes, earn points, the top three
 * split the pot. Invite links land here with ?kodi= and open the preview.
 */
export default function LeaguesCard({ loggedIn }: { loggedIn: boolean }) {
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
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [payment, setPayment] = useState<LeaguePayment | null>(null);
  const afterPay = useRef<Stage | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", emblem: "🏆", color: "#FF4422", fee: 50, days: 7 });
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const section = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    const [pulseResult, overview] = await Promise.all([
      supabase.rpc("tregu_leagues_pulse"),
      supabase.rpc("tregu_leagues_overview"),
    ]);
    const row = (pulseResult.data as Pulse[] | null)?.[0];
    if (row) setPulse({ players: row.players ?? 0, leagues: row.leagues ?? 0, faces: row.faces ?? [] });
    setLeagues((overview.data ?? []) as LeagueSummary[]);
  }, [supabase]);

  const lookUp = useCallback(async (raw: string) => {
    const clean = raw.trim().toUpperCase();
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
  }, [supabase]);

  useEffect(() => {
    void load();
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, [load]);

  // An invite link: /tregu?kodi=K7MQ2P#ligat opens straight on its league.
  useEffect(() => {
    const invited = new URLSearchParams(window.location.search).get("kodi");
    if (!invited) return;
    const clean = invited.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setCode(clean);
    void lookUp(clean);
    window.setTimeout(() => section.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
  }, [lookUp]);

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
    const next = code ? `/tregu?kodi=${code}#ligat` : "/tregu#ligat";
    window.location.href = `/hyr?next=${encodeURIComponent(next)}`;
  };

  const announce = (value: unknown) => {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    setBalance(next);
    window.dispatchEvent(new CustomEvent("tregu:balance", { detail: next }));
  };

  const openCreate = () => {
    if (!loggedIn) return signIn();
    setError(null);
    setDraft((current) => ({ ...current, name: current.name || `${firstName ?? "Shokët"} & miqtë`.slice(0, 40) }));
    setStage({ kind: "create" });
  };

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/tregu/league-media", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Ngarkimi dështoi.");
      setDraft((current) => ({ ...current, emblem: String(data.url) }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ngarkimi dështoi.");
    } finally {
      setUploading(false);
    }
  };

  const fee = Math.round(Number(draft.fee) || 0);
  const feeValid = fee >= LEAGUE_FEE_MIN && fee <= LEAGUE_FEE_MAX;

  const create = async () => {
    if (!feeValid) {
      setError(`Hyrja duhet të jetë ${LEAGUE_FEE_MIN} deri në ${fmtNum(LEAGUE_FEE_MAX)} 383C.`);
      return;
    }
    if (balance !== null && fee > balance) {
      setError("Nuk ke mjaft monedha për këtë hyrje.");
      return;
    }
    primeSellSound();
    setBusy("create");
    setError(null);
    const name = draft.name.trim();
    const { data, error: rpcError } = await supabase.rpc("tregu_league_create", {
      p_name: name,
      p_days: draft.days,
      p_entry_fee: fee,
      p_emblem: draft.emblem,
      p_color: draft.color,
    });
    setBusy(null);
    if (rpcError) {
      setError(leagueError(rpcError));
      return;
    }
    const row = (data as { id: string; code: string; balance: number }[] | null)?.[0];
    if (!row) return;
    announce(row.balance);
    afterPay.current = { kind: "created", league: { id: row.id, code: row.code, name, days: draft.days, fee, emblem: draft.emblem, color: draft.color } };
    setPayment({ amount: fee, pot: fee, league: name, kind: "create" });
    void load();
  };

  const finishPay = () => {
    setPayment(null);
    if (afterPay.current) {
      setStage(afterPay.current);
      afterPay.current = null;
    }
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
    const paid = Number(league.entry_fee) || 0;
    const joined: Stage = { kind: "joined", id: league.id, name: league.name };
    if (paid > 0) {
      afterPay.current = joined;
      setPayment({ amount: paid, pot: (Number(league.pot) || 0) + paid, league: league.name, kind: "join" });
    } else {
      setStage(joined);
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

  // Featured public leagues first (admin's order), else the biggest purses;
  // the ones you are already in drop out of this row (they are in yours).
  const open = leagues.filter((league) => league.kind === "public" && leaguePhase(league, now) !== "ended" && !league.is_member);
  const featured = open.filter((league) => league.featured).sort((a, b) => Number(a.feature_order ?? 0) - Number(b.feature_order ?? 0));
  const publics = (featured.length ? featured : [...open].sort((a, b) => leaguePurse(b) - leaguePurse(a))).slice(0, 3);
  const mine = leagues.filter((league) => league.is_member && leaguePhase(league, now) !== "ended");
  const players = pulse?.players ?? 0;
  const faces = pulse?.faces ?? [];

  return (
    <section ref={section} id="ligat" className="lgc lg-paper" aria-labelledby="lgc-title" data-stage={stage.kind}>
      <LeaguePay payment={payment} onDone={finishPay} />

      <header className="lgc-head">
        <span className="lgc-mark" aria-hidden><Trophy size={22} strokeWidth={2.4} /></span>
        <div className="lgc-titles">
          <h2 id="lgc-title">Ligat</h2>
          <p>Parashiko ndeshjet me miqtë. Çdo parashikim i saktë jep pikë, më shumë për surprizat. Tre të parët ndajnë potin.</p>
        </div>
        {players > 0 && (
          <div className="lgc-pulse" aria-label={`${players} lojtarë në ${pulse?.leagues ?? 0} liga`}>
            <span className="lgc-faces" aria-hidden>
              {faces.slice(0, 4).map((face, index) => <b key={`${face}-${index}`}>{face.slice(0, 1).toUpperCase()}</b>)}
            </span>
            <span><strong>{fmtNum(players)}</strong> po luajnë</span>
          </div>
        )}
      </header>

      {stage.kind === "idle" && mine.length > 0 && (
        <nav className="lgc-mine" aria-label="Ligat e tua">
          {mine.map((league) => {
            const phase = leaguePhase(league, now);
            return (
              <Link key={league.id} href={`/tregu/ligat/${league.id}`} className="lgc-mine-row" style={{ "--lg-color": leagueColor(league) } as CSSProperties}>
                <LeagueEmblem league={league} size={42} />
                <span className="lgc-mine-name">
                  <b>{league.name}</b>
                  <small data-open={phase === "live" || undefined}>
                    {phase === "upcoming" ? `Nis për ${untilLabel(Date.parse(league.starts_at), now)}` : `Bëj parashikimet · ${untilLabel(Date.parse(league.ends_at), now)} mbetur`}
                  </small>
                </span>
                <span className="lgc-mine-rank">
                  <strong>{league.my_rank ? `#${league.my_rank}` : "—"}<em>/{league.members}</em></strong>
                  <small>{fmtNum(Number(league.my_profit) || 0)} pikë</small>
                </span>
                <ChevronRight size={18} aria-hidden />
              </Link>
            );
          })}
        </nav>
      )}

      {stage.kind === "idle" && (
        <div className="lgc-actions">
          <button type="button" className="lgc-create" onClick={openCreate}>
            <Plus size={22} strokeWidth={2.6} aria-hidden />
            <span>Krijo ligën tënde</span>
            <small>Vendos hyrjen · miqtë hyjnë me kod</small>
          </button>
          <form className="lgc-code" onSubmit={(event) => { event.preventDefault(); void lookUp(code); }}>
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
              <button type="submit" className="lg-btn" disabled={code.length !== 6 || busy === "lookup"}>
                {busy === "lookup" ? "…" : <>Gjej <ArrowRight size={15} aria-hidden /></>}
              </button>
            </div>
          </form>
        </div>
      )}

      {stage.kind === "idle" && preview && (
        <div className="lgc-preview" style={{ "--lg-color": leagueColor(preview) } as CSSProperties}>
          <LeagueEmblem league={preview} size={46} />
          <div>
            <strong>{preview.name}</strong>
            <span>
              {preview.members} anëtarë · {preview.entry_fee > 0 ? `hyrja ${fmtNum(preview.entry_fee)} 383C` : "falas"} · në lojë {fmtNum(leaguePurse(preview))} 383C
            </span>
          </div>
          {preview.is_member ? (
            <Link href={`/tregu/ligat/${preview.id}`} className="lg-ghost">Je brenda <ArrowRight size={14} aria-hidden /></Link>
          ) : (
            <button
              type="button"
              className="lg-btn"
              onClick={() => void join(preview, preview.code ?? undefined)}
              disabled={busy === preview.id || leaguePhase(preview, now) === "ended" || (balance !== null && preview.entry_fee > balance)}
            >
              {busy === preview.id ? "…" : leaguePhase(preview, now) === "ended" ? "Ka përfunduar" : preview.entry_fee > 0 ? `Hyr · ${fmtNum(preview.entry_fee)}` : "Hyr"}
            </button>
          )}
        </div>
      )}

      {stage.kind === "create" && (
        <form className="lgc-sheet" onSubmit={(event) => { event.preventDefault(); void create(); }}>
          <div className="lgc-sheet-preview" style={{ "--lg-color": draft.color } as CSSProperties}>
            <LeagueEmblem league={{ emblem: draft.emblem, color: draft.color, kind: "private", name: draft.name, scope_kind: "all", scope_value: null }} size={56} />
            <div>
              <strong>{draft.name.trim() || "Emri i ligës"}</strong>
              <span>{DURATION_LABEL[draft.days]} · hyrja {feeValid ? fmtNum(fee) : "—"} 383C</span>
            </div>
          </div>

          <label className="lgc-field">
            <span>Emri</span>
            <input type="text" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value.slice(0, 40) })} placeholder="Shokët e Prishtinës" autoFocus />
          </label>

          <div className="lgc-field">
            <span>Ikona</span>
            <div className="lgc-emojis" role="group" aria-label="Ikona">
              {LEAGUE_EMOJIS.map((emoji) => (
                <button key={emoji} type="button" aria-pressed={draft.emblem === emoji} onClick={() => setDraft({ ...draft, emblem: emoji })}>{emoji}</button>
              ))}
              <button type="button" className="lgc-photo" aria-pressed={isImageEmblem(draft.emblem)} onClick={() => fileInput.current?.click()} disabled={uploading}>
                <ImagePlus size={16} aria-hidden /> {uploading ? "…" : "Foto"}
              </button>
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadPhoto(event.target.files?.[0])} />
            </div>
          </div>

          <div className="lgc-field">
            <span>Ngjyra</span>
            <div className="lgc-colors" role="group" aria-label="Ngjyra">
              {LEAGUE_COLORS.map((color) => (
                <button key={color} type="button" aria-pressed={draft.color === color} aria-label={color} style={{ "--swatch": color } as CSSProperties} onClick={() => setDraft({ ...draft, color })} />
              ))}
            </div>
          </div>

          <div className="lgc-field">
            <span>Sa kushton hyrja</span>
            <div className="lgc-chips" role="group" aria-label="Hyrja">
              {LEAGUE_FEES.map((value) => (
                <button key={value} type="button" aria-pressed={fee === value} disabled={balance !== null && value > balance} onClick={() => setDraft({ ...draft, fee: value })}>
                  {fmtNum(value)}
                </button>
              ))}
              <input
                className="lgc-fee-input"
                inputMode="numeric"
                aria-label="Hyrje tjetër"
                value={LEAGUE_FEES.includes(fee as (typeof LEAGUE_FEES)[number]) ? "" : String(draft.fee || "")}
                placeholder="Tjetër"
                onChange={(event) => setDraft({ ...draft, fee: Number(event.target.value.replace(/\D/g, "").slice(0, 5)) })}
              />
            </div>
          </div>

          <div className="lgc-field">
            <span>Zgjat</span>
            <div className="lgc-chips" role="group" aria-label="Zgjat">
              {LEAGUE_DURATIONS.map((value) => (
                <button key={value} type="button" aria-pressed={draft.days === value} onClick={() => setDraft({ ...draft, days: value })}>{DURATION_LABEL[value]}</button>
              ))}
            </div>
          </div>

          {feeValid && <PotMath fee={fee} days={draft.days} />}

          <div className="lgc-row">
            <button type="submit" className="lg-btn" data-wide disabled={busy === "create" || uploading || draft.name.trim().length < 3 || !feeValid}>
              <Zap size={16} aria-hidden /> {busy === "create" ? "Duke krijuar…" : `Krijo · ${feeValid ? fmtNum(fee) : "—"} 383C`}
            </button>
            <button type="button" className="lg-ghost" onClick={() => { setStage({ kind: "idle" }); setError(null); }}>Anulo</button>
          </div>
        </form>
      )}

      {stage.kind === "created" && (
        <div className="lgc-sheet">
          <div className="lgc-sheet-preview" style={{ "--lg-color": stage.league.color } as CSSProperties}>
            <LeagueEmblem league={{ emblem: stage.league.emblem, color: stage.league.color, kind: "private", name: stage.league.name, scope_kind: "all", scope_value: null }} size={52} />
            <p className="lgc-done"><Check size={18} strokeWidth={3} aria-hidden /> {stage.league.name} u krijua</p>
          </div>
          <div className="lgc-codebig" aria-label={`Kodi i ligës: ${stage.league.code}`}>
            {stage.league.code.split("").map((char, index) => (
              <span key={index} style={{ "--i": index } as CSSProperties}>{char}</span>
            ))}
          </div>
          <p className="lgc-note">Dërgoja miqve. Kushdo që hyn paguan {fmtNum(stage.league.fee)} 383C dhe poti rritet.</p>
          <div className="lgc-row">
            <button type="button" className="lg-btn" onClick={() => void invite(stage.league)}>
              <Share2 size={16} aria-hidden /> Fto miqtë
            </button>
            <button type="button" className="lg-ghost" onClick={() => void copy(stage.league)}>
              {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? "U kopjua" : "Kopjo linkun"}
            </button>
            <Link href={`/tregu/ligat/${stage.league.id}`} className="lg-ghost">Bëj parashikimet <ArrowRight size={14} aria-hidden /></Link>
          </div>
        </div>
      )}

      {stage.kind === "joined" && (
        <div className="lgc-sheet">
          <p className="lgc-done"><Check size={20} strokeWidth={3} aria-hidden /> U bashkove në {stage.name}</p>
          <p className="lgc-note">Zgjidh rezultatin e ndeshjeve para se të nisin. Pikët numërohen sapo të mbarojnë.</p>
          <div className="lgc-row">
            <Link href={`/tregu/ligat/${stage.id}`} className="lg-btn">Bëj parashikimet <ArrowRight size={15} aria-hidden /></Link>
            <button type="button" className="lg-ghost" onClick={() => setStage({ kind: "idle" })}>Mbyll</button>
          </div>
        </div>
      )}

      {error && <p className="lgc-error" role="alert">{error}</p>}

      {stage.kind === "idle" && publics.length > 0 && (
        <>
          <div className="lgc-section-head">
            <h3>Ligat e 383</h3>
            <span>383 shton shpërblimin</span>
          </div>
          <div className="lgc-publics">
            {publics.map((league) => (
              <PublicLeagueCard
                key={league.id}
                league={league}
                now={now}
                href={`/tregu/ligat/${league.id}`}
                action={
                  <button
                    type="button"
                    className="lg-btn"
                    onClick={() => void join(league)}
                    disabled={busy === league.id || (balance !== null && league.entry_fee > balance)}
                  >
                    {busy === league.id ? "…" : league.entry_fee > 0 ? `Hyr · ${fmtNum(league.entry_fee)} 383C` : "Hyr falas"}
                  </button>
                }
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
