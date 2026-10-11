"use client";

// The pages of the reader's paper, drawn as print (app/per-ty/paper/newspaper.css):
//
//   FrontSheet    nameplate with the reader's title, the giant word of why the
//                 lead leads, the lead in a spot-colour banner over its photo,
//                 the next stories in columns, and the rail: "Në këtë numër"
//                 (tap a page to turn to it), the town box, Dardani's brief
//   MoreSheet     the rest of the day's edition
//   SectionSheet  one page per follow: "SPORT", why it is in the paper, its
//                 stories, and "more / less of this"
//   BackSheet     the back page; its contents come from the feed
//
// Every story carries one plain line saying why it is there. Tapping the line
// opens the longer reason and "Më shumë si kjo / Më pak si kjo". A shared copy
// (/gazeta) passes `readOnly`: no reasons, no read marks — those are the
// sharer's, not the friend's.

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import TimeAgo from "@/components/time-ago";
import { isNewSince } from "@/lib/perty-visits.mjs";
import type { FeedArticle } from "../per-ty-feed";

export type Why = { short: string; long: string; key: string | null; picked: boolean };
export type PaperStory = { article: FeedArticle & { coverArt?: string | null }; why: Why | null };
export type Pace = "short" | "medium" | "long";
export type Seen = { since: string | null; read: ReadonlySet<string> };
export const NO_SEEN: Seen = { since: null, read: new Set() };

/** What every page knows about the paper itself. */
export type PaperMeta = {
  /** "Kurieri i Lindit" */
  title: string;
  onRename?: () => void;
  motto: string;
  /** "Botimi i mëngjesit" */
  edition: string;
  issue: number;
  /** "e shtunë, 11 tetor" */
  date: string;
  year: number;
  /** Up to three of the reader's follows, by name, for the ear. */
  follows: string[];
  count: number;
  minutes: number;
  total: number;
  readOnly: boolean;
  pace: Pace;
  seen: Seen;
  /** "Më shumë / Më pak" on a follow; absent on a shared copy. */
  onTaste?: (key: string, more: boolean) => void;
};

const MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];

/** Day and month of a story, in Kosovo. */
function dayMonth(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Belgrade", day: "numeric", month: "numeric" })
      .formatToParts(d)
      .map((p) => [p.type, p.value])
  );
  return { day: parts.day, month: MONTHS[Number(parts.month) - 1] ?? "" };
}

function excerptFor(text: string | undefined, pace: Pace, size: "lead" | "column" | "side") {
  const t = (text ?? "").trim();
  if (!t) return "";
  if (size === "lead") return t;
  if (pace === "short") return "";
  if (pace === "medium" && t.length > 150) return `${t.slice(0, 150).replace(/\s+\S*$/, "")}…`;
  return t;
}

/** Decorative barcode from a seed, so every page's differs. */
function Barcode({ seed }: { seed: string }) {
  let h = 2166136261;
  const bars: number[] = [];
  for (let i = 0; i < 30; i++) {
    h = Math.imul(h ^ (seed.charCodeAt(i % Math.max(1, seed.length)) + i), 16777619) >>> 0;
    bars.push(1 + (h % 3));
  }
  let x = 0;
  return (
    <svg className="np-barcode" viewBox="0 0 92 22" preserveAspectRatio="none" aria-hidden="true">
      {bars.map((w, i) => {
        const rect = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={22} /> : null;
        x += w + 1;
        return rect;
      })}
    </svg>
  );
}

function Foot({ meta, n }: { meta: PaperMeta; n: number }) {
  return (
    <footer className="np-foot">
      <span>{meta.readOnly ? "Kopje e ndarë" : "Kopje personale"} · {meta.title}</span>
      <span>383ks.com · Për ty</span>
      <span>
        Faqja {n} nga {meta.total}
      </span>
      <Barcode seed={`${meta.date}|${n}|${meta.title}`} />
    </footer>
  );
}

