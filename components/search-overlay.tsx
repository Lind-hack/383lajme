"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AskPanel, { type AskStatus, type Chip } from "@/components/ask-panel";
import DardaniFace from "@/components/dardani/dardani-face";
import DardaniImage from "@/components/dardani/dardani-image";
import DardaniLoop from "@/components/dardani/dardani-loop";
import { personalStarters } from "@/lib/dardani-memory.mjs";
import { readMemory } from "@/lib/dardani-memory-store";
import { readInterests } from "@/lib/interests.mjs";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowUpRight,
  Clock,
  Flame,
  Minus,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { track } from "@/lib/analytics";
import Highlight, { highlightTerms } from "@/components/search-highlight";

type Item = { title: string; href: string; meta?: string; kind: string; image?: string };
type TrendLink = { title: string; href: string };

/** The reader's own last searches, on this device only. */
const RECENT_KEY = "383-kerko-recent";
const RECENT_MAX = 6;

function readRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((q): q is string => typeof q === "string" && q.trim().length >= 2) : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    // Private mode or full storage: recents are a convenience.
  }
}

/** The query moved to the front, case-insensitively de-duplicated. */
function remember(query: string): string[] {
  const q = query.trim();
  const list = [q, ...readRecent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX);
  writeRecent(list);
  return list;
}

/**
 * One result row. Articles carry their photo, so a reader can tell two
 * similar headlines apart at a glance; destinations (a topic, a country, a
 * city) stay text-only, because they have no photograph of their own.
 */
function Row({
  item,
  active,
  terms,
  onHover,
  onPick,
}: {
  item: Item;
  active: boolean;
  terms: readonly string[];
  onHover: () => void;
  onPick: () => void;
}) {
  const article = item.kind === "artikull";
  return (
    <button
      type="button"
      className={article ? "kerko-row kerko-row-article" : "kerko-row"}
      data-active={active ? "true" : undefined}
      onMouseEnter={onHover}
      onClick={onPick}
    >
      {article && (
        <span className="kerko-thumb" aria-hidden="true">
          {item.image && <Image src={item.image} alt="" fill sizes="64px" />}
        </span>
      )}
      <span className="kerko-row-text">
        <span className="kerko-title">
          <Highlight text={item.title} terms={terms} />
        </span>
        {item.meta && <span className="kerko-meta">{item.meta}</span>}
      </span>
    </button>
  );
}
type Group = { kind: string; label: string; items: Item[] };

type CountryFacts = {
  index: number | null;
  delta: number | null;
  articles: number;
  foreign: { title: string; url: string; outlet: string; sentiment: string }[];
};

type Entity = {
  name: string;
  kind: string;
  role: string | null;
  href: string;
  facts?: CountryFacts | null;
  articles: Item[];
  total: number;
};

/**
 * The tone index, and which way it moved.
 *
 * Rendered as a number with a direction rather than a chart: at this size the
 * only questions are "where does it stand" and "is it getting better", and a
 * sparkline answers neither at a glance.
 */
function ToneReading({ name, facts }: { name: string; facts: CountryFacts }) {
  if (facts.index === null) return null;
  const dir = facts.delta === null || facts.delta === 0 ? "flat" : facts.delta > 0 ? "up" : "down";
  const Icon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;
  return (
    <div className="kerko-tone" data-dir={dir}>
      <span className="kerko-tone-caption">Toni i medias · {name}</span>
      <span className="kerko-tone-value">{facts.index}</span>
      <span className="kerko-tone-delta">
        <Icon size={13} strokeWidth={2.75} aria-hidden="true" />
        {facts.delta === null
          ? "pa krahasim"
          : facts.delta === 0
            ? "pa ndryshim"
            : `${facts.delta > 0 ? "+" : ""}${facts.delta}`}
      </span>
      <span className="kerko-tone-n">{facts.articles} artikuj</span>
    </div>
  );
}

type Payload = {
  query: string;
  entity?: Entity | null;
  groups: Group[];
  suggestions: Item[];
  isQuestion: boolean;
  count?: number;
  tooShort?: boolean;
};

