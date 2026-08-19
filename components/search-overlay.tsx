"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowUpRight, MessageCircle, Search, Sparkles } from "lucide-react";

type Item = { title: string; href: string; meta?: string; kind: string };
type Group = { kind: string; label: string; items: Item[] };

type Payload = {
  query: string;
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
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  // Flat list of everything selectable, so the arrow keys can walk across
  // group boundaries without the caller knowing the grouping.
  const flat = useMemo(
    () => data.groups.flatMap((g) => g.items),
    [data.groups],
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
  }, [query, open]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
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
    [flat, active, go, onClose],
  );

  // Keep the highlighted row in view when the arrows walk past the fold.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!mounted || !open) return null;

  const showing = query.trim().length >= 2;
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
        <div className="kerko-field">
          <Search size={18} strokeWidth={2.5} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === "pyet" ? "Bëj një pyetje për Kosovën…" : "Kërko lajme, tema, vende…"
            }
            aria-label="Kërko"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="kerko-esc" onClick={onClose}>
            esc
          </button>
        </div>

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
            <span className="kerko-soon">së shpejti</span>
          </button>
        </div>

        <div className="kerko-body" ref={listRef}>
          {mode === "pyet" ? (
            <div className="kerko-note">
              <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
              <p>
                <strong>Pyet 383 nuk është gati ende.</strong> Do të përgjigjet me një
                përmbledhje nga arkivi, me burimet e lidhura. Deri atëherë, kërkimi gjen
                artikujt, temat dhe faqet.
              </p>
            </div>
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
