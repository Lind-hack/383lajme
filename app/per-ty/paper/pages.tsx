"use client";

// The pages of the reader's paper (app/per-ty/paper/newspaper.css). Each one
// fits a screen: photos take the room that is left and text is cut to whole
// lines, so nothing has to be scrolled.
//
//   FrontSheet    nameplate with the reader's title, the lead with its photo,
//                 the next three stories in a row
//   IndexSheet    "Në këtë numër": every page (tap to turn there), and the
//                 small boxes — Dardani's thirty seconds, the town, numbers
//   MoreSheet     four more of the day's edition
//   SectionSheet  one page per follow: its name, why it is in the paper, its
//                 stories, and "more / less of this"
//   EndSheet      the back pages; their contents come from the feed
//
// Every story carries one short line saying why it is there. Tapping it opens
// the longer reason and "Më shumë si kjo / Më pak si kjo". A shared copy
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
  /** "Gazeta e Lindit" */
  title: string;
  /** Tapping the nameplate: rename the paper. Absent on a shared copy. */
  onRename?: () => void;
  /** "Botimi i mëngjesit", or "E ndarë nga Lindi" on a shared copy. */
  edition: string;
  issue: number;
  /** "e shtunë, 11 tetor" */
  date: string;
  year: number;
  /** Up to three of the reader's follows, by name. */
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

function Foot({ meta, n }: { meta: PaperMeta; n: number }) {
  return (
    <footer className="np-foot">
      <b>{n}</b>
      <span>{meta.title}</span>
      <span>{meta.date}</span>
    </footer>
  );
}

function Runhead({ meta, kicker, title, children }: { meta: PaperMeta; kicker: string; title: string; children?: ReactNode }) {
  return (
    <header className="np-runhead">
      <p className="np-runhead-kicker">
        <span>{kicker}</span>
        <span>{meta.title}</span>
      </p>
      <h2 className="np-runhead-title">{title}</h2>
      {children}
    </header>
  );
}

/** The short reason, and behind it the long one with "more / less". */
export function WhyNote({ why, onTaste }: { why: Why; onTaste?: (key: string, more: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState<null | "more" | "less">(null);
  return (
    <span className="np-whywrap">
      <button type="button" className="np-why" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {why.short}
      </button>
      {open && (
        <span className="np-whybox" role="note" data-no-flip>
          <span className="np-whybox-text">{why.long}</span>
          {said ? (
            <span className="np-whybox-done" role="status">
              {said === "more" ? "Mirë. Do të shohësh më shumë si kjo." : "Mirë. Do të shohësh më pak si kjo."}
            </span>
          ) : why.key && onTaste ? (
            <span className="np-whybox-actions">
              <button
                type="button"
                className="np-btn np-btn--small"
                onClick={() => {
                  onTaste(why.key as string, true);
                  setSaid("more");
                }}
              >
                Më shumë si kjo
              </button>
              <button
                type="button"
                className="np-btn np-btn--small np-btn--ghost"
                onClick={() => {
                  onTaste(why.key as string, false);
                  setSaid("less");
                }}
              >
                Më pak
              </button>
            </span>
          ) : null}
          <button type="button" className="np-whybox-close" onClick={() => setOpen(false)}>
            Mbyll
          </button>
        </span>
      )}
    </span>
  );
}

function Mark({ article, seen, readOnly }: { article: FeedArticle; seen: Seen; readOnly: boolean }) {
  if (readOnly) return null;
  if (seen.read.has(article.slug)) return <span className="np-mark">Lexuar</span>;
  if (isNewSince(article, seen.since)) return <span className="np-mark np-mark--new">E re</span>;
  return null;
}

/**
 * A story's picture. Loaded eagerly: lazy loading never starts inside the
 * turned-page layers, and the paper already draws only the open spread and its
 * neighbours. A picture that fails to load leaves its room to the text.
 */
function Photo({ article, sizes, priority = false }: { article: PaperStory["article"]; sizes: string; priority?: boolean }) {
  const src = article.coverArt || article.imageUrl;
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <Link href={`/article/${article.slug}`} className="np-photo" tabIndex={-1} aria-hidden="true">
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "eager"}
        style={{ objectFit: "cover" }}
        draggable={false}
        onError={() => setFailed(true)}
      />
      {article.coverArt && <small className="np-photo-credit">Ilustrim me AI</small>}
    </Link>
  );
}

