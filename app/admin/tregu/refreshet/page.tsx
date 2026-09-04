import Link from "next/link";
import { AlertCircle, ArrowLeft, ExternalLink, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { isAdminAuthed } from "@/lib/admin-auth";
import { marketRefreshes, type MarketRefresh, type RefreshSort } from "@/lib/admin/tregu-refreshes";
import AdminNav from "../../_components/AdminNav";

/**
 * When the odds refreshed, on which markets, and on what evidence.
 *
 * market_snapshots has recorded all of this since 0001 and nothing rendered it,
 * so a price that moved gave the operator no way to see why. Rolled up per
 * market rather than listed per snapshot: the reprice runs every couple of
 * minutes across 221 markets, and the useful question is which ones moved.
 */

export const dynamic = "force-dynamic";

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function signedPct(value: number): string {
  const p = value * 100;
  return `${p >= 0 ? "+" : "−"}${Math.abs(p).toFixed(1)} pp`;
}

/** A move is only worth colouring once it is larger than rounding noise. */
function moveTone(delta: number): { color: string; Icon: typeof TrendingUp } {
  if (delta > 0.001) return { color: "var(--a-ok)", Icon: TrendingUp };
  if (delta < -0.001) return { color: "var(--a-danger)", Icon: TrendingDown };
  return { color: "var(--a-faint)", Icon: Minus };
}

export default async function RefreshesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isAdminAuthed())) {
    return (
      <>
        <AdminNav />
        <main className="mx-auto max-w-[1180px] px-3 py-4 sm:px-5">
          <p className="panel m-0 p-4 text-[13px] font-semibold">Hyr së pari.</p>
        </main>
      </>
    );
  }

  const params = await searchParams;
  const raw = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  const sort: RefreshSort = raw === "recent" ? "recent" : "moved";
  const summary = await marketRefreshes(sort);

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-[1180px] px-3 py-4 sm:px-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link href="/admin/tregu" className="btn btn-sm">
            <ArrowLeft size={14} strokeWidth={2.3} aria-hidden />
            Tregu
          </Link>
          <h1 className="m-0 text-[16px] font-black tracking-tight">Rifreskimet e kuotave</h1>
          <div className="ml-auto flex items-center gap-1.5">
            {(
              [
                ["moved", "Sipas lëvizjes"],
                ["recent", "Më të fundit"],
              ] as const
            ).map(([key, label]) => (
              <Link
                key={key}
                href={key === "moved" ? "/admin/tregu/refreshet" : `/admin/tregu/refreshet?sort=${key}`}
                aria-current={sort === key ? "true" : undefined}
                className="shrink-0 rounded-[8px] px-2.5 py-1.5 text-[12px] font-bold no-underline transition-colors"
                style={{
                  background: sort === key ? "var(--a-ink)" : "var(--a-panel)",
                  color: sort === key ? "#fff" : "var(--a-muted)",
                  border: `1px solid ${sort === key ? "var(--a-ink)" : "var(--a-border-strong)"}`,
                }}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {summary.error ? (
          <div
            role="alert"
            className="panel flex items-start gap-2.5 px-4 py-3.5"
            style={{ borderColor: "rgba(180,24,26,0.3)" }}
          >
            <AlertCircle size={17} aria-hidden style={{ color: "var(--a-danger)", flexShrink: 0 }} />
            <p className="m-0 text-[13px] font-semibold" style={{ color: "var(--a-danger)" }}>
              {summary.error}
            </p>
          </div>
        ) : summary.markets.length === 0 ? (
          <div className="panel px-6 py-14 text-center" style={{ color: "var(--a-muted)" }}>
            <p className="m-0 text-[15px] font-bold" style={{ color: "var(--a-ink)" }}>
              Asnjë rifreskim i regjistruar
            </p>
            <p className="m-0 mt-1 text-[13px]">
              Kur riçmimi të ekzekutohet, çdo ndryshim shfaqet këtu me artikujt që e shkaktuan.
            </p>
          </div>
        ) : (
          <>
            <p className="m-0 mb-2.5 text-[12px]" style={{ color: "var(--a-muted)" }}>
              <span className="tnum font-bold" style={{ color: "var(--a-ink)" }}>
                {summary.movedCount}
              </span>{" "}
              nga <span className="tnum">{summary.markets.length}</span> tregje lëvizën në{" "}
              <span className="tnum">{summary.snapshotsScanned}</span> rifreskimet e fundit
              {summary.windowFrom && summary.windowTo && (
                <>
                  {" "}
                  ({summary.windowFrom} → {summary.windowTo})
                </>
              )}
              .
            </p>

            <div className="flex flex-col gap-2">
              {summary.markets.map((m) => (
                <MarketRow key={m.marketId} market={m} />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}

function MarketRow({ market: m }: { market: MarketRefresh }) {
  const window = moveTone(m.windowDelta);
  const step = m.stepDelta == null ? null : moveTone(m.stepDelta);
  const evidence = m.latest.evidence;

  return (
    <article className="panel p-3">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {m.status && (
              <span className={`pill ${m.status === "open" ? "pill-ok" : ""}`}>{m.status}</span>
            )}
            {m.category && <span className="pill">{m.category}</span>}
            <span className="tnum text-[11px]" style={{ color: "var(--a-faint)" }}>
              {m.latest.atLabel}
            </span>
            <span className="tnum text-[11px]" style={{ color: "var(--a-faint)" }}>
              · {m.refreshCount}{" "}
              {m.refreshCount === 1 ? "rifreskim" : "rifreskime"}
            </span>
          </div>

          <h2 className="m-0 text-[14px] font-bold leading-[1.35]">
            {m.slug ? (
              <Link
                href={`/tregu/${m.slug}`}
                target="_blank"
                className="inline-flex items-start gap-1 no-underline hover:underline"
                style={{ color: "var(--a-ink)" }}
              >
                {m.question}
                <ExternalLink
                  size={12}
                  aria-hidden
                  className="mt-[3px] shrink-0"
                  style={{ color: "var(--a-faint)" }}
                />
              </Link>
            ) : (
              m.question
            )}
          </h2>
        </div>

        {/* Price now, the step that got here, and the move across the window. */}
        <div className="flex shrink-0 items-center gap-3">
          <Figure label="Kuota" value={pct(m.latest.marketProb)} />
          <Figure
            label="Hapi i fundit"
            value={m.stepDelta == null ? "—" : signedPct(m.stepDelta)}
            color={step?.color}
            Icon={m.stepDelta == null ? undefined : step?.Icon}
          />
          <Figure
            label="Në dritare"
            value={signedPct(m.windowDelta)}
            color={window.color}
            Icon={window.Icon}
            // Each market's window is only as long as its own snapshots inside
            // the scan, so 180 refreshes and 2 refreshes cover very different
            // spans. Naming the span stops them reading as comparable.
            hint={`${m.first.atLabel} → ${m.latest.atLabel} · ${m.refreshCount} rifreskime`}
          />
          <Figure
            label="AI"
            value={m.latest.aiProb == null ? "—" : pct(m.latest.aiProb)}
            hint={
              m.latest.aiProb == null
                ? "Tregjet sportive çmohen nga scraper-i, jo nga modeli"
                : m.aiGap == null
                  ? undefined
                  : `Modeli ${signedPct(m.aiGap)} nga tregu`
            }
          />
        </div>
      </div>

      {/* What moved it. The whole reason this page exists. */}
      {evidence.length > 0 && (
        <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: "var(--a-border)" }}>
          <p className="label m-0 mb-1.5">Të dhënat që lëvizën kuotën</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {evidence.map((e, i) => (
              <li key={`${e.url ?? e.slug ?? i}`} className="text-[12px] leading-[1.5]">
                {e.url ? (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    className="no-underline hover:underline"
                    style={{ color: "var(--a-accent-fill)" }}
                  >
                    {e.title ?? e.url}
                  </a>
                ) : (
                  <span style={{ color: e.title ? "var(--a-muted)" : "var(--a-faint)" }}>
                    {/* A live row really does carry {"title": null}: say so
                        rather than rendering an empty bullet. */}
                    {e.title ?? "Burim pa titull"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function Figure({
  label,
  value,
  color,
  Icon,
  hint,
}: {
  label: string;
  value: string;
  color?: string;
  Icon?: typeof TrendingUp;
  hint?: string;
}) {
  return (
    <div className="min-w-[64px]" title={hint}>
      <span className="label m-0 mb-0.5 block">{label}</span>
      <span
        className="tnum flex items-center gap-1 text-[13px] font-extrabold"
        style={{ color: color ?? "var(--a-ink)" }}
      >
        {Icon && <Icon size={12} strokeWidth={2.6} aria-hidden />}
        {value}
      </span>
    </div>
  );
}