/** Long enough that a fast typist issues one request per word, not per letter. */
const DEBOUNCE_MS = 180;

const EMPTY: Payload = {
  query: "",
  entity: null,
  groups: [],
  suggestions: [],
  isQuestion: false,
};

/** The full results page for a query. */
function resultsHref(query: string) {
  return `/kerko?q=${encodeURIComponent(query.trim())}`;
}

export default function SearchOverlay({
  open,
  onClose,
  initialMode = "kerko",
  seedQuestion = "",
  seedNonce = 0,
}: {
  open: boolean;
  onClose: () => void;
  /**
   * What the overlay is. Search and Pyet used to be two tabs of one dialog;
   * they are two doors now — the search button opens search, the Pyet
   * Dardanin pill opens Pyet — so neither shows the other's controls.
   */
  initialMode?: "kerko" | "pyet";
  /** A question to ask as Pyet opens (from a "Pyet Dardanin" button elsewhere). */
  seedQuestion?: string;
  seedNonce?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const mode = initialMode;
  // Enter opens the highlighted result only once the reader has chosen one
  // with the arrow keys; otherwise it opens the full results page.
  const [picked, setPicked] = useState(false);
  const [data, setData] = useState<Payload>(EMPTY);
  const [starters, setStarters] = useState<Chip[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  // Pyet mode: the face beside "Pyet Dardanin" follows the conversation.
  const [ask, setAsk] = useState<AskStatus | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [trending, setTrending] = useState<TrendLink[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  // Flat list of everything selectable, so the arrow keys can walk across
  // group boundaries without the caller knowing the grouping.
  const flat = useMemo(
    () => [...(data.entity?.articles ?? []), ...data.groups.flatMap((g) => g.items)],
    [data.entity, data.groups],
  );

  useEffect(() => {
    if (!open) return;
    // Focus after paint: focusing during the same frame the dialog mounts is
    // ignored by Safari, which leaves the overlay open and untypeable.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // The page behind must not scroll while a full-screen layer is over it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Before the reader types: their last searches and who the news is about.
  useEffect(() => {
    if (!open || mode !== "kerko") return;
    setRecent(readRecent());
    if (trending.length > 0) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/search/trending");
        const payload = await res.json();
        if (alive && Array.isArray(payload?.trending)) {
          setTrending(
            payload.trending.filter(
              (t: TrendLink) => typeof t?.title === "string" && typeof t?.href === "string",
            ),
          );
        }
      } catch {
        // The hint text stands in when there is nothing to suggest.
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, mode, trending.length]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setData(EMPTY);
      setActive(0);
      setPicked(false);
    }
  }, [open]);

  // A new query starts from nothing chosen.
  useEffect(() => setPicked(false), [query]);

  // Debounced fetch. The abort matters: without it a slow early request can
  // land after a fast later one and overwrite newer results with older.
  useEffect(() => {
    if (!open) return;
    // Pyet answers on Enter, not per keystroke. Searching underneath it would
    // spend a request per character on results nothing is going to render.
    if (mode === "pyet") return;
    const q = query.trim();
    if (q.length < 2) {
      setData(EMPTY);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const payload = (await res.json()) as Payload;
        setData(payload);
        setActive(0);
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          console.error("[kerko] search failed", error);
          setData({ ...EMPTY, query: q });
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, open, mode]);

  // Openers, so the first thing in Pyet mode is not an empty box. Fetched once
  // per opening and only when the reader actually switches to it. The reader's
  // own come first — ranked on this device from what they follow, read and
  // ask about — then the day's general ones fill the row.
  useEffect(() => {
    if (!open || mode !== "pyet" || starters.length > 0) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/pyet");
        const payload = await res.json();
        if (!alive) return;
        const general: Chip[] = Array.isArray(payload?.starters) ? payload.starters : [];
        const personal: Chip[] = Array.isArray(payload?.pool)
          ? personalStarters(payload.pool, readInterests(), readMemory(), 3)
          : [];
        const seen = new Set(personal.map((c) => c.question));
        setStarters([...personal, ...general.filter((c) => !seen.has(c.question))].slice(0, 4));
      } catch {
        // Openers are a convenience; the input works without them.
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, mode, starters.length]);

  const go = useCallback(
    (href: string) => {
      const q = query.trim();
      track("search_result_click", { query: q });
      if (q.length >= 2) remember(q);
      onClose();
      router.push(href);
    },
    [onClose, router, query],
  );

  const forget = useCallback((q: string) => {
    const list = readRecent().filter((r) => r !== q);
    writeRecent(list);
    setRecent(list);
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      // Pyet's composer handles its own Enter; only Escape is shared.
      if (mode === "pyet") return;
      if (event.key === "Enter") {
        event.preventDefault();
        const target = picked ? flat[active] : undefined;
        if (target) go(target.href);
        // Nothing chosen: the reader wants the results, not the first one.
        else if (query.trim().length >= 2) go(resultsHref(query));
        return;
      }
      if (!flat.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setPicked(true);
        setActive((i) => (i + 1) % flat.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setPicked(true);
        setActive((i) => (i - 1 + flat.length) % flat.length);
      }
    },
    [flat, active, go, onClose, mode, picked, query],
  );

  // Keep the highlighted row in view when the arrows walk past the fold.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!mounted || !open) return null;

  const showing = query.trim().length >= 2;
  const terms = highlightTerms(query);
  const entity = data.entity;
  const nothing = showing && !loading && flat.length === 0;
  let index = -1;

  return createPortal(
    <div
      className="kerko-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="Kërko në 383"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="kerko-panel" onKeyDown={onKeyDown}>
        {/* Search owns this field. Pyet has a composer of its own further
            down: one box that searches and a second that asks, stacked, read
            as two ways to do the same thing — and the reader could not tell
            which one the question was going into. */}
        {mode === "kerko" ? (
          <div className="kerko-field">
            <Search size={18} strokeWidth={2.5} aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kërko lajme, tema, vende…"
              aria-label="Kërko"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="kerko-esc" onClick={onClose}>
              esc
            </button>
          </div>
        ) : (
          <div className="kerko-field kerko-field-ask">
            <span className="kerko-ask-title">
              <DardaniFace state={ask?.face ?? "neutral"} size={34} decorative />
              Pyet Dardanin
            </span>
            <button type="button" className="kerko-esc" onClick={onClose}>
              esc
            </button>
          </div>
        )}


        <div className="kerko-body" ref={listRef}>
          {mode === "pyet" ? (
            <AskPanel
              variant="overlay"
              autoFocus
              chips={starters}
              onStatus={setAsk}
              seedQuestion={seedQuestion}
              seedNonce={seedNonce}
            />
          ) : !showing ? (
            recent.length === 0 && trending.length === 0 ? (
              <p className="kerko-hint">
                Shkruaj të paktën dy shkronja. Kërkimi mbulon artikujt, temat, vendet te
                Toni, qytetet te Vizito dhe tregjet.
              </p>
            ) : (
              <div className="kerko-start">
                {recent.length > 0 && (
                  <section className="kerko-start-block">
                    <div className="kerko-start-head">
                      <h3 className="kerko-group-label">KËRKIMET E FUNDIT</h3>
                      <button
                        type="button"
                        className="kerko-start-clear"
                        onClick={() => {
                          writeRecent([]);
                          setRecent([]);
                        }}
                      >
                        Pastro
                      </button>
                    </div>
                    <ul className="kerko-recent">
                      {recent.map((r) => (
                        <li key={r}>
                          <button type="button" className="kerko-recent-go" onClick={() => setQuery(r)}>
                            <Clock size={14} strokeWidth={2.4} aria-hidden="true" />
                            {r}
                          </button>
                          <button
                            type="button"
                            className="kerko-recent-x"
                            aria-label={`Hiq “${r}”`}
                            onClick={() => forget(r)}
                          >
                            <X size={14} strokeWidth={2.4} aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {trending.length > 0 && (
                  <section className="kerko-start-block">
                    <h3 className="kerko-group-label">NË LAJME TANI</h3>
                    <ul className="kerko-trending">
                      {trending.map((t) => (
                        <li key={t.href}>
                          <button type="button" onClick={() => go(t.href)}>
                            <Flame size={14} strokeWidth={2.4} aria-hidden="true" />
                            {t.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )
          ) : loading && flat.length === 0 ? (
            <div className="kerko-searching" role="status">
              <DardaniLoop name="researching" decorative className="kerko-searching-loop" />
              <p>Po kërkon…</p>
            </div>
          ) : nothing ? (
            <div className="kerko-empty">
              <DardaniImage name="face-confused" decorative className="kerko-empty-face" />
              <p className="kerko-empty-title">
                Asgjë për <strong>“{data.query || query.trim()}”</strong>.
              </p>
              {data.suggestions.length > 0 && (
                <>
                  <p className="kerko-empty-sub">Ndoshta kërkoje një nga këto:</p>
                  <ul className="kerko-suggestions">
                    {data.suggestions.map((s) => (
                      <li key={`${s.kind}-${s.href}-${s.title}`}>
                        <button type="button" onClick={() => go(s.href)}>
                          {s.title}
                          {s.meta && <span>{s.meta}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <button type="button" className="kerko-seeall kerko-seeall-page" onClick={() => go(resultsHref(query))}>
                Shiko rezultatet më të afërta
                <ArrowUpRight size={13} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              {/* The subject the reader named. Separated from the matches
                  below because it is a different claim: these are pieces about
                  this person, not pieces containing this string. */}
              {entity && entity.articles.length > 0 && (
                <section className="kerko-group kerko-entity">
                  <h3 className="kerko-group-label">
                    ARTIKUJ PËR {entity.name.toUpperCase()}
                    {entity.role && <em>{entity.role}</em>}
                  </h3>
                  <ul>
                    {entity.articles.map((item) => {
                      index += 1;
                      const at = index;
                      return (
                        <li key={`entity-${item.href}`}>
                          <Row
                            item={{ ...item, kind: "artikull" }}
                            active={at === active}
                            terms={terms}
                            onHover={() => setActive(at)}
                            onPick={() => go(item.href)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                  {entity.total > entity.articles.length && (
                    <button
                      type="button"
                      className="kerko-seeall"
                      onClick={() => go(entity.href)}
                    >
                      Shiko të {entity.total} artikujt për {entity.name}
                      <ArrowUpRight size={13} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                  )}

                  {/* A country answers a second question: how its own press
                      writes about Kosovo. The index says where that stands,
                      the pieces underneath are the evidence for it. */}
                  {entity.facts && (
                    <>
                      <ToneReading name={entity.name} facts={entity.facts} />
                      {entity.facts.foreign.length > 0 && (
                        <>
                        <p className="kerko-foreign-caption">
                          Çfarë shkruan {entity.name} për Kosovën
                        </p>
                        <ul className="kerko-foreign">
                          {entity.facts.foreign.map((a) => (
                            <li key={a.url}>
                              <a href={a.url} target="_blank" rel="noopener noreferrer">
                                <span className="kerko-title">{a.title}</span>
                                <span className="kerko-meta">
                                  <em data-sentiment={a.sentiment} />
                                </span>
                              </a>
                            </li>
                          ))}
                        </ul>
                        </>
                      )}
                    </>
                  )}
                </section>
              )}

              {data.groups.map((group) => (
                <section key={group.kind} className="kerko-group">
                  <h3 className="kerko-group-label">{group.label}</h3>
                  <ul>
                    {group.items.map((item) => {
                      index += 1;
                      const at = index;
                      return (
                        <li key={`${item.kind}-${item.href}-${item.title}`}>
                          <Row
                            item={item}
                            active={at === active}
                            terms={terms}
                            onHover={() => setActive(at)}
                            onPick={() => go(item.href)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              <button type="button" className="kerko-seeall kerko-seeall-page" onClick={() => go(resultsHref(query))}>
                Shiko të gjitha rezultatet për “{query.trim()}”
                <ArrowUpRight size={13} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
