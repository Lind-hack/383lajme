"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Check,
  ImageOff,
  Loader2,
  Pencil,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { NAV_CATEGORIES } from "@/lib/category-map";
import type { AdminArticleFull, AdminArticleRow } from "@/lib/admin/articles";

/**
 * The article work queue.
 *
 * One page of light rows arrives from the server already filtered; nothing
 * here re-filters, and no row carries a body until its editor is opened.
 *
 * Editing expands in place rather than opening a modal. The operator is
 * comparing the edit against the rows around it, and a modal would hide
 * exactly the context that makes the edit decidable.
 */

type Draft = {
  title: string;
  excerpt: string;
  body: string;
  imageUrl: string;
  category: string;
  featured: boolean;
};

function draftFrom(a: AdminArticleFull): Draft {
  return {
    title: a.title,
    excerpt: a.excerpt,
    body: a.body,
    imageUrl: a.imageUrl ?? "",
    category: a.category,
    featured: a.featured,
  };
}

export default function ArticleList({ rows }: { rows: AdminArticleRow[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const deepLinkId = params.get("id");

  const [openId, setOpenId] = useState<string | null>(null);
  const [full, setFull] = useState<AdminArticleFull | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const openedDeepLink = useRef(false);
  const openTicket = useRef(0);

  /**
   * The pipeline emails `/admin?id=<id>` links. Those ids are news_articles
   * ids, so before this rebuild they matched nothing in the panel's disk store
   * and the link silently did nothing. Honour it once per arrival.
   */
  useEffect(() => {
    if (!deepLinkId || openedDeepLink.current) return;
    openedDeepLink.current = true;
    void openEditor(deepLinkId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkId]);

  useEffect(() => {
    if (!openId) return;
    const el = document.getElementById(`article-${openId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [openId]);

  const dirty = Boolean(full && draft) && changedFields() !== null;

  /**
   * A body edit is minutes of work and the editor sits one click from a nav
   * link, so leaving with unsaved changes has to be deliberate.
   *
   * beforeunload alone does not do this. It covers a reload, a closed tab and a
   * typed URL, but Next's <Link> navigations never unload the document, so the
   * exact case this guard was written for -- clicking "Dosje" in the nav --
   * discarded the edit silently. Anchor clicks are intercepted in the capture
   * phase as well, before the router sees them.
   */
  useEffect(() => {
    if (!dirty) return;

    const warnOnUnload = (e: BeforeUnloadEvent) => e.preventDefault();

    const warnOnInAppNav = (e: MouseEvent) => {
      // Let modified clicks through: they open a new tab and leave this one,
      // with its unsaved edit, exactly where it is.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      // Same-document jumps are not a navigation away from the edit.
      if (anchor.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("Ke ndryshime të paruajtura. Largohu pa i ruajtur?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", warnOnUnload);
    document.addEventListener("click", warnOnInAppNav, true);
    return () => {
      window.removeEventListener("beforeunload", warnOnUnload);
      document.removeEventListener("click", warnOnInAppNav, true);
    };
  }, [dirty]);

  async function openEditor(id: string) {
    // Every open gets a ticket, and only the newest one may write state. Two
    // overlapping fetches otherwise resolve in arbitrary order: the deep-link
    // effect opens article A, the operator clicks Edito on B before it lands,
    // A answers last, and the panel under B is filled with A -- so saving
    // writes A while the operator believes they edited B.
    const ticket = ++openTicket.current;
    setOpenId(id);
    setError(null);
    setFull(null);
    setDraft(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/articles?id=${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      const payload = (await res.json()) as { article?: AdminArticleFull; error?: string };
      if (ticket !== openTicket.current) return;
      if (!res.ok || !payload.article) throw new Error(payload.error ?? `HTTP ${res.status}`);
      setFull(payload.article);
      setDraft(draftFrom(payload.article));
    } catch (err) {
      if (ticket !== openTicket.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (ticket === openTicket.current) setLoading(false);
    }
  }

  function closeEditor() {
    openTicket.current += 1;
    setOpenId(null);
    setFull(null);
    setDraft(null);
    setError(null);
  }

  /** Only send what actually changed, so an untouched column is never rewritten. */
  function changedFields(): Record<string, unknown> | null {
    if (!full || !draft) return null;
    const patch: Record<string, unknown> = {};
    if (draft.title !== full.title) patch.title = draft.title;
    if (draft.excerpt !== full.excerpt) patch.excerpt = draft.excerpt;
    if (draft.body !== full.body) patch.body = draft.body;
    if (draft.category !== full.category) patch.category = draft.category;
    if (draft.featured !== full.featured) patch.featured = draft.featured;
    if (draft.imageUrl !== (full.imageUrl ?? "")) patch.imageUrl = draft.imageUrl;
    return Object.keys(patch).length ? patch : null;
  }

  async function save() {
    if (!full || !draft) return;
    const patch = changedFields();
    if (!patch) {
      closeEditor();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/articles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: full.id, ...patch }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? `HTTP ${res.status}`);
      const savedFor = full.id;
      closeEditor();
      setSavedId(savedFor);
      setTimeout(() => setSavedId((c) => (c === savedFor ? null : c)), 2600);
      // The list is server-rendered, so re-fetch it rather than patching a
      // local copy that could drift from what the next reader will see.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    setConfirmId(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/articles?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? `HTTP ${res.status}`);
      if (openId === id) closeEditor();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  }

  /**
   * The pipeline emails /admin?id=X links, and X is very often an article that
   * is not among the 25 rows of the current page -- it may be hours or days
   * old. The editor JSX lives inside the row loop, so in that case opening it
   * rendered nothing at all: no editor, no skeleton, and not even the "not
   * found" error, because that branch is inside the same block. The article is
   * shown as its own row above the list instead.
   *
   * AdminArticleFull extends AdminArticleRow, so the fetched article is already
   * a valid row; while it is still loading there is nothing to show but its id.
   */
  const deepLinkRow: AdminArticleRow | null =
    openId && !rows.some((r) => r.id === openId)
      ? full && full.id === openId
        ? full
        : {
            id: openId,
            slug: "",
            title: loading ? "Duke ngarkuar artikullin…" : "Artikulli i kërkuar",
            excerpt: "",
            source: "",
            sourceFlag: "",
            category: "",
            categoryLabel: "",
            publishedAt: "",
            publishedLabel: "—",
            createdAt: null,
            imageUrl: null,
            score: null,
            featured: false,
          }
      : null;

  const displayRows = deepLinkRow ? [deepLinkRow, ...rows] : rows;

  if (displayRows.length === 0) {
    return (
      <div
        className="panel mt-3 flex flex-col items-center gap-2 px-6 py-14 text-center"
        style={{ color: "var(--a-muted)" }}
      >
        <p className="m-0 text-[15px] font-bold" style={{ color: "var(--a-ink)" }}>
          Asnjë artikull nuk përputhet
        </p>
        <p className="m-0 max-w-[380px] text-[13px]">
          Kërkimi shikon titullin, përshkrimin, tekstin e plotë, burimin dhe slug-un. Provo
          një fjalë të vetme, ose hiq filtrin e kategorisë.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {error && !openId && (
        <p
          role="alert"
          className="panel m-0 flex items-center gap-2 px-3 py-2.5 text-[13px] font-semibold"
          style={{ color: "var(--a-danger)", borderColor: "rgba(180,24,26,0.3)" }}
        >
          <AlertCircle size={15} aria-hidden />
          {error}
        </p>
      )}

      {displayRows.map((a) => {
        const isOpen = openId === a.id;
        const isDeleting = deletingId === a.id;
        const justSaved = savedId === a.id;

        return (
          <article
            key={a.id}
            id={`article-${a.id}`}
            className={`panel overflow-hidden ${isDeleting ? "is-busy" : ""}`}
            style={isOpen ? { borderColor: "var(--a-accent)" } : undefined}
          >
            <div className="flex items-start gap-3 p-3">
              <div
                className="relative hidden h-[52px] w-[76px] shrink-0 overflow-hidden rounded-[7px] sm:block"
                style={{ background: "var(--a-panel-3)" }}
              >
                {a.imageUrl ? (
                  <Image
                    src={a.imageUrl}
                    alt=""
                    width={76}
                    height={52}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center"
                    style={{ color: "var(--a-faint)" }}
                    title="Pa imazh"
                  >
                    <ImageOff size={16} aria-hidden />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="pill">{a.categoryLabel}</span>
                  {a.category && a.category !== a.categoryLabel && (
                    /* The pipeline still writes retired labels such as
                       "Politikë" and "Shoqëri", which category-map folds onto a
                       live section at read time. Showing the fold makes the row
                       that needs correcting visible instead of silently right. */
                    <span
                      className="pill pill-warn"
                      title={`E ruajtur si "${a.category}", shfaqet te ${a.categoryLabel}`}
                    >
                      {a.category}
                    </span>
                  )}
                  <span className="truncate text-[11px]" style={{ color: "var(--a-muted)" }}>
                    {a.source}
                  </span>
                  <time
                    dateTime={a.publishedAt}
                    className="tnum text-[11px]"
                    style={{ color: "var(--a-faint)" }}
                  >
                    {a.publishedLabel}
                  </time>
                  {a.score != null && (
                    <span
                      className="tnum text-[11px] font-bold"
                      title="Rezultati i angazhimit"
                      style={{
                        color:
                          a.score >= 8
                            ? "var(--a-ok)"
                            : a.score >= 6
                              ? "var(--a-warn)"
                              : "var(--a-faint)",
                      }}
                    >
                      {a.score.toFixed(1)}
                    </span>
                  )}
                  {a.featured && (
                    <span className="pill pill-accent">
                      <Star size={10} aria-hidden /> Kryesor
                    </span>
                  )}
                  {justSaved && (
                    <span className="pill pill-ok">
                      <Check size={10} aria-hidden /> U ruajt
                    </span>
                  )}
                </div>

                <h2
                  className="m-0 text-[14px] font-bold leading-[1.35]"
                  style={{ color: "var(--a-ink)" }}
                >
                  {a.title}
                </h2>
                {a.excerpt && (
                  <p
                    className="m-0 mt-1 line-clamp-2 text-[12px] leading-[1.5]"
                    style={{ color: "var(--a-muted)" }}
                  >
                    {a.excerpt}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {confirmId === a.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      className="btn btn-sm btn-primary"
                      style={{ background: "var(--a-danger)", borderColor: "var(--a-danger)" }}
                    >
                      Fshi vërtet
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="btn btn-sm"
                    >
                      Jo
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => (isOpen ? closeEditor() : openEditor(a.id))}
                      className="btn btn-sm"
                      aria-expanded={isOpen}
                      aria-controls={`editor-${a.id}`}
                    >
                      {isOpen ? (
                        <X size={13} strokeWidth={2.3} aria-hidden />
                      ) : (
                        <Pencil size={13} strokeWidth={2.3} aria-hidden />
                      )}
                      <span className="hidden sm:inline">{isOpen ? "Mbyll" : "Edito"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(a.id)}
                      disabled={isDeleting}
                      className="btn btn-sm btn-danger btn-icon"
                      aria-label={`Fshi ${a.title}`}
                    >
                      {isDeleting ? (
                        <Loader2 size={13} className="animate-spin" aria-hidden />
                      ) : (
                        <Trash2 size={13} strokeWidth={2.3} aria-hidden />
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {isOpen && (
              <div
                id={`editor-${a.id}`}
                className="border-t p-3"
                style={{ borderColor: "var(--a-border)", background: "var(--a-panel-2)" }}
              >
                {loading && (
                  <div className="flex flex-col gap-2.5" aria-label="Duke ngarkuar artikullin">
                    <div className="skeleton h-[34px] w-full" />
                    <div className="skeleton h-[62px] w-full" />
                    <div className="skeleton h-[130px] w-full" />
                  </div>
                )}

                {!loading && error && (
                  <p
                    role="alert"
                    className="m-0 flex items-center gap-2 text-[13px] font-semibold"
                    style={{ color: "var(--a-danger)" }}
                  >
                    <AlertCircle size={15} aria-hidden />
                    {error}
                  </p>
                )}

                {!loading && draft && (
                  <div className="flex flex-col gap-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                      <div>
                        <label className="label" htmlFor={`title-${a.id}`}>
                          Titulli
                        </label>
                        <input
                          id={`title-${a.id}`}
                          name="title"
                          autoComplete="off"
                          className="field"
                          value={draft.title}
                          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor={`cat-${a.id}`}>
                          Kategoria
                        </label>
                        <select
                          id={`cat-${a.id}`}
                          className="field"
                          value={draft.category}
                          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                        >
                          {!NAV_CATEGORIES.some((c) => c.label === draft.category) && (
                            <option value={draft.category}>{draft.category || "Pa kategori"}</option>
                          )}
                          {NAV_CATEGORIES.map((c) => (
                            <option key={c.label} value={c.label}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="label" htmlFor={`img-${a.id}`}>
                        Imazhi (URL)
                      </label>
                      <div className="flex items-start gap-2.5">
                        <input
                          id={`img-${a.id}`}
                          type="url"
                          name="imageUrl"
                          inputMode="url"
                          autoComplete="off"
                          spellCheck={false}
                          className="field"
                          placeholder="https://example.com/foto.jpg"
                          value={draft.imageUrl}
                          onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
                        />
                        <div
                          className="hidden h-[38px] w-[56px] shrink-0 overflow-hidden rounded-[7px] sm:block"
                          style={{ background: "var(--a-panel-3)" }}
                        >
                          {draft.imageUrl ? (
                            <Image
                              src={draft.imageUrl}
                              alt=""
                              width={56}
                              height={38}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="label" htmlFor={`exc-${a.id}`}>
                        Përshkrimi
                      </label>
                      <textarea
                        id={`exc-${a.id}`}
                        className="field"
                        rows={3}
                        value={draft.excerpt}
                        onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="label" htmlFor={`body-${a.id}`}>
                        Teksti i plotë
                      </label>
                      <textarea
                        id={`body-${a.id}`}
                        className="field"
                        rows={10}
                        value={draft.body}
                        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
                        <input
                          type="checkbox"
                          checked={draft.featured}
                          onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
                          style={{ accentColor: "var(--a-accent-fill)" }}
                        />
                        Kryesor
                      </label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={closeEditor} className="btn">
                          Anulo
                        </button>
                        <button
                          type="button"
                          onClick={save}
                          disabled={saving}
                          className="btn btn-primary"
                        >
                          {saving && <Loader2 size={13} className="animate-spin" aria-hidden />}
                          {saving ? "Duke ruajtur…" : "Ruaj"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
