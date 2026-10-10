// Bota për Kosovën's signature: the country's name the way the world's press
// writes it, running past like a wire-service dateline. It says what the
// feature is before a word is read — this is about how others name and see us.
//
// Decorative (the heading says the same in words), so it is hidden from
// assistive tech. The run is printed twice so the loop has no seam; with
// reduced motion it simply stands still.

import s from "./world-dateline.module.css";

const NAMES = [
  "Kosova",
  "Kosovo",
  "Косово",
  "Kosowo",
  "Κόσοβο",
  "Koszovó",
  "Kosova",
  "كوسوفو",
  "科索沃",
  "コソボ",
  "קוסובו",
  "कोसोवो",
  "Kosovë",
];

export default function WorldDateline({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const run = (
    <span className={s.run}>
      {NAMES.map((name, i) => (
        <span key={i} className={s.name} data-home={name === "Kosovë" || undefined}>
          {name}
        </span>
      ))}
    </span>
  );
  return (
    <div className={s.dateline} data-tone={tone} aria-hidden="true">
      <div className={s.track}>
        {run}
        {run}
      </div>
    </div>
  );
}
