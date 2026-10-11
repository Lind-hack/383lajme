// Seven days on the full 0–100 scale: each bar rises from 0 to the day's index,
// so the top of the column is 100 (not 70) and 57 fills 57% of it. A dashed
// line marks 50, the balance point: above it the world wrote more good than bad
// about Kosovo. Colour is never the only encoding — every column prints its
// number and its day.

import { scalePosition, toneFill, toneLabel } from "@/lib/tone-scale";
import s from "./bota.module.css";

const DAY_NAMES = ["Die", "Hën", "Mar", "Mër", "Enj", "Pre", "Sht"];

export default function WeekChart({
  week,
  today,
}: {
  week: Array<{ date: string; index: number | null }>;
  today: string | null;
}) {
  return (
    <div className={s.weekChart}>
      <div className={s.weekAxis} aria-hidden>
        <span>100</span>
        <span>50</span>
        <span>0</span>
      </div>
      <ol className={s.weekGrid} aria-label="Indeksi i shtatë ditëve të fundit, nga 0 te 100">
        {week.map(({ date, index }) => {
          const isToday = date === today;
          const name = isToday ? "Sot" : DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];
          return (
            <li
              key={date}
              className={s.day}
              data-today={isToday}
              data-empty={index == null}
              aria-label={index == null ? `${name}: pa të dhëna` : `${name}: ${index} nga 100, ${toneLabel(index)}`}
            >
              <span className={s.column} aria-hidden>
                <span className={s.dayValue}>{index ?? "—"}</span>
                {index != null && (
                  <span
                    className={s.bar}
                    style={{ height: `calc(var(--col) * ${Math.max(scalePosition(index), 0.02)})`, background: toneFill(index) }}
                  />
                )}
              </span>
              <span className={s.dayName} aria-hidden>{name}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
