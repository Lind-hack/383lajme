"use client";

// Three short questions that turn 383 into the reader's own paper.
//
//   1. Çfarë të intereson?  categories — the one required step
//   2. Kë ndjek?            people, from a curated list or search
//   3. Nga je?              a city, for local news
//
// The answer is shown while the question is asked: the footer counts how many
// of today's stories the current picks would bring, so the reader sees the
// feed forming before they reach it. No account is asked for here — the feed
// arrives first, and signing in is offered after, as a convenience.

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Search, X } from "lucide-react";
import { NAV_CATEGORIES } from "@/lib/category-map";
import { getCategoryColor } from "@/lib/category-colors";
import { toggleValue, type Interests } from "@/lib/interests.mjs";
import { PEOPLE, PEOPLE_GROUPS, derivedPersonId, personById } from "@/lib/people.mjs";
import { CITIES } from "@/lib/cities.mjs";
import { countMatches } from "@/lib/per-ty-rank.mjs";
import { extractPeople } from "@/lib/entities.mjs";
import type { FeedArticle } from "./per-ty-feed";

const STEPS = [
  {
    title: "Çfarë të intereson?",
    lede: "Zgjidh të paktën një temë. Mund t'i ndryshosh kurdo.",
  },
  {
    title: "Kë ndjek?",
    lede: "Kur përmenden në lajme, ata dalin të parët te ti.",
  },
  {
    title: "Nga je?",
    lede: "Lajmet nga qyteti yt ngrihen lart. Zgjidh një ose më shumë.",
  },
] as const;

