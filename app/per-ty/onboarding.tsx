"use client";

// Three short questions that turn 383 into the reader's own paper, with
// Dardani asking them.
//
//   Mirë se vjen            Dardani waves hello (first run only)
//   1. Çfarë të intereson?  categories — the one required step
//   2. Kë ndjek?            people, from a curated list or search
//   3. Nga je?              the reader's own city, then any others they want
//                           local news from
//   Po e ndërtoj…           Dardani reads while the feed is put together
//   Gati!                   the first three stories, then the feed
//
// The answer is shown while the question is asked: the footer counts how many
// of today's stories the current picks would bring, so the reader sees the
// feed forming before they reach it. No account is asked for here — the feed
// arrives first, and signing in is offered after, as a convenience.
//
// Reopened from the feed ("Ndrysho interesat") it is just the three questions:
// no hello, no build, straight back to the feed.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Search, X } from "lucide-react";
import { NAV_CATEGORIES } from "@/lib/category-map";
import { getCategoryColor } from "@/lib/category-colors";
import { toggleValue, type Interests } from "@/lib/interests.mjs";
import { PEOPLE, PEOPLE_GROUPS, derivedPersonId, personById } from "@/lib/people.mjs";
import { CITIES, cityById } from "@/lib/cities.mjs";
import { countMatches, rankFeed } from "@/lib/per-ty-rank.mjs";
import { extractPeople } from "@/lib/entities.mjs";
import { DARDANI_LOOPS, DARDANI_STILLS, type DardaniLoopName } from "@/lib/dardani-assets";
import DardaniImage from "@/components/dardani/dardani-image";
import DardaniLoop from "@/components/dardani/dardani-loop";
import TimeAgo from "@/components/time-ago";
import type { FeedArticle } from "./per-ty-feed";

const STEPS: ReadonlyArray<{ title: string; lede: string; loop: DardaniLoopName }> = [
  {
    title: "Çfarë të intereson?",
    lede: "Zgjidh të paktën një temë. Mund t'i ndryshosh kurdo.",
    loop: "explaining",
  },
  {
    title: "Kë ndjek?",
    lede: "Kur përmenden në lajme, ata dalin të parët te ti.",
    loop: "researching",
  },
  {
    title: "Nga je?",
    lede: "Zgjidh qytetin tënd. Lajmet prej andej dalin të parat.",
    loop: "explaining-news",
  },
];

/** What Dardani says when a topic is picked. */
const TOPIC_SAY: Record<string, string> = {
  Kosovë: "Kosova e para. Gjithmonë.",
  Shqipëri: "Nga Tirana në Sarandë — do t’i kesh të gjitha.",
  Sport: "Kombëtarja, Muriqi, Kelmendi — asnjë gol s’të ikën.",
  Teknologji: "AI, telefona, startup-e. Do ta dish i pari.",
  Ekonomi: "Çmimet, pagat, biznesi — pa zhargon.",
  Botë: "Bota, por gjithmonë si ndikon te ne.",
  Showbiz: "Dua, Rita, Bebe… e di pse je këtu.",
};

/** How long Dardani "builds" the feed before showing it. */
const BUILD_MS = 3600;

type Phase = "hello" | "steps" | "building" | "done";