function Kicker({ story, meta }: { story: PaperStory; meta: PaperMeta }) {
  return (
    <div className="np-kicker">
      {story.why && !meta.readOnly ? <WhyNote why={story.why} onTaste={meta.onTaste} /> : <span className="np-cat">{story.article.category}</span>}
      <Mark article={story.article} seen={meta.seen} readOnly={meta.readOnly} />
    </div>
  );
}

/** One story: why, headline, opening lines, time. `photo` puts its picture on top. */
function StoryBlock({ story, meta, photo = false, sizes = "(max-width: 960px) 50vw, 22vw" }: { story: PaperStory; meta: PaperMeta; photo?: boolean; sizes?: string }) {
  const { article } = story;
  const isRead = !meta.readOnly && meta.seen.read.has(article.slug);
  return (
    <article className="np-story" data-read={isRead || undefined} data-photo={photo && (article.coverArt || article.imageUrl) ? "" : undefined}>
      {photo && <Photo article={article} sizes={sizes} />}
      <Kicker story={story} meta={meta} />
      <h3 className="np-head">
        <Link href={`/article/${article.slug}`} draggable={false}>
          {article.title}
        </Link>
      </h3>
      {article.excerpt && <p className="np-text">{article.excerpt}</p>}
      <p className="np-meta">
        <TimeAgo iso={article.publishedAt} />
      </p>
    </article>
  );
}

export function FrontSheet({ meta, lead, stories }: { meta: PaperMeta; lead: PaperStory | null; stories: PaperStory[] }) {
  return (
    <div className="np-sheet np-sheet--front" data-pace={meta.pace}>
      <header className="np-plate">
        <p className="np-plate-top">
          <span>
            {meta.date}, {meta.year}
          </span>
          <span>{meta.issue > 0 ? `${meta.edition} · Nr. ${meta.issue}` : meta.edition}</span>
        </p>
        <h1 className="np-name">
          {meta.onRename && !meta.readOnly ? (
            <button type="button" onClick={meta.onRename} aria-label={`${meta.title}. Ndrysho emrin`}>
              {meta.title}
            </button>
          ) : (
            meta.title
          )}
        </h1>
        <p className="np-plate-sub">
          <span>{meta.follows.length ? `${meta.readOnly ? "Ndjek" : "Për"} ${meta.follows.join(" · ")}` : "Lajmet e tua"}</span>
          <span>
            {meta.count === 1 ? "1 lajm" : `${meta.count} lajme`} · {meta.minutes} min lexim
          </span>
        </p>
      </header>

      <div className="np-body np-front">
        {lead ? (
          <article className="np-lead" data-read={(!meta.readOnly && meta.seen.read.has(lead.article.slug)) || undefined}>
            <Kicker story={lead} meta={meta} />
            <h2 className="np-lead-head">
              <Link href={`/article/${lead.article.slug}`} draggable={false}>
                {lead.article.title}
              </Link>
            </h2>
            <Photo article={lead.article} sizes="(max-width: 960px) 100vw, 46vw" priority />
            {lead.article.excerpt && <p className="np-text np-text--lead">{lead.article.excerpt}</p>}
          </article>
        ) : (
          <p className="np-text">Sot s&apos;ka ende lajme për zgjedhjet e tua.</p>
        )}
        {stories.length > 0 && (
          <div className="np-row">
            {stories.map((s) => (
              <StoryBlock key={s.article.slug} story={s} meta={meta} />
            ))}
          </div>
        )}
      </div>
      <Foot meta={meta} n={1} />
    </div>
  );
}

