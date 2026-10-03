import type { CSSProperties } from "react";
import { Swords, Users } from "lucide-react";
import { crowdLine, rivalLine, type RivalPick, type Split } from "@/lib/tregu-pick-play.mjs";
import type { BoardRow } from "@/lib/tregu-leagues";

const FALLBACK = ["#2563EB", "#9CA3AF", "#DC2626", "#7C3AED", "#059669", "#D97706"];

/**
 * After a pick: how the league split (a bar per outcome, yours marked), a
 * line on where that leaves you in the crowd, and what your rival did. The
 * server only returns these once you've picked or the match has locked.
 */
export default function PickReveal({ row, split, rival }: { row: BoardRow; split: Split | null; rival: RivalPick | null }) {
  const options = row.options ?? [];
  const labelOf = (key: string) => options.find((option) => option.key === key)?.label ?? key;
  const mine = row.my_outcome;
  const crowd = split && mine ? crowdLine(split, mine, labelOf(mine)) : null;
  const versus = mine ? rivalLine(rival, mine, labelOf) : null;
  if (!mine || (!split?.total && !versus)) return null;

  return (
    <div className="pick-reveal">
      {split && split.total > 1 && (
        <>
          <div className="pick-split" role="img" aria-label={options.map((option) => `${option.label} ${split.by[option.key]?.pct ?? 0}%`).join(", ")}>
            {options.map((option, index) => {
              const pct = split.by[option.key]?.pct ?? 0;
              if (!pct) return null;
              return (
                <span
                  key={option.key}
                  data-mine={option.key === mine || undefined}
                  style={{ "--w": `${pct}%`, "--c": option.color || FALLBACK[index % FALLBACK.length] } as CSSProperties}
                >
                  {pct >= 14 ? `${pct}%` : ""}
                </span>
              );
            })}
          </div>
          {crowd && <p className="pick-crowd"><Users size={13} aria-hidden /> {crowd} <small>({split.total} në ligë)</small></p>}
        </>
      )}
      {versus && (
        <p className="pick-rival" data-tone={versus.tone}>
          <Swords size={13} aria-hidden /> {versus.text}
        </p>
      )}
    </div>
  );
}
