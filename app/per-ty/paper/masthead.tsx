"use client";

// The top of the reader's paper, laid out like a newspaper's:
//
//   [Dardani]   GAZETA E LINDIT                        [share] [rregullo]
//   ─────────────────────────────────────────────────────────────────────
//   Nr. 12 · e shtunë, 3 tetor · 7 lajme · rreth 2 min
//   Mirëmëngjes, Lind.
//
// The nameplate is the reader's own: tapping it (or "Si të thërras?") asks
// for their name. Without a name it reads "Gazeta jote".

import { useState } from "react";
import { Share2, SlidersHorizontal } from "lucide-react";
import DardaniLoop from "@/components/dardani/dardani-loop";
import { paperName } from "@/lib/reader-name.mjs";

/** Morning, afternoon or evening — by the clock in Kosovo, not the reader's. */
function greeting(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", hour: "numeric", hourCycle: "h23" }).format(now)
  );
  if (hour >= 4 && hour < 11) return "Mirëmëngjes";
  if (hour >= 11 && hour < 18) return "Mirëdita";
  return "Mirëmbrëma";
}

const WEEKDAYS = ["e diel", "e hënë", "e martë", "e mërkurë", "e enjte", "e premte", "e shtunë"];
const MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];

/**
 * "e martë, 30 shtator", by the Kosovo calendar. Spelled out rather than left to
 * Intl's "sq" locale, which some browsers ship without and fall back to English.
 */
export function dateline(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Belgrade",
      weekday: "short",
      day: "numeric",
      month: "numeric",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return `${WEEKDAYS[weekday] ?? ""}, ${parts.day} ${MONTHS[Number(parts.month) - 1] ?? ""}`;
}

export default function Masthead({
  name,
  issue,
  now,
  count,
  minutes,
  onRename,
  onCustomize,
  onShare,
}: {
  name: string;
  issue: number;
  now: Date;
  count: number;
  minutes: number;
  onRename: (name: string) => void;
  onCustomize: () => void;
  onShare: (() => void) | null;
}) {
  const [naming, setNaming] = useState(false);
  return (
    <header className="perty-mast" data-print style={{ "--i": 0 } as React.CSSProperties}>
      <div className="perty-mast-plate">
        <DardaniLoop name="greeting" alt="Dardani të përshëndet" className="perty-mast-dardani" />
        <button
          type="button"
          className="perty-mast-name"
          onClick={() => setNaming(true)}
          aria-label={name ? `${paperName(name)}. Ndrysho emrin` : "Gazeta jote. Vendos emrin tënd"}
        >
          {paperName(name)}
        </button>
        <div className="perty-mast-actions">
          {onShare && (
            <button type="button" className="perty-mast-btn perty-mast-btn--share" onClick={onShare}>
              <Share2 size={17} strokeWidth={2.4} aria-hidden="true" />
              <span>Ndaje</span>
            </button>
          )}
          <button type="button" className="perty-mast-btn" onClick={onCustomize} aria-label="Rregullo gazetën">
            <SlidersHorizontal size={17} strokeWidth={2.4} aria-hidden="true" />
            <span>Rregullo</span>
          </button>
        </div>
      </div>

      <p className="perty-mast-folio">
        {issue > 0 && <span className="perty-mast-issue">Nr. {issue}</span>}
        <span className="perty-mast-date">{dateline(now)}</span>
        {count > 0 && (
          <span>
            {count} {count === 1 ? "lajm" : "lajme"} · rreth {minutes} min
          </span>
        )}
      </p>

      {naming ? (
        <form
          className="perty-ed-name-form"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("name");
            onRename(typeof value === "string" ? value : "");
            setNaming(false);
          }}
        >
          <label htmlFor="perty-name">Si të thërras?</label>
          <input
            id="perty-name"
            name="name"
            defaultValue={name}
            autoComplete="given-name"
            maxLength={24}
            placeholder="Emri yt"
            autoFocus
          />
          <button type="submit" className="perty-btn perty-btn--primary">
            Ruaj
          </button>
          <button type="button" className="perty-text-btn" onClick={() => setNaming(false)}>
            Anulo
          </button>
        </form>
      ) : (
        <div className="perty-mast-hello">
          <h1 className="perty-ed-hello">
            {greeting(now)}
            {name ? `, ${name}` : ""}.
          </h1>
          {!name && (
            <button type="button" className="perty-ed-ask-name" onClick={() => setNaming(true)}>
              Si të thërras?
            </button>
          )}
        </div>
      )}
    </header>
  );
}