export function IndexSheet({
  meta,
  n,
  contents,
  onJump,
  children,
}: {
  meta: PaperMeta;
  n: number;
  contents: { n: number; title: string; count: number }[];
  onJump: (n: number) => void;
  /** The boxes: Dardani's thirty seconds, the town, the numbers. */
  children?: ReactNode;
}) {
  return (
    <div className="np-sheet" data-pace={meta.pace}>
      <Runhead meta={meta} kicker={`Faqja ${n}`} title="Në këtë numër" />
      <div className="np-body np-index">
        <ol className="np-contents">
          {contents.map((c) => (
            <li key={c.n}>
              <button type="button" onClick={() => onJump(c.n)}>
                <b>{c.n}</b>
                <span>{c.title}</span>
                {c.count > 0 && <i>{c.count === 1 ? "1 lajm" : `${c.count} lajme`}</i>}
                <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
        {children && <div className="np-boxes">{children}</div>}
      </div>
      <Foot meta={meta} n={n} />
    </div>
  );
}

export function MoreSheet({ meta, n, title = "Më shumë nga sot", stories }: { meta: PaperMeta; n: number; title?: string; stories: PaperStory[] }) {
  return (
    <div className="np-sheet" data-pace={meta.pace}>
      <Runhead meta={meta} kicker={`Faqja ${n}`} title={title} />
      <div className="np-body np-grid" data-count={stories.length}>
        {stories.map((s) => (
          <StoryBlock key={s.article.slug} story={s} meta={meta} photo />
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
  hidden,
}: {
  meta: PaperMeta;
  n: number;
  title: string;
  sectionKey: string;
  href: string;
  /** "E zgjodhe Sport kur e bëre gazetën." */
  intro: string;
  stories: PaperStory[];
  /** Stories of this follow that did not fit on the page. */
  hidden: number;
}) {
  const [first, ...rest] = stories;
  const [said, setSaid] = useState<null | "more" | "less">(null);
  return (
    <div className="np-sheet" data-pace={meta.pace}>
      <Runhead meta={meta} kicker={`Faqja ${n}`} title={title}>
        {!meta.readOnly && intro && <p className="np-runhead-intro">{intro}</p>}
      </Runhead>
      <div className={`np-body np-section${rest.length === 0 ? " np-section--solo" : ""}`}>
        {first && <StoryBlock story={first} meta={meta} photo sizes="(max-width: 960px) 100vw, 46vw" />}
        {rest.length > 0 && (
          <div className="np-side">
            {rest.map((s) => (
              <StoryBlock key={s.article.slug} story={s} meta={meta} />
            ))}
          </div>
        )}
      </div>
      <div className="np-secfoot">
        <Link href={href} className="np-link" draggable={false}>
          {hidden > 0 ? `Edhe ${hidden} për ${title}` : `Të gjitha për ${title}`} <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
        </Link>
        {!meta.readOnly && meta.onTaste &&
          (said ? (
            <p role="status">{said === "more" ? `Mirë, më shumë ${title}.` : `Mirë, më pak ${title}.`}</p>
          ) : (
            <span className="np-secfoot-taste">
              <button
                type="button"
                className="np-btn np-btn--small np-btn--ghost"
                onClick={() => {
                  meta.onTaste?.(sectionKey, true);
                  setSaid("more");
                }}
              >
                Më shumë
              </button>
              <button
                type="button"
                className="np-btn np-btn--small np-btn--ghost"
                onClick={() => {
                  meta.onTaste?.(sectionKey, false);
                  setSaid("less");
                }}
              >
                Më pak
              </button>
            </span>
          ))}
      </div>
      <Foot meta={meta} n={n} />
    </div>
  );
}

export function EndSheet({ meta, n, kicker, title, children }: { meta: PaperMeta; n: number; kicker?: string; title: string; children: ReactNode }) {
  return (
    <div className="np-sheet" data-pace={meta.pace}>
      <Runhead meta={meta} kicker={kicker ?? `Faqja ${n}`} title={title} />
      <div className="np-body np-end">{children}</div>
      <Foot meta={meta} n={n} />
    </div>
  );
}
