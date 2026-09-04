"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronRight, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import {
  BLOCKER_DETAIL,
  BLOCKER_LABELS,
  type Blocker,
  type DosjeTopicRow,
} from "@/lib/admin/dosje";

/**
 * The cleanup screen.
 *
 * Deleting a dossier destroys its milestones, citations, media and match
 * history with it, so nothing here deletes on a rule. Each row states why it
 * cannot reach the site and the operator decides. "Zgjidh të bllokuarat"
 * selects the ones that cannot get there without a change of substance -- it
 * fills the checkboxes, it does not delete.
 */

type Filter = "all" | "dead" | "live";

export default function DosjeCleanup({
  topics,
  canDelete,
}: {
  topics: DosjeTopicRow[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("dead");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deadCount = topics.filter((t) => t.isDeadWeight).length;

  const visible = useMemo(() => {
    if (filter === "dead") return topics.filter((t) => t.isDeadWeight);
    if (filter === "live") return topics.filter((t) => !t.isDeadWeight);
    return topics;
  }, [topics, filter]);

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function purge() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/dosje", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slugs: [...selected] }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? `HTTP ${res.status}`);
      setSelected(new Set());
      setConfirming(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["dead", `Të bllokuara ${deadCount}`],
            ["live", `Në rregull ${topics.length - deadCount}`],
            ["all", `Të gjitha ${topics.length}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className="shrink-0 rounded-[8px] px-2.5 py-1.5 text-[12px] font-bold transition-colors"
            style={{
              background: filter === key ? "var(--a-ink)" : "var(--a-panel)",
              color: filter === key ? "#fff" : "var(--a-muted)",
              border: `1px solid ${filter === key ? "var(--a-ink)" : "var(--a-border-strong)"}`,
            }}
          >
            {label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {visible.some((t) => t.isDeadWeight) && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() =>
                setSelected(new Set(visible.filter((t) => t.isDeadWeight).map((t) => t.slug)))
              }
            >
              Zgjidh të bllokuarat
            </button>
          )}
          {selected.size > 0 && (
            <button type="button" className="btn btn-sm" onClick={() => setSelected(new Set())}>
              Hiq zgjedhjen
            </button>
          )}
        </div>
      </div>

      {!canDelete && (
        <p
          className="panel m-0 flex items-start gap-2 px-3 py-2.5 text-[12px] font-semibold"
          style={{ color: "var(--a-warn)", borderColor: "rgba(245,158,11,0.4)" }}
        >
          <ShieldAlert size={15} aria-hidden className="mt-px shrink-0" />
          Ky mjedis nuk ka SUPABASE_SERVICE_ROLE_KEY, prandaj fshirja është e çaktivizuar dhe
          dosjet në draft mund të jenë të fshehura nga RLS.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="panel m-0 flex items-center gap-2 px-3 py-2.5 text-[13px] font-semibold"
          style={{ color: "var(--a-danger)", borderColor: "rgba(180,24,26,0.3)" }}
        >
          <AlertCircle size={15} aria-hidden />
          {error}
        </p>
      )}

      {selected.size > 0 && (
        <div
          className="panel sticky top-[104px] z-30 flex flex-wrap items-center gap-2 px-3 py-2.5 md:top-[60px]"
          style={{ borderColor: "var(--a-accent)" }}
        >
          <span className="tnum text-[13px] font-bold">
            {selected.size} {selected.size === 1 ? "dosje e zgjedhur" : "dosje të zgjedhura"}
          </span>
          <span className="text-[12px]" style={{ color: "var(--a-muted)" }}>
            Fshirja heq edhe momentet, citimet, median dhe historikun e përputhjeve.
          </span>
          <div className="ml-auto flex items-center gap-2">
            {confirming ? (
              <>
                <button
                  type="button"
                  onClick={purge}
                  disabled={busy || !canDelete}
                  className="btn btn-sm btn-primary"
                  style={{ background: "var(--a-danger)", borderColor: "var(--a-danger)" }}
                >
                  {busy && <Loader2 size={13} className="animate-spin" aria-hidden />}
                  {busy ? "Duke fshirë…" : `Fshi ${selected.size} përfundimisht`}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="btn btn-sm">
                  Anulo
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={!canDelete}
                className="btn btn-sm btn-danger"
              >
                <Trash2 size={13} strokeWidth={2.3} aria-hidden />
                Fshi të zgjedhurat
              </button>
            )}
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="panel px-6 py-12 text-center" style={{ color: "var(--a-muted)" }}>
          <p className="m-0 text-[15px] font-bold" style={{ color: "var(--a-ink)" }}>
            {filter === "dead" ? "Asnjë dosje e bllokuar" : "Asnjë dosje"}
          </p>
          <p className="m-0 mt-1 text-[13px]">
            {filter === "dead"
              ? "Çdo dosje ka fjalë-çelës, artikuj të lidhur dhe të paktën një moment të miratuar."
              : "Ende nuk është krijuar asnjë dosje."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((t) => (
            <TopicRow
              key={t.slug}
              topic={t}
              checked={selected.has(t.slug)}
              onToggle={() => toggle(t.slug)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TopicRow({
  topic: t,
  checked,
  onToggle,
}: {
  topic: DosjeTopicRow;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <article
      className="panel p-3"
      style={checked ? { borderColor: "var(--a-accent)", background: "var(--a-accent-wash)" } : undefined}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Zgjidh ${t.title}`}
          className="mt-1 h-4 w-4 shrink-0"
          style={{ accentColor: "var(--a-accent-fill)" }}
        />

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`pill ${t.status === "approved" ? "pill-ok" : ""}`}>{t.status}</span>
            <code className="text-[11px]" style={{ color: "var(--a-faint)" }}>
              {t.slug}
            </code>
          </div>

          <h2 className="m-0 text-[14px] font-bold leading-[1.35]">{t.title}</h2>
          {t.blurb && (
            <p
              className="m-0 mt-0.5 line-clamp-2 text-[12px] leading-[1.5]"
              style={{ color: "var(--a-muted)" }}
            >
              {t.blurb}
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {t.blockers.map((b) => (
              <span
                key={b}
                className={`pill ${fatal(b) ? "pill-danger" : "pill-warn"}`}
                title={BLOCKER_DETAIL[b]}
              >
                {BLOCKER_LABELS[b]}
              </span>
            ))}
            {t.blockers.length === 0 && <span className="pill pill-ok">Publikohet</span>}
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-3.5 sm:flex">
          <Stat label="Artikuj" value={t.articleCount} warn={t.articleCount === 0} />
          <Stat
            label="Momente"
            value={`${t.approvedMilestoneCount}/${t.milestoneCount}`}
            warn={t.approvedMilestoneCount === 0}
          />
          <Stat label="Media" value={t.mediaCount} />
        </div>

        <Link
          href={`/admin/dosje/${encodeURIComponent(t.slug)}`}
          className="btn btn-sm shrink-0"
          title="Shiko kronologjinë"
        >
          <span className="hidden sm:inline">Shiko</span>
          <ChevronRight size={14} strokeWidth={2.3} aria-hidden />
        </Link>
      </div>
    </article>
  );
}

/** Blockers that cannot resolve on their own, as opposed to ones awaiting work. */
function fatal(b: Blocker): boolean {
  return b === "no_anchors" || b === "no_articles";
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  return (
    <div className="min-w-[54px]">
      <span className="label m-0 mb-0.5 block">{label}</span>
      <span
        className="tnum text-[13px] font-extrabold"
        style={{ color: warn ? "var(--a-danger)" : "var(--a-ink)" }}
      >
        {value}
      </span>
    </div>
  );
}