/** Case- and diacritic-insensitive, so "ceku" finds "Çeku". */
function fold(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** "a", "a dhe b", "a, b dhe c", "a, b, c e të tjerë". */
function list(items: string[]) {
  if (items.length <= 1) return items.join("");
  if (items.length > 3) return `${items.slice(0, 3).join(", ")} e të tjerë`;
  return `${items.slice(0, -1).join(", ")} dhe ${items[items.length - 1]}`;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
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
  onDone: (picks: Pick<Interests, "categories" | "people" | "cities" | "home">) => void;
  onCancel?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(editing ? "steps" : "hello");
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<string[]>(initial.categories);
  const [people, setPeople] = useState<string[]>(initial.people);
  // The reader's own city, and the others they want local news from. Stored
  // together (home is always one of `cities`), held apart here.
  const [home, setHome] = useState<string | null>(initial.home ?? null);
  const [extraCities, setExtraCities] = useState<string[]>(
    (initial.cities ?? []).filter((id) => id !== initial.home)
  );
  const cities = useMemo(() => (home ? [home, ...extraCities] : extraCities), [home, extraCities]);
  const [query, setQuery] = useState("");
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // People from the sections the reader just picked come first.
  const groupsInOrder = useMemo(() => {
    const picked = new Set(categories);
    return [...PEOPLE_GROUPS]
      .map((group, i) => ({ group, i, suggested: picked.has(group) }))
      .sort((a, b) => Number(b.suggested) - Number(a.suggested) || a.i - b.i);
  }, [categories]);

  // A new question starts at its top. On a phone the reader has scrolled down a
  // long list to reach Vazhdo; without this the next question opens wherever
  // that list ended. Focus then moves to the heading, so keyboard and
  // screen-reader users land on it instead of on a button that no longer means
  // the same thing.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const section = sectionRef.current;
    if (section) {
      const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 64;
      const top = section.getBoundingClientRect().top + window.scrollY - nav - 12;
      if (window.scrollY > top) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
      }
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [step, phase]);

  // Every Dardani the next screens will need, fetched while the reader is on
  // this one, so each hops in already loaded instead of popping in late.
  useEffect(() => {
    const loops: DardaniLoopName[] = [...STEPS.map((s) => s.loop), "reading"];
    for (const name of loops) {
      const clip = DARDANI_LOOPS[name];
      void fetch(clip.stack).catch(() => {});
      const img = new window.Image();
      img.src = clip.poster;
    }
    const done = new window.Image();
    done.src = DARDANI_STILLS.celebrating.src;
  }, []);

  // The build screen moves on by itself; the reader has nothing to do there.
  useEffect(() => {
    if (phase !== "building") return;
    const timer = window.setTimeout(() => setPhase("done"), BUILD_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const draft = useMemo(
    () => ({ v: 1, categories, people, cities, home, topics: [], affinity: {} }),
    [categories, people, cities, home]
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
    const matches = [...listed, ...found].slice(0, 5);
    // "Tjetër": anyone else, by first and last name, straight from the same box.
    const typed = query.trim().replace(/\s+/g, " ");
    const own = derivedPersonId(typed);
    const exact = matches.some((m) => fold(m.name) === fold(typed));
    if (!exact && personById(own)) matches.push({ id: own, name: typed, note: "Shto si emër tjetër" });
    return matches;
  }, [query, newsPeople]);

  // Followed names that are not on the curated list still need a chip.
  const extraPeople = people
    .filter((id) => !PEOPLE.some((p) => p.id === id))
    .map((id) => personById(id))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const personNames = people.map((id) => personById(id)?.name).filter((n): n is string => Boolean(n));
  const cityNames = cities.map((id) => cityById(id)?.name).filter((n): n is string => Boolean(n));
  const homeCity = cityById(home);

  // What Dardani says over each question, reacting to the last pick.
  const say = (() => {
    if (step === 0) {
      const last = categories[categories.length - 1];
      return (last && TOPIC_SAY[last]) || "Çfarë të bën kurioz? Zgjidh sa të duash.";
    }
    if (step === 1) {
      const last = personNames[personNames.length - 1];
      return last
        ? `${last}, e shënova! Asnjë lajm për të s’të ikën.`
        : "Sa herë që përmenden në lajme, t’i sjell të parët.";
    }
    const lastExtra = cityById(extraCities[extraCities.length - 1])?.name;
    if (lastExtra) return `Edhe ${lastExtra}. Do t’i kesh edhe lajmet prej andej.`;
    return homeCity
      ? `${homeCity.name}! Lajmet prej andej dalin të parat.`
      : "Nga je? Lajmet e qytetit tënd i nxjerr të parat.";
  })();

  const canContinue = step !== 0 || categories.length > 0;
  const last = step === STEPS.length - 1;
  const picks = { categories: categories as Interests["categories"], people, cities, home };

  function next() {
    if (!canContinue) return;
    if (!last) setStep((s) => s + 1);
    else if (editing) onDone(picks);
    else setPhase("building");
  }

  if (phase === "hello") {
    return (
      <section className="perty-onboard perty-hello" aria-labelledby="perty-onboard-title">
        <div className="perty-hello-stage">
          <p className="perty-say perty-say--up">Tung! Unë jam Dardani.</p>
          <DardaniLoop name="greeting" alt="Dardani, maskota e 383, përshëndet me krah" className="perty-hello-loop" />
        </div>
        <div className="perty-hello-copy">
          <h1 id="perty-onboard-title" ref={headingRef} tabIndex={-1} className="perty-hello-title">
            Vetëm lajmet që të interesojnë <span>ty</span>.
          </h1>
          <p className="perty-hello-lede">
            Përgjigju 3 pyetjeve të shpejta dhe unë ta ndërtoj faqen tënde «Për ty». Zgjat më pak se një minutë.
          </p>
          <div className="perty-hello-actions">
            <button type="button" className="perty-btn perty-btn--primary perty-btn--big" onClick={() => setPhase("steps")}>
              Fillojmë
            </button>
            <Link href="/" className="perty-btn perty-btn--ghost perty-btn--big">
              Më vonë
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (phase === "building") {
    const lines = [
      "Po lexoj lajmet e sotme nga të gjitha burimet",
      ...(categories.length ? [`Po filtroj për ${list(categories)}`] : []),
      ...(personNames.length ? [`Po kërkoj ${list(personNames)}`] : []),
      ...(cityNames.length ? [`Po ngre lart lajmet lokale: ${list(cityNames)}`] : []),
      "Po i rendit sipas rëndësisë",
    ];
    return (
      <section className="perty-onboard perty-build" aria-labelledby="perty-onboard-title">
        <DardaniLoop name="reading" alt="Dardani lexon lajmet e sotme" className="perty-build-loop" />
        <div className="perty-hello-copy">
        <h1 id="perty-onboard-title" ref={headingRef} tabIndex={-1} className="perty-onboard-title">
          Po e ndërtoj faqen tënde…
        </h1>
        <p className="perty-onboard-lede">Dardani po lexon lajmet e sotme për ty.</p>
        <div className="perty-build-bar" role="progressbar" aria-label="Po ndërtohet faqja">
          <i style={{ animationDuration: `${BUILD_MS}ms` }} />
        </div>
        <ul className="perty-build-lines">
          {lines.map((line, i) => (
            <li key={line} style={{ "--i": i } as React.CSSProperties}>
              <span className="perty-build-check" aria-hidden="true">
                <Check size={12} strokeWidth={3.4} />
              </span>
              {line}
            </li>
          ))}
        </ul>
        </div>
      </section>
    );
  }

  if (phase === "done") {
    const preview = rankFeed(pool, draft, { limit: 3, topCount: 0 });
    return (
      <section className="perty-onboard perty-done" aria-labelledby="perty-onboard-title">
        <div className="perty-confetti" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>
        <DardaniImage name="celebrating" alt="Dardani feston me të dy krahët lart" className="perty-done-img" priority />
        <div className="perty-hello-copy">
        <h1 id="perty-onboard-title" ref={headingRef} tabIndex={-1} className="perty-done-title">
          Urime! Faqja jote është gati.
        </h1>
        <p className="perty-onboard-lede">
          {plural(categories.length, "temë", "tema")} · {plural(people.length, "emër", "emra")} ·{" "}
          {plural(cities.length, "qytet", "qytete")} — mund t’i ndryshosh kurdo.
        </p>
        {preview.length > 0 && (
          <ul className="perty-done-preview">
            {preview.map(({ article, reason }, i) => (
              <li key={article.slug} style={{ "--i": i } as React.CSSProperties}>
                <span className="perty-reason">{reason}</span>
                <strong>{article.title}</strong>
                <small>
                  {article.category} · <TimeAgo iso={article.publishedAt} />
                  {article.source ? ` · ${article.source}` : ""}
                </small>
              </li>
            ))}
          </ul>
        )}
        <div className="perty-hello-actions">
          <button type="button" className="perty-btn perty-btn--primary perty-btn--big" onClick={() => onDone(picks)}>
            Hap faqen time
          </button>
          <button
            type="button"
            className="perty-btn perty-btn--ghost perty-btn--big"
            onClick={() => {
              setStep(0);
              setPhase("steps");
            }}
          >
            Ndrysho zgjedhjet
          </button>
        </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="perty-onboard perty-onboard--steps" aria-labelledby="perty-onboard-title">
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

      <div className="perty-dardani">
        <DardaniLoop name={STEPS[step].loop} decorative className="perty-dardani-loop" />
        {/* Keyed on the line, so each new thing he says eases in. */}
        <p key={say} className="perty-say perty-say--line" aria-live="polite">
          {say}
        </p>
      </div>

      <h1 id="perty-onboard-title" ref={headingRef} tabIndex={-1} className="perty-onboard-title">
        {STEPS[step].title}
      </h1>
      <p className="perty-onboard-lede">{STEPS[step].lede}</p>

      {/* Keyed on the step, so each step's options glide in. */}
      <div key={step} className="perty-onboard-choices">
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
              placeholder="Kërko ose shto një emër…"
              aria-label="Kërko ose shto një person"
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
            <p className="perty-hint">Shkruaj emrin dhe mbiemrin për ta shtuar.</p>
          )}

          {groupsInOrder.map(({ group, suggested }) => (
            <div key={group} className="perty-group">
              <h2>
                {group}
                {suggested && <span className="perty-group-tag">Sugjeruar për ty</span>}
              </h2>
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
        <div className="perty-cities">
          {/* One home city: picking another moves the mark, picking it again clears it. */}
          <div className="perty-chips perty-chips--cities" role="group" aria-label="Qyteti yt">
            {CITIES.map((c) => (
              <Chip
                key={c.id}
                on={home === c.id}
                onClick={() => {
                  setHome((prev) => (prev === c.id ? null : c.id));
                  setExtraCities((prev) => prev.filter((id) => id !== c.id));
                }}
              >
                {c.name}
              </Chip>
            ))}
          </div>

          <div className="perty-group">
            <h2 id="perty-extra-cities">Për cilat qytete të tjera do lajme?</h2>
            <p className="perty-hint">Opsionale. Zgjidh sa të duash.</p>
            <div className="perty-chips perty-chips--cities" role="group" aria-labelledby="perty-extra-cities">
              {CITIES.filter((c) => c.id !== home).map((c) => (
                <Chip
                  key={c.id}
                  on={extraCities.includes(c.id)}
                  onClick={() => setExtraCities((prev) => toggleValue(prev, c.id))}
                >
                  {c.name}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>

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
