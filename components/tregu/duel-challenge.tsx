"use client";

import { useMemo, useState } from "react";
import { Swords, X } from "lucide-react";
import LeaguePay, { type LeaguePayment } from "@/components/tregu/league-pay";
import SwordClash from "@/components/tregu/sword-clash";
import { primeSellSound } from "@/components/tregu/trade-success-sound";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { DUEL_STAKES, leagueError } from "@/lib/tregu-leagues";
import "./leagues.css";

/**
 * Challenge one league member to 24 hours: whoever earns more league points
 * from picks that settle in that time takes both stakes (0 to 50 coins each).
 */
export default function DuelChallenge({
  leagueId,
  memberKey,
  rival,
  balance,
  onClose,
  onDone,
}: {
  leagueId: string;
  memberKey: string;
  rival: string;
  balance: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [stake, setStake] = useState<number>(25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<LeaguePayment | null>(null);
  const [sent, setSent] = useState(false);
  const [clash, setClash] = useState(0);
  // What follows the clash: the stake paying in, or straight to "sent".
  const [afterClash, setAfterClash] = useState<LeaguePayment | null>(null);

  const send = async () => {
    primeSellSound();
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("tregu_duel_challenge", { p_league_id: leagueId, p_member_key: memberKey, p_stake: stake });
    setBusy(false);
    if (rpcError) {
      setError(leagueError(rpcError));
      return;
    }
    const next = Number((data as { balance: number }[] | null)?.[0]?.balance);
    if (Number.isFinite(next)) window.dispatchEvent(new CustomEvent("tregu:balance", { detail: next }));
    // Swords first (the reader's own tap, so the sound is allowed), then the stake.
    setAfterClash(stake > 0 ? { amount: stake, pot: stake * 2, league: rival, kind: "duel" } : null);
    setClash((n) => n + 1);
  };

  return (
    <div className="duel-sheet" role="dialog" aria-label={`Sfido ${rival}`}>
      <SwordClash
        run={clash}
        onDone={() => {
          if (afterClash) setPayment(afterClash);
          else setSent(true);
          setAfterClash(null);
        }}
      />
      <LeaguePay payment={payment} onDone={() => { setPayment(null); setSent(true); }} />
      <button type="button" className="duel-x" onClick={onClose} aria-label="Mbyll"><X size={16} /></button>
      {sent ? (
        <div className="duel-sent">
          <Swords size={26} aria-hidden />
          <strong>Sfida iu dërgua {rival}</strong>
          <span>Kur ta pranojë, nisin 24 orët. Fiton kush mbledh më shumë pikë nga parashikimet.</span>
          <button type="button" className="duel-go" onClick={() => { onDone(); onClose(); }}>Në rregull</button>
        </div>
      ) : (
        <>
          <strong className="duel-title"><Swords size={18} aria-hidden /> Sfido {rival}</strong>
          <p className="duel-rules">24 orë parashikime në këtë ligë. Kush mbledh më shumë pikë merr të dy bastet. Barazim ose refuzim: basti kthehet.</p>
          <div className="duel-stakes" role="group" aria-label="Basti">
            {DUEL_STAKES.map((value) => (
              <button key={value} type="button" aria-pressed={stake === value} disabled={balance !== null && value > balance} onClick={() => setStake(value)}>
                {value === 0 ? "Për nder" : `${value}`}
              </button>
            ))}
          </div>
          <p className="duel-pot">{stake ? <>Poti: <b>{fmtNum(stake * 2)} 383C</b> · ti vë {stake}</> : "Pa monedha: vetëm krenaria."}</p>
          {error && <p className="duel-error" role="alert">{error}</p>}
          <button type="button" className="duel-go" onClick={() => void send()} disabled={busy}>
            {busy ? "Duke dërguar…" : stake ? `Sfido · ${stake} 383C` : "Sfido"}
          </button>
        </>
      )}
    </div>
  );
}
