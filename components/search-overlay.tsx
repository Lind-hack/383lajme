"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AskPanel, { type Chip } from "@/components/ask-panel";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  MessageCircle,
  Minus,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { track } from "@/lib/analytics";

type Item = { title: string; href: string; meta?: string; kind: string };
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

export default function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"kerko" | "pyet">("kerko");
  const [data, setData] = useState<Payload>(EMPTY);
  const [starters, setStarters] = useState<Chip[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

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

  useEffect(() => {
    if (!open) {
      setQuery("");
      setData(EMPTY);
      setActive(0);
      setMode("kerko");
    }
  }, [open]);

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
  // per opening and only when the reader actually switches to it.
  useEffect(() => {
    if (!open || mode !== "pyet" || starters.length > 0) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/pyet");
        const payload = await res.json();
        if (alive && Array.isArray(payload?.starters)) setStarters(payload.starters);
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
      track("search_result_click", { query: query.trim() });
      onClose();
      router.push(href);
    },
    [onClose, router, query],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      // Pyet's composer handles its own Enter; only Escape is shared.
      if (mode === "pyet") return;
      if (!flat.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((i) => (i + 1) % flat.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((i) => (i - 1 + flat.length) % flat.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const target = flat[active];
        if (target) go(target.href);
      }
    },
    [flat, active, go, onClose, mode],
  );

  // Keep the highlighted row in view when the arrows walk past the fold.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!mounted || !open) return null;

  const showing = query.trim().length >= 2;
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
            <span className="kerko-ask-title">Pyet 383</span>
            <button type="button" className="kerko-esc" onClick={onClose}>
              esc
            </button>
          </div>
        )}

        <div className="kerko-modes" role="tablist" aria-label="Mënyra e kërkimit">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "kerko"}
            className="kerko-mode"
            data-on={mode === "kerko" ? "true" : undefined}
            onClick={() => setMode("kerko")}
          >
            Kërko
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "pyet"}
            className="kerko-mode"
            data-on={mode === "pyet" ? "true" : undefined}
            onClick={() => setMode("pyet")}
          >
            Pyet 383
          </button>
        </div>

        <div className="kerko-body" ref={listRef}>
          {mode === "pyet" ? (
            <AskPanel variant="overlay" autoFocus chips={starters} />
          ) : !showing ? (
            <p className="kerko-hint">
              Shkruaj të paktën dy shkronja. Kërkimi mbulon artikujt, temat, vendet te
              Toni, qytetet te Vizito dhe tregjet.
            </p>
          ) : nothing ? (
            <div className="kerko-empty">
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
              <p className="kerko-empty-ask">
                <MessageCircle size={14} strokeWidth={2.5} aria-hidden="true" />
                Duket si pyetje?{" "}
                <button type="button" onClick={() => setMode("pyet")}>
                  Provo Pyet 383
                </button>{" "}
                për një përmbledhje.
              </p>
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
                      const isActive = index === active;
                      return (
                        <li key={`entity-${item.href}`}>
                          <button
                            type="button"
                            data-active={isActive ? "true" : undefined}
                            onMouseEnter={() => setActive(index)}
                            onClick={() => go(item.href)}
                          >
                            <span className="kerko-title">{item.title}</span>
                            {item.meta && <span className="kerko-meta">{item.meta}</span>}
                          </button>
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
                                  {a.outlet}
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
                      const isActive = index === active;
                      return (
                        <li key={`${item.kind}-${item.href}-${item.title}`}>
                          <button
                            type="button"
                            data-active={isActive ? "true" : undefined}
                            onMouseEnter={() => setActive(index)}
                            onClick={() => go(item.href)}
                          >
                            <span className="kerko-title">{item.title}</span>
                            {item.meta && <span className="kerko-meta">{item.meta}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              {data.isQuestion && (
                <p className="kerko-ask">
                  <MessageCircle size={14} strokeWidth={2.5} aria-hidden="true" />
                  Duket si pyetje? Provo{" "}
                  <button type="button" onClick={() => setMode("pyet")}>
                    Pyet 383
                  </button>{" "}
                  për një përmbledhje
                  <ArrowUpRight size={12} strokeWidth={2.5} aria-hidden="true" />
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
