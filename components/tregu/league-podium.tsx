import type { CSSProperties } from "react";
import { Crown } from "lucide-react";
import { fmtNum } from "@/lib/format";
import "./leagues.css";

export type PodiumSeat = {
  name: string | null;
  /** Already formatted: "140 pikë", "+340". */
  value?: string | null;
  prize?: number | null;
  isMe?: boolean;
};

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * First, second and third on steps, second on the left and third on the
 * right. Shared by a league's page and the Tregu leaderboard, so a podium
 * means the same thing wherever it appears. An empty seat still shows its
 * prize: the prize is the reason to want the seat.
 */
export default function LeaguePodium({ seats, label }: { seats: PodiumSeat[]; label: string }) {
  const order = [1, 0, 2];
  return (
    <div className="podium" role="list" aria-label={label}>
      {order.map((index, position) => {
        const seat = seats[index];
        const place = index + 1;
        const empty = !seat?.name;
        return (
          <div
            key={place}
            className="podium-seat"
            role="listitem"
            data-place={place}
            data-empty={empty || undefined}
            data-me={seat?.isMe || undefined}
            style={{ "--order": position } as CSSProperties}
            aria-label={empty ? `Vendi ${place}: i lirë` : `Vendi ${place}: ${seat!.name}${seat?.value ? `, ${seat.value}` : ""}`}
          >
            <span className="podium-avatar" aria-hidden>
              {place === 1 && !empty && <Crown className="podium-crown" size={18} strokeWidth={2.4} />}
              {empty ? "?" : first(seat!.name!).slice(0, 1).toUpperCase()}
            </span>
            <span className="podium-name">
              {empty ? "Vend i lirë" : first(seat!.name!)}
              {seat?.isMe && <em>TI</em>}
            </span>
            <span className="podium-value">{empty ? " " : seat?.value}</span>
            <div className="podium-step" aria-hidden>
              <b>{place}</b>
              {seat?.prize ? <small>{fmtNum(seat.prize)} 383C</small> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
