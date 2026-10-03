"use client";

// Under the cover: Dardani says good morning by name, and the name the paper
// carries is set here ("Si të thërras?") — also opened by tapping the cover's
// title.

import DardaniLoop from "@/components/dardani/dardani-loop";

/** Morning, afternoon or evening — by the clock in Kosovo, not the reader's. */
function greeting(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", hour: "numeric", hourCycle: "h23" }).format(now)
  );
  if (hour >= 4 && hour < 11) return "Mirëmëngjes";
  if (hour >= 11 && hour < 18) return "Mirëdita";
  return "Mirëmbrëma";
}

export default function Masthead({
  name,
  now,
  naming,
  setNaming,
  onRename,
}: {
  name: string;
  now: Date;
  naming: boolean;
  setNaming: (open: boolean) => void;
  onRename: (name: string) => void;
}) {
  return (
    <div className="perty-hello" data-print style={{ "--i": 1 } as React.CSSProperties}>
      <DardaniLoop name="greeting" alt="Dardani të përshëndet" className="perty-mast-dardani" />
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
          <p className="perty-ed-hello">
            {greeting(now)}
            {name ? `, ${name}` : ""}.
          </p>
          {!name && (
            <button type="button" className="perty-ed-ask-name" onClick={() => setNaming(true)}>
              Si të thërras? Gazeta merr emrin tënd
            </button>
          )}
        </div>
      )}
    </div>
  );
}
