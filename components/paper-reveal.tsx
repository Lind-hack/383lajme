"use client";

// "Ta bëra gazetën": Dardani shows what he noticed the reader reads, as chips
// they can switch off, and opens the paper built from it in one tap.
//
// Two places use it: the end of an article, after the reader's third real read
// (components/paper-ready.tsx), and /per-ty itself, for a reader who arrives
// with reading behind them but has never set anything up — there it replaces
// the three questions, which stay one tap away.

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import DardaniFace from "@/components/dardani/dardani-face";
import { pickChips, withoutChips, type LearnedPicks } from "@/lib/perty-learned.mjs";

export default function PaperReveal({
  picks,
  reads,
  variant,
  onOpen,
  onSecondary,
  secondaryLabel,
}: {
  picks: LearnedPicks;
  reads: number;
  variant: "card" | "page";
  onOpen: (picks: LearnedPicks) => void;
  onSecondary: () => void;
  secondaryLabel: string;
}) {
  const chips = useMemo(() => pickChips(picks), [picks]);
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const kept = withoutChips(picks, off);
  const empty = kept.categories.length + kept.people.length + kept.cities.length === 0;
  const Heading = variant === "page" ? "h1" : "h2";

  return (
    <section className="paper-reveal" data-variant={variant} aria-labelledby="paper-reveal-title">
      <DardaniFace state="happy" size={variant === "page" ? 64 : 48} decorative className="paper-reveal-face" />
      <div className="paper-reveal-body">
        <p className="paper-reveal-eyebrow">Gazeta jote · nga Dardani</p>
        <Heading id="paper-reveal-title" className="paper-reveal-title">
          {reads >= 2 ? `Lexove ${reads} lajme. Ta bëra gazetën.` : "Ta bëra gazetën nga ajo që lexove."}
        </Heading>
        <p className="paper-reveal-lede">Më duket se të interesojnë këto. Hiqe çka s&apos;të duhet:</p>
        <ul className="paper-reveal-chips">
          {chips.map((chip) => {
            const on = !off.has(chip.key);
            return (
              <li key={chip.key}>
                <button
                  type="button"
                  className="paper-reveal-chip"
                  aria-pressed={on}
                  onClick={() =>
                    setOff((prev) => {
                      const next = new Set(prev);
                      if (on) next.add(chip.key);
                      else next.delete(chip.key);
                      return next;
                    })
                  }
                >
                  {chip.label}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="paper-reveal-actions">
          <button
            type="button"
            className="paper-reveal-open"
            disabled={empty}
            onClick={() => onOpen(kept)}
          >
            Hape gazetën time
            <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <button type="button" className="paper-reveal-secondary" onClick={onSecondary}>
            {secondaryLabel}
          </button>
        </div>
        <p className="paper-reveal-note">E di vetëm kjo pajisje. Asgjë nuk dërgohet askund.</p>
      </div>
    </section>
  );
}
