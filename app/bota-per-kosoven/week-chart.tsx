// Seven days diverging from 50: above the line the world wrote more good than
// bad news about Kosovo, below it more bad. Colour is never the only encoding —
// every column prints its number and its day.

import { BAND, toneFill, toneLabel } from "@/lib/tone-scale";
import s from "./bota.module.css";

const DAY_NAMES = ["Die", "Hën", "Mar", "Mër", "Enj", "Pre", "Sht"];

export default function WeekChart({
  week,
  today,
}: {
  week: Array<{ date: string; index: number | null }>;
  today: string | null;
}) {
  const reach = (BAND.hi - BAND.lo) / 2;

  return (
    <ol className={s.weekGrid} aria-label="Indeksi i shtatë ditëve të fundit">
      {week.map(({ date, index }) => {
        const isToday = date === today;
        const name = isToday ? "Sot" : DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];
        const offset = index == null ? 0 : index - 50;
        const pct = Math.min(1, Math.abs(offset) / reach) * 100;
        const bar = index != null && (
          <span className={s.bar} style={{ height: `${Math.max(pct, 5)}%`, background: toneFill(index) }} />
        );
        const value = <span className={s.dayValue}>{index ?? "—"}</span>;

        return (
          <li
            key={date}
            className={s.day}
            data-today={isToday}
            data-empty={index == null}
            aria-label={
              index == null
                ? `${name}: pa të dhëna`
                : `${name}: ${index}, ${toneLabel(index)}`
            }
          >
            <span className={s.up} aria-hidden>
              {offset >= 0 ? <>{value}{bar}</> : null}
            </span>
            <span className={s.down} aria-hidden>
              {offset < 0 ? <>{bar}{value}</> : null}
            </span>
            <span className={s.dayName} aria-hidden>{name}</span>
          </li>
        );
      })}
    </ol>
  );
}