/** Case- and diacritic-insensitive, so "ceku" finds "Çeku". */
function fold(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export default function Onboarding({
  pool,
  initial,
  editing = false,
  onDone,
  onCancel,
}: {
  pool: FeedArticle[];
  initial: Interests;
  /** Reopened from the feed: pre-filled, and closable without finishing. */
  editing?: boolean;
  onDone: (picks: Pick<Interests, "categories" | "people" | "cities">) => void;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<string[]>(initial.categories);
  const [people, setPeople] = useState<string[]>(initial.people);
  const [cities, setCities] = useState<string[]>(initial.cities);
  const [query, setQuery] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the new question, so keyboard and screen-reader users land
  // on it instead of on a button that no longer means the same thing.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const draft = useMemo(
    () => ({ v: 1, categories, people, cities, topics: [], affinity: {} }),
    [categories, people, cities]
  );
  const matchCount = useMemo(() => countMatches(pool, draft), [pool, draft]);

  // "N sot" on a tile has to mean today: only the last 24 hours count. (This
  // component renders after mount, so the reader's clock is available.)
  const todayByCategory = useMemo(() => {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const counts: Record<string, number> = {};
    for (const a of pool) {
      if (Date.parse(a.publishedAt) >= since) counts[a.category] = (counts[a.category] ?? 0) + 1;
    }
    return counts;
  }, [pool]);

  // Names in today's news that are not on the curated list, for search.
  const newsPeople = useMemo(() => {
    const listed = new Set(PEOPLE.map((p) => fold(p.name)));
    return extractPeople(
      pool.map((a) => ({ title: a.title, body: a.excerpt })),
      { minMentions: 2 }
    )
      .map((p) => p.name)
      .filter((name) => name.split(/\s+/).length >= 2 && !listed.has(fold(name)));
  }, [pool]);

  const suggestions = useMemo(() => {
    const q = fold(query);
    if (q.length < 2) return [];
    const listed = PEOPLE.filter((p) => fold(p.name).includes(q)).map((p) => ({
      id: p.id,
      name: p.name,
      note: p.group,
    }));
    const found = newsPeople
      .filter((name) => fold(name).includes(q))
      .map((name) => ({ id: derivedPersonId(name), name, note: "Në lajmet e sotme" }));
    return [...listed, ...found].slice(0, 6);
  }, [query, newsPeople]);

  // Followed names that are not on the curated list still need a chip.
  const extraPeople = people
    .filter((id) => !PEOPLE.some((p) => p.id === id))
    .map((id) => personById(id))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const canContinue = step !== 0 || categories.length > 0;
  const last = step === STEPS.length - 1;

  function next() {
    if (!canContinue) return;
    if (last) onDone({ categories: categories as Interests["categories"], people, cities });
    else setStep((s) => s + 1);
  }

  return (
    <section className="perty-onboard" aria-labelledby="perty-onboard-title">
      <header className="perty-onboard-top">
        <div className="perty-steps" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} data-state={i < step ? "done" : i === step ? "now" : undefined} />
          ))}
        </div>
        <span className="perty-step-count">
          Hapi {step + 1} nga {STEPS.length}
        </span>
        {editing && onCancel && (
          <button type="button" className="perty-icon-btn" onClick={onCancel} aria-label="Mbyll pa ruajtur">
            <X size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}
      </header>

      <h1 id="perty-onboard-title" ref={headingRef} tabIndex={-1} className="perty-onboard-title">
        {STEPS[step].title}
      </h1>
      <p className="perty-onboard-lede">{STEPS[step].lede}</p>

      {step === 0 && (
        <div className="perty-tiles" role="group" aria-label="Temat">
          {NAV_CATEGORIES.map((cat) => {
            const on = categories.includes(cat.label);
            const n = todayByCategory[cat.label] ?? 0;
            return (
              <button
                key={cat.slug}
                type="button"
                className="perty-tile"
                aria-pressed={on}
                onClick={() => setCategories((prev) => toggleValue(prev, cat.label))}
                style={{ ["--cat" as string]: getCategoryColor(cat.label) }}
              >
                <span className="perty-tile-dot" aria-hidden="true" />
                <span className="perty-tile-name">{cat.label}</span>
                <span className="perty-tile-count">{n > 0 ? `${n} sot` : "—"}</span>
                <span className="perty-tile-check" aria-hidden="true">
                  <Check size={14} strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {step === 1 && (
        <div className="perty-people">
          <label className="perty-search">
            <Search size={17} strokeWidth={2.3} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kërko një emër…"
              aria-label="Kërko një person"
              autoComplete="off"
            />
          </label>

          {suggestions.length > 0 && (
            <ul className="perty-suggest" aria-label="Rezultatet">
              {suggestions.map((s) => {
                const on = people.includes(s.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setPeople((prev) => toggleValue(prev, s.id));
                        setQuery("");
                      }}
                    >
                      <strong>{s.name}</strong>
                      <span>{s.note}</span>
                      {on && <Check size={15} strokeWidth={3} aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {fold(query).length >= 2 && suggestions.length === 0 && (
            <p className="perty-hint">Asnjë emër i tillë në listë apo në lajmet e sotme.</p>
          )}

          {PEOPLE_GROUPS.map((group) => (
            <div key={group} className="perty-group">
              <h2>{group}</h2>
              <div className="perty-chips" role="group" aria-label={group}>
                {PEOPLE.filter((p) => p.group === group).map((p) => (
                  <Chip key={p.id} on={people.includes(p.id)} onClick={() => setPeople((prev) => toggleValue(prev, p.id))}>
                    {p.name}
                  </Chip>
                ))}
              </div>
            </div>
          ))}

          {extraPeople.length > 0 && (
            <div className="perty-group">
              <h2>Të tjerë që ndjek</h2>
              <div className="perty-chips" role="group" aria-label="Të tjerë">
                {extraPeople.map((p) => (
                  <Chip key={p.id} on onClick={() => setPeople((prev) => toggleValue(prev, p.id))}>
                    {p.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="perty-chips perty-chips--cities" role="group" aria-label="Qytetet">
          {CITIES.map((c) => (
            <Chip key={c.id} on={cities.includes(c.id)} onClick={() => setCities((prev) => toggleValue(prev, c.id))}>
              {c.name}
            </Chip>
          ))}
        </div>
      )}

      <footer className="perty-onboard-foot">
        <p className="perty-preview" aria-live="polite">
          {categories.length + people.length + cities.length === 0 ? (
            "Zgjidh diçka për të parë lajmet e tua."
          ) : (
            <>
              <b>{matchCount}</b> {matchCount === 1 ? "lajm i fundit" : "lajme të fundit"} për ty
            </>
          )}
        </p>

        <div className="perty-foot-actions">
          {step > 0 && (
            <button type="button" className="perty-btn perty-btn--ghost" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft size={16} strokeWidth={2.4} aria-hidden="true" />
              Prapa
            </button>
          )}
          {step > 0 && !last && (
            <button type="button" className="perty-btn perty-btn--ghost" onClick={() => setStep((s) => s + 1)}>
              Kalo
            </button>
          )}
          <button
            type="button"
            className="perty-btn perty-btn--primary"
            onClick={next}
            disabled={!canContinue}
          >
            {last ? (editing ? "Ruaj ndryshimet" : "Shiko lajmet e mia") : "Vazhdo"}
            <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </footer>
    </section>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="perty-chip" aria-pressed={on} onClick={onClick}>
      {on && <Check size={14} strokeWidth={3} aria-hidden="true" />}
      {children}
    </button>
  );
}