function Runhead({ meta, n, title }: { meta: PaperMeta; n: number; title: string }) {
  return (
    <div className="np-runhead">
      <span>
        Faqja {n} · {title}
      </span>
      <b>{meta.title}</b>
      <span>{meta.date}</span>
    </div>
  );
}

/** The plain reason, and behind it the long one with "more / less". */
export function WhyNote({ why, onTaste }: { why: Why; onTaste?: (key: string, more: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState<null | "more" | "less">(null);
  return (
    <>
      <button type="button" className="np-why" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {why.short}
      </button>
      {open && (
        <div className="np-whybox" role="note">
          <p>{why.long}</p>
          {said ? (
            <p className="np-whybox-done" role="status">
              {said === "more" ? "Mirë. Do të shohësh më shumë si kjo." : "Mirë. Do të shohësh më pak si kjo."}
            </p>
          ) : why.key && onTaste ? (
            <div className="np-whybox-actions">
              <button
                type="button"
                className="np-btn"
                onClick={() => {
                  onTaste(why.key as string, true);
                  setSaid("more");
                }}
              >
                Më shumë si kjo
              </button>
              <button
                type="button"
                className="np-btn np-btn--ghost"
                onClick={() => {
                  onTaste(why.key as string, false);
                  setSaid("less");
                }}
              >
                Më pak si kjo
              </button>
            </div>
          ) : null}
          <button type="button" className="np-why" onClick={() => setOpen(false)}>
            Mbyll
          </button>
        </div>
      )}
    </>
  );
}

function Mark({ article, seen, readOnly }: { article: FeedArticle; seen: Seen; readOnly: boolean }) {
  if (readOnly) return null;
  if (seen.read.has(article.slug)) return <span className="np-mark np-mark--read">Lexuar</span>;
  if (isNewSince(article, seen.since)) return <span className="np-mark np-mark--new">E re</span>;
  return null;
}

function Photo({ src, sizes, className = "", plate = false, priority = false }: { src: string; sizes: string; className?: string; plate?: boolean; priority?: boolean }) {
  return (
    <span className={`np-photo${plate ? " np-photo--plate" : ""} ${className}`}>
      <Image src={src} alt="" fill sizes={sizes} priority={priority} style={{ objectFit: "cover" }} />
      {plate && <small className="np-photo-credit">Ilustrim me AI</small>}
    </span>
  );
}

/** One story in print: why, headline, opening lines, time. */
function StoryBlock({
  story,
  meta,
  size,
  n,
  photo = false,
}: {
  story: PaperStory;
  meta: PaperMeta;
  size: "column" | "side" | "lead";
  n?: number;
  photo?: boolean;
}) {
  const { article, why } = story;
  const isRead = !meta.readOnly && meta.seen.read.has(article.slug);
  const text = excerptFor(article.excerpt, meta.pace, size);
  return (
    <article className={size === "lead" ? "np-seclead" : "np-story"} data-read={isRead || undefined}>
      {photo && article.imageUrl && (
        <Link href={`/article/${article.slug}`} tabIndex={-1} aria-hidden="true">
          <Photo
            src={article.imageUrl}
            className={size === "lead" ? "" : "np-story-photo"}
            sizes={size === "lead" ? "(max-width: 720px) 100vw, 60vw" : "(max-width: 720px) 100vw, 30vw"}
          />
        </Link>
      )}
      {n !== undefined && <span className="np-story-n" aria-hidden="true">{n}</span>}
      <div className="np-kicker">
        {why && !meta.readOnly ? <WhyNote why={why} onTaste={meta.onTaste} /> : <span>{article.category}</span>}
        <Mark article={article} seen={meta.seen} readOnly={meta.readOnly} />
      </div>
      <h3 className="np-head">
        <Link href={`/article/${article.slug}`}>{article.title}</Link>
      </h3>
      {text && <p className="np-text">{text}</p>}
      <p className="np-meta">
        {article.category} · <TimeAgo iso={article.publishedAt} />
      </p>
    </article>
  );
}

export function Nameplate({ meta }: { meta: PaperMeta }) {
  return (
    <header>
      <div className="np-plate">
        <div className="np-ear">
          {meta.readOnly ? "E ndarë nga" : "Ndjek"}
          <b>{meta.follows[0] ?? "383"}</b>
          {meta.follows.slice(1, 3).join(" · ")}
        </div>
        <h1 className="np-name">
          {meta.onRename && !meta.readOnly ? (
            <button type="button" onClick={meta.onRename} aria-label={`${meta.title}. Ndrysho emrin`}>
              {meta.title}
            </button>
          ) : (
            meta.title
          )}
        </h1>
        <div className="np-ear np-ear--ink">
          {meta.edition}
          <b>{meta.issue > 0 ? `Nr. ${meta.issue}` : meta.year}</b>
          {meta.count} lajme · {meta.minutes} min
        </div>
      </div>
      <p className="np-motto">{meta.motto}</p>
      <div className="np-dateline">
        <span>{meta.date}, {meta.year}</span>
        <span>{meta.edition}</span>
        <span>{meta.readOnly ? "Kopje e ndarë" : "Bërë vetëm për ty"}</span>
        <span>383ks.com</span>
      </div>
    </header>
  );
}

export function FrontSheet({
  meta,
  lead,
  leadWord,
  stories,
  contents,
  onJump,
  rail,
  before,
  stamp,
}: {
  meta: PaperMeta;
  lead: PaperStory | null;
  /** "KURTI": why the lead leads this reader's paper. */
  leadWord: string;
  stories: PaperStory[];
  contents: { n: number; title: string }[];
  onJump: (n: number) => void;
  /** Boxes under the contents: town, Dardani's brief, numbers. */
  rail?: ReactNode;
  /** Notes clipped above the page: how it works, the paper changed, Dardani asks. */
  before?: ReactNode;
  stamp: ReactNode;
}) {
  const art = lead ? lead.article.coverArt || lead.article.imageUrl || null : null;
  const when = lead ? dayMonth(lead.article.publishedAt) : null;
  return (
    <div className="np-sheet">
      {before}
      <Nameplate meta={meta} />

      <div className="np-front">
        <div className="np-front-main">
          {lead ? (
            <>
              {leadWord && (
                <p className="np-word" aria-hidden="true" style={{ "--np-word-len": leadWord.length } as React.CSSProperties}>
                  {leadWord}
                </p>
              )}
              <Link href={`/article/${lead.article.slug}`} className="np-banner">
                {lead.article.title}
              </Link>
              <div className="np-lead">
                <div className="np-stamp" aria-hidden="true">
                  {stamp}
                </div>
                <div className="np-lead-box">
                  <span>Lajmi kryesor</span>
                  {when && <strong>{when.day}</strong>}
                  {when && <span>{when.month}</span>}
                  <hr />
                  <em>
                    <TimeAgo iso={lead.article.publishedAt} />
                  </em>
                  <span>{lead.article.category}</span>
                </div>
                {art ? (
                  <Link href={`/article/${lead.article.slug}`} tabIndex={-1} aria-hidden="true">
                    <Photo src={art} className="np-lead-photo" plate={Boolean(lead.article.coverArt)} priority sizes="(max-width: 720px) 100vw, 60vw" />
                  </Link>
                ) : null}
              </div>
              <div className="np-lead-text">
                <div className="np-kicker" style={{ marginBottom: 8 }}>
                  {lead.why && !meta.readOnly ? <WhyNote why={lead.why} onTaste={meta.onTaste} /> : null}
                  <Mark article={lead.article} seen={meta.seen} readOnly={meta.readOnly} />
                </div>
                {lead.article.excerpt && <p className="np-text np-text--lead">{lead.article.excerpt}</p>}
                <Link href={`/article/${lead.article.slug}`} className="np-more-link">
                  Lexo lajmin e plotë <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
                </Link>
              </div>
            </>
          ) : (
            <p className="np-text">Sot s&apos;ka ende lajme për zgjedhjet e tua.</p>
          )}

          {stories.length > 0 && (
            <div className="np-columns">
              {stories.map((s, i) => (
                <StoryBlock key={s.article.slug} story={s} meta={meta} size="column" n={i + 2} photo={i < 2} />
              ))}
            </div>
          )}
        </div>

        <aside className="np-rail" aria-label="Në këtë numër">
          {contents.length > 0 && (
            <section className="np-box np-box--ink">
              <h2 className="np-box-title">Në këtë numër</h2>
              <ul className="np-contents">
                {contents.map((c) => (
                  <li key={c.n}>
                    <button type="button" onClick={() => onJump(c.n)}>
                      <b>Faqja {c.n}</b>
                      <span>{c.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="np-box-hint" style={{ color: "inherit", opacity: 0.75 }}>
                Prek një faqe, ose kthe faqen me këndin poshtë djathtas.
              </p>
            </section>
          )}
          {rail}
        </aside>
      </div>

      <Foot meta={meta} n={1} />
    </div>
  );
}

export function MoreSheet({ meta, n, stories, from }: { meta: PaperMeta; n: number; stories: PaperStory[]; from: number }) {
  return (
    <div className="np-sheet">
      <Runhead meta={meta} n={n} title="Më shumë nga sot" />
      <div className="np-sechead">
        <h2>Më shumë nga sot</h2>
        <p>Lajmet e tjera të ditës për ato që ndjek, sipas rëndësisë.</p>
      </div>
      <div className="np-moregrid">
        {stories.map((s, i) => (
          <StoryBlock key={s.article.slug} story={s} meta={meta} size="column" n={from + i} photo={i < 3} />
        ))}
      </div>
      <Foot meta={meta} n={n} />
    </div>
  );
}

export function SectionSheet({
  meta,
  n,
  title,
  sectionKey,
  href,
  intro,
  stories,
}: {
  meta: PaperMeta;
  n: number;
  title: string;
  sectionKey: string;
  href: string;
  /** "E zgjodhe Sport kur e bëre gazetën. Kohët e fundit ke lexuar 6 lajme…" */
  intro: string;
  stories: PaperStory[];
}) {
  const [first, ...rest] = stories;
  const [said, setSaid] = useState<null | "more" | "less">(null);
  return (
    <div className="np-sheet">
      <Runhead meta={meta} n={n} title={title} />
      <div className="np-sechead">
        <h2>{title}</h2>
        {!meta.readOnly && intro && <p>{intro}</p>}
      </div>
      <div className={`np-secgrid${rest.length === 0 ? " np-secgrid--solo" : ""}`}>
        {first && <StoryBlock story={first} meta={meta} size="lead" photo />}
        {rest.length > 0 && (
          <div className="np-secside">
            {rest.map((s) => (
              <StoryBlock key={s.article.slug} story={s} meta={meta} size="side" />
            ))}
          </div>
        )}
      </div>
      <div className="np-secfoot">
        <Link href={href} className="np-more-link">
          Të gjitha për {title} <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
        </Link>
        {!meta.readOnly && meta.onTaste && (
          <div className="np-secfoot-actions">
            {said ? (
              <p role="status">{said === "more" ? `Mirë, më shumë ${title}.` : `Mirë, më pak ${title}.`}</p>
            ) : (
              <>
                <p>A të pëlqen kjo faqe?</p>
                <button
                  type="button"
                  className="np-btn np-btn--ghost"
                  onClick={() => {
                    meta.onTaste?.(sectionKey, true);
                    setSaid("more");
                  }}
                >
                  Më shumë {title}
                </button>
                <button
                  type="button"
                  className="np-btn np-btn--ghost"
                  onClick={() => {
                    meta.onTaste?.(sectionKey, false);
                    setSaid("less");
                  }}
                >
                  Më pak
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <Foot meta={meta} n={n} />
    </div>
  );
}

export function BackSheet({ meta, n, children }: { meta: PaperMeta; n: number; children: ReactNode }) {
  return (
    <div className="np-sheet">
      <Runhead meta={meta} n={n} title="Faqja e fundit" />
      <div className="np-back">{children}</div>
      <Foot meta={meta} n={n} />
    </div>
  );
}
