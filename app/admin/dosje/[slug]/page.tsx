import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ExternalLink,
  Archive,
  ShieldAlert,
  X,
} from "lucide-react";
import { isAdminAuthed } from "@/lib/admin-auth";
import { youtubeId } from "@/lib/reagimi-data";
import {
  BLOCKER_DETAIL,
  BLOCKER_LABELS,
  dosjeTimeline,
  type Citation,
  type MediaItem,
  type Milestone,
} from "@/lib/admin/dosje";
import MediaThumb from "../_components/MediaThumb";

/**
 * One dossier, laid out the way it has to be checked.
 *
 * Each moment carries its own text, the citations behind it, and the pictures
 * and video attached to it -- rendered, not listed as URLs, because the whole
 * question an approver is answering is whether the image actually shows this
 * event. The dossier illustrated the 2013 NATO drawdown with a Bitcoin chart
 * once; that is not a mistake anyone catches from a link.
 *
 * The 383 articles that put the dossier on the site sit at the top, so the
 * subject can be judged against the coverage that produced it.
 */

export const dynamic = "force-dynamic";

export default async function DosjeTimelinePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!(await isAdminAuthed())) {
    return (
      <>
        <main className="mx-auto max-w-[1180px] px-3 py-4 sm:px-5">
          <p className="panel m-0 p-4 text-[13px] font-semibold">Hyr së pari.</p>
        </main>
      </>
    );
  }

  const { slug } = await params;
  const { topic, milestones, articles, topicMedia, mode, error } = await dosjeTimeline(slug);

  if (!error && !topic && milestones.length === 0) notFound();

  return (
    <>
      <main className="mx-auto max-w-[1180px] px-3 py-4 sm:px-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link href="/admin/dosje/pastro" className="btn btn-sm">
            <ArrowLeft size={14} strokeWidth={2.3} aria-hidden />
            Dosjet
          </Link>
          <h1 className="m-0 min-w-0 truncate text-[16px] font-black tracking-tight">
            {topic?.title ?? slug}
          </h1>
          {topic && (
            <span className={`pill ${topic.status === "approved" ? "pill-ok" : ""}`}>
              {topic.status}
            </span>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="panel m-0 mb-3 flex items-center gap-2 px-3 py-2.5 text-[13px] font-semibold"
            style={{ color: "var(--a-danger)", borderColor: "rgba(180,24,26,0.3)" }}
          >
            <AlertCircle size={15} aria-hidden />
            {error}
          </p>
        )}

        {mode !== "service" && (
          <p
            className="panel m-0 mb-3 flex items-start gap-2 px-3 py-2.5 text-[12px] font-semibold"
            style={{ color: "var(--a-warn)", borderColor: "rgba(245,158,11,0.4)" }}
          >
            <ShieldAlert size={15} aria-hidden className="mt-px shrink-0" />
            Pa SUPABASE_SERVICE_ROLE_KEY: RLS fsheh momentet dhe median në draft, prandaj kjo
            faqe mund të tregojë më pak se sa ekziston.
          </p>
        )}

        {topic && topic.blockers.length > 0 && (
          <div className="panel mb-3 p-3">
            <p className="label m-0 mb-1.5">Pse nuk publikohet</p>
            <div className="flex flex-wrap gap-1.5">
              {topic.blockers.map((b) => (
                <span key={b} className="pill pill-warn" title={BLOCKER_DETAIL[b]}>
                  {BLOCKER_LABELS[b]}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Which 383 coverage this dossier is built on. */}
        <section className="panel mb-3 p-3">
          <p className="label m-0 mb-2">
            Artikujt e 383-shit në këtë dosje ({articles.length})
          </p>
          {articles.length === 0 ? (
            <p className="m-0 text-[12px]" style={{ color: "var(--a-muted)" }}>
              Asnjë artikull nuk është klasifikuar ndonjëherë në këtë dosje, prandaj nuk ka
              mbulim që ta mbajë atë.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {articles.slice(0, 40).map((a) => (
                <li key={a.slug} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <Link
                    href={`/${a.slug}`}
                    target="_blank"
                    className="text-[13px] font-semibold no-underline hover:underline"
                    style={{ color: "var(--a-ink)" }}
                  >
                    {a.title}
                  </Link>
                  {a.source && (
                    <span className="text-[11px]" style={{ color: "var(--a-muted)" }}>
                      {a.source}
                    </span>
                  )}
                  <span className="tnum text-[11px]" style={{ color: "var(--a-faint)" }}>
                    {a.publishedLabel}
                  </span>
                  <span className="pill" title={`Përputhja: ${a.method}`}>
                    {a.method}
                    {a.score != null && <span className="tnum"> {a.score.toFixed(1)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {topicMedia.length > 0 && (
          <section className="panel mb-3 p-3">
            <p className="label m-0 mb-2">Media e dosjes ({topicMedia.length})</p>
            <MediaGrid items={topicMedia} />
          </section>
        )}

        <h2 className="m-0 mb-2 text-[13px] font-black">
          Kronologjia
          <span className="tnum ml-1.5 font-semibold" style={{ color: "var(--a-faint)" }}>
            {milestones.length}
          </span>
        </h2>

        {milestones.length === 0 ? (
          <div className="panel px-6 py-12 text-center" style={{ color: "var(--a-muted)" }}>
            <p className="m-0 text-[15px] font-bold" style={{ color: "var(--a-ink)" }}>
              Asnjë moment
            </p>
            <p className="m-0 mt-1 text-[13px]">
              Kjo dosje nuk ka ende asnjë moment të hartuar.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {milestones.map((m) => (
              <MilestoneCard key={m.id} milestone={m} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function MilestoneCard({ milestone: m }: { milestone: Milestone }) {
  return (
    <article className="panel p-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="tnum text-[12px] font-extrabold">{m.displayDate}</span>
        <span className={`pill ${m.status === "approved" ? "pill-ok" : ""}`}>{m.status}</span>
        {m.tag && <span className="pill">{m.tag}</span>}
        {/* 0051 refuses approval below two verified publishers with a trigger,
            so showing the count is showing the actual gate. */}
        <span
          className={`pill ${m.meetsSourceBar ? "pill-ok" : "pill-danger"}`}
          title="Dy botues të ndryshëm, të verifikuar me HTTP 200, janë kushti për miratim"
        >
          {m.meetsSourceBar ? <Check size={10} aria-hidden /> : <X size={10} aria-hidden />}
          {m.verifiedPublishers.length}/2 botues
        </span>
      </div>

      <h3 className="m-0 text-[14px] font-bold leading-[1.35]">{m.title}</h3>
      <p className="m-0 mt-1 whitespace-pre-line text-[13px] leading-[1.6]" style={{ color: "var(--a-muted)" }}>
        {m.summary}
      </p>
      {m.why && (
        <p
          className="m-0 mt-1.5 whitespace-pre-line text-[12px] leading-[1.6]"
          style={{ color: "var(--a-faint)" }}
        >
          <span className="label mr-1 inline">Pse ka rëndësi</span>
          {m.why}
        </p>
      )}

      {m.citations.length > 0 && (
        <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: "var(--a-border)" }}>
          <p className="label m-0 mb-1.5">Citimet ({m.citations.length})</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {m.citations.map((c) => (
              <CitationRow key={c.id} citation={c} />
            ))}
          </ul>
        </div>
      )}

      {m.media.length > 0 && (
        <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: "var(--a-border)" }}>
          <p className="label m-0 mb-2">Media e këtij momenti ({m.media.length})</p>
          <MediaGrid items={m.media} />
        </div>
      )}
    </article>
  );
}

function CitationRow({ citation: c }: { citation: Citation }) {
  return (
    <li className="text-[12px] leading-[1.5]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-bold">{c.publisher || "Pa botues"}</span>
        <span
          className={`pill ${c.verified ? "pill-ok" : "pill-danger"}`}
          title={
            c.verified
              ? "Rimarrë me sukses, prandaj numërohet për kushtin e dy botuesve"
              : "Nuk ka kthyer 200, prandaj nuk numërohet"
          }
        >
          {c.httpStatus ?? "pa provë"}
        </span>
        {c.supports && <span className="pill">{c.supports}</span>}
        {c.fetchedAtLabel && (
          <span className="tnum text-[11px]" style={{ color: "var(--a-faint)" }}>
            {c.fetchedAtLabel}
          </span>
        )}
      </div>

      {c.sourceTitle && <p className="m-0 mt-0.5 font-semibold">{c.sourceTitle}</p>}
      {c.quote && (
        <blockquote
          className="m-0 mt-1 border-l pl-2 italic"
          style={{ borderColor: "var(--a-border-strong)", color: "var(--a-muted)" }}
        >
          {c.quote}
        </blockquote>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <a
          href={c.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 break-all no-underline hover:underline"
          style={{ color: "var(--a-accent-fill)" }}
        >
          <ExternalLink size={11} aria-hidden className="shrink-0" />
          Burimi
        </a>
        {c.archiveUrl && (
          /* 0063 keeps the Wayback snapshot beside the canonical url rather
             than replacing it, so dead links stay checkable. */
          <a
            href={c.archiveUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 no-underline hover:underline"
            style={{ color: "var(--a-muted)" }}
          >
            <Archive size={11} aria-hidden className="shrink-0" />
            Arkivi
          </a>
        )}
      </div>
    </li>
  );
}

/**
 * Media rendered rather than linked.
 *
 * The approver's question is whether this picture is of this event, which
 * cannot be answered from a URL. Videos show their YouTube poster frame for
 * the same reason.
 */
function MediaGrid({ items }: { items: MediaItem[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-2.5 p-0 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => {
        const vid = item.kind === "video" ? youtubeId(item.url) : null;
        const poster = vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : item.url;
        const dead = item.checkStatus != null && item.checkStatus !== 200;

        return (
          <li key={item.id} className="min-w-0">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-[8px] no-underline"
              style={{ border: "1px solid var(--a-border)", background: "var(--a-panel-3)" }}
            >
              <MediaThumb
                src={poster}
                alt={item.credit ?? ""}
                isVideo={item.kind === "video"}
              />
            </a>

            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className={`pill ${item.approved ? "pill-ok" : "pill-warn"}`}>
                {item.approved ? "E miratuar" : "Pa miratim"}
              </span>
              {/* 0051 allows only contemporaneous_coverage or explainer, so an
                  image claiming to document its own event is distinguishable
                  from one that merely illustrates the subject. */}
              {item.relation && (
                <span
                  className={`pill ${item.relation === "contemporaneous_coverage" ? "" : "pill-warn"}`}
                  title={
                    item.relation === "contemporaneous_coverage"
                      ? "Pretendon se dokumenton vetë ngjarjen"
                      : "Vetëm ilustrim, jo mbulim i ngjarjes"
                  }
                >
                  {item.relation === "contemporaneous_coverage" ? "Mbulim" : "Shpjegues"}
                </span>
              )}
              {dead && (
                <span className="pill pill-danger" title={item.checkedAtLabel ?? undefined}>
                  {item.checkStatus}
                </span>
              )}
            </div>

            {item.credit && (
              <p
                className="m-0 mt-0.5 line-clamp-2 text-[11px] leading-[1.4]"
                style={{ color: "var(--a-faint)" }}
              >
                {item.credit}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
