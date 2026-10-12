"use client";

// The screens of the reader's reel (app/per-ty/paper/reel.tsx, reel.css):
//
//   CoverSlide    the paper's name over the lead's photo, how much is in it,
//                 the top three headlines and "Fillo"
//   StorySlide    one story, full screen: the photo, and over it why it is
//                 here, the headline, two lines, "Lexo lajmin"; down the right
//                 side the reader's buttons — more of this, less of this, share,
//                 why
//   SectionSlide  a follow's own screen in its colour: what it is, why it is in
//                 the paper, how many stories, more / less of it
//   PanelSlide    a light screen for the boxes and the end of the paper
//
// A shared copy (/gazeta) passes `readOnly`: no reasons, no read marks, no
// "more / less" — those are the sharer's, not the friend's.

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ChevronUp, Info, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import TimeAgo from "@/components/time-ago";
import { isNewSince } from "@/lib/perty-visits.mjs";
import type { FeedArticle } from "../per-ty-feed";

export type Why = { short: string; long: string; key: string | null; picked: boolean };
export type PaperStory = { article: FeedArticle & { coverArt?: string | null }; why: Why | null };
export type Seen = { since: string | null; read: ReadonlySet<string> };
export const NO_SEEN: Seen = { since: null, read: new Set() };

/** What every screen knows about the paper itself. */
export type ReelMeta = {
  readOnly: boolean;
  /** How long the opening lines run, from how long the reader stays on a story. */
  pace?: "short" | "medium" | "long";
  seen: Seen;
  /** "Më shumë / Më pak"; absent on a shared copy. */
  onTaste?: (key: string, more: boolean) => void;
};

const photoOf = (a: PaperStory["article"]) => a.coverArt || a.imageUrl || null;

/** Share one story: the system sheet on a phone, the clipboard elsewhere. */
async function shareStory(article: FeedArticle): Promise<string | null> {
  const url = `${window.location.origin}/article/${article.slug}`;
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ title: article.title, url });
      return null;
    }
    await navigator.clipboard.writeText(url);
    return "Lidhja u kopjua";
  } catch {
    return null;
  }
}

function Backdrop({ src, priority = false, blur = false }: { src: string | null; priority?: boolean; blur?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes="(min-width: 1024px) 70vw, 100vw"
      priority={priority}
      className={`fy-bg${blur ? " fy-bg--blur" : ""}`}
      style={{ objectFit: "cover" }}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

export function CoverSlide({
  title,
  onRename,
  kicker,
  line,
  photo,
  heads,
  start,
  children,
}: {
  title: string;
  onRename?: () => void;
  /** "E hënë, 12 tetor · Botimi i mëngjesit · Nr. 4", or who shared it. */
  kicker: string;
  /** "7 lajme · 3 min · për Prishtinë, Albin Kurti, Sport" */
  line: string;
  photo: string | null;
  /** The first headlines, each turning to its screen. */
  heads: { title: string; href: string }[];
  start: { label: string; href: string };
  children?: ReactNode;
}) {
  return (
    <div className="fy-cover">
      <Backdrop src={photo} priority />
      <div className="fy-shade fy-shade--cover" />
      <div className="fy-cover-body">
        <p className="fy-cover-kicker">{kicker}</p>
        <h1 className="fy-cover-name">
          {onRename ? (
            <button type="button" onClick={onRename} aria-label={`${title}. Ndrysho emrin`}>
              {title}
            </button>
          ) : (
            title
          )}
        </h1>
        <p className="fy-cover-line">{line}</p>
        {heads.length > 0 && (
          <ol className="fy-cover-heads">
            {heads.map((h) => (
              <li key={h.href}>
                <a href={h.href}>{h.title}</a>
              </li>
            ))}
          </ol>
        )}
        <div className="fy-cover-actions">
          <a href={start.href} className="fy-btn fy-btn--light">
            {start.label} <ChevronUp size={17} strokeWidth={2.6} aria-hidden="true" />
          </a>
          {children}
        </div>
      </div>
    </div>
  );
}

function Toast({ text }: { text: string | null }) {
  return (
    <p className="fy-toast" role="status" data-on={text ? "" : undefined}>
      {text}
    </p>
  );
}

export function StorySlide({ story, meta, eager = false }: { story: PaperStory; meta: ReelMeta; eager?: boolean }) {
  const { article, why } = story;
  const photo = photoOf(article);
  const [open, setOpen] = useState(false);
  const [taste, setTaste] = useState<null | "more" | "less">(null);
  const [toast, setToast] = useState<string | null>(null);
  const isRead = !meta.readOnly && meta.seen.read.has(article.slug);
  const isNew = !meta.readOnly && !isRead && isNewSince(article, meta.seen.since);
  const canTaste = !meta.readOnly && Boolean(why?.key && meta.onTaste);
  const href = `/article/${article.slug}`;

  const say = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 2200);
  };
  const vote = (more: boolean) => {
    if (!why?.key || !meta.onTaste) return;
    meta.onTaste(why.key, more);
    setTaste(more ? "more" : "less");
    say(more ? "Do të shohësh më shumë si kjo" : "Do të shohësh më pak si kjo");
  };

  return (
    <div className="fy-story" data-photo={photo ? "" : undefined} data-read={isRead || undefined} data-pace={meta.pace}>
      <Backdrop src={photo} priority={eager} />
      <div className="fy-shade" />
      {article.coverArt && <small className="fy-credit">Ilustrim me AI</small>}

      <div className="fy-story-body">
        <p className="fy-kicker">
          {why && !meta.readOnly ? (
            <button type="button" className="fy-why" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {why.short}
            </button>
          ) : (
            <span className="fy-why fy-why--plain">{article.category}</span>
          )}
          {isRead && <span className="fy-mark">Lexuar</span>}
          {isNew && <span className="fy-mark fy-mark--new">E re</span>}
        </p>
        <h2 className="fy-head">
          <Link href={href}>{article.title}</Link>
        </h2>
        {article.excerpt && <p className="fy-text">{article.excerpt}</p>}
        <div className="fy-story-foot">
          <Link href={href} className="fy-btn fy-btn--light">
            Lexo lajmin <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
          </Link>
          <span className="fy-meta">
            {article.category} · <TimeAgo iso={article.publishedAt} />
          </span>
        </div>
      </div>

      <div className="fy-actions">
        {canTaste && (
          <>
            <button type="button" className="fy-act" onClick={() => vote(true)} aria-pressed={taste === "more"} aria-label="Më shumë si kjo">
              <ThumbsUp size={22} strokeWidth={2.2} aria-hidden="true" />
              <span aria-hidden="true">Më shumë</span>
            </button>
            <button type="button" className="fy-act" onClick={() => vote(false)} aria-pressed={taste === "less"} aria-label="Më pak si kjo">
              <ThumbsDown size={22} strokeWidth={2.2} aria-hidden="true" />
              <span aria-hidden="true">Më pak</span>
            </button>
          </>
        )}
        <button
          type="button"
          className="fy-act"
          onClick={async () => {
            const said = await shareStory(article);
            if (said) say(said);
          }}
          aria-label="Ndaje këtë lajm"
        >
          <Share2 size={22} strokeWidth={2.2} aria-hidden="true" />
          <span aria-hidden="true">Ndaje</span>
        </button>
        {why && !meta.readOnly && (
          <button type="button" className="fy-act" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Pse e sheh këtë lajm?">
            <Info size={22} strokeWidth={2.2} aria-hidden="true" />
            <span aria-hidden="true">Pse?</span>
          </button>
        )}
      </div>

      {open && why && (
        <div className="fy-whysheet" role="note">
          <p className="fy-whysheet-title">Pse e sheh këtë?</p>
          <p>{why.long}</p>
          {canTaste && (
            <div className="fy-whysheet-actions">
              <button type="button" className="fy-btn fy-btn--light fy-btn--small" onClick={() => vote(true)}>
                Më shumë si kjo
              </button>
              <button type="button" className="fy-btn fy-btn--ghost fy-btn--small" onClick={() => vote(false)}>
                Më pak
              </button>
            </div>
          )}
          <button type="button" className="fy-whysheet-close" onClick={() => setOpen(false)}>
            Mbyll
          </button>
        </div>
      )}
      <Toast text={toast} />
    </div>
  );
}

export function SectionSlide({
  title,
  kicker,
  intro,
  count,
  hidden,
  href,
  photo,
  sectionKey,
  meta,
}: {
  title: string;
  /** "Qyteti yt", "E ndjek", "Temë" */
  kicker: string;
  intro: string;
  count: number;
  hidden: number;
  href: string;
  photo: string | null;
  sectionKey: string;
  meta: ReelMeta;
}) {
  const [said, setSaid] = useState<null | "more" | "less">(null);
  return (
    <div className="fy-section">
      <Backdrop src={photo} blur />
      <div className="fy-shade fy-shade--section" />
      <div className="fy-section-body">
        <p className="fy-section-kicker">{kicker}</p>
        <h2 className="fy-section-title">{title}</h2>
        {intro && <p className="fy-section-intro">{intro}</p>}
        <p className="fy-section-count">
          {count === 1 ? "1 lajm" : `${count} lajme`} këtu
          {hidden > 0 ? ` · edhe ${hidden} te faqja e vet` : ""}
        </p>
        <div className="fy-section-actions">
          {!meta.readOnly && meta.onTaste && (
            said ? (
              <p className="fy-section-said" role="status">
                {said === "more" ? `Mirë — më shumë ${title}.` : `Mirë — më pak ${title}.`}
              </p>
            ) : (
              <>
                <button
                  type="button"
                  className="fy-btn fy-btn--light fy-btn--small"
                  onClick={() => {
                    meta.onTaste?.(sectionKey, true);
                    setSaid("more");
                  }}
                >
                  <ThumbsUp size={15} strokeWidth={2.4} aria-hidden="true" /> Më shumë
                </button>
                <button
                  type="button"
                  className="fy-btn fy-btn--ghost fy-btn--small"
                  onClick={() => {
                    meta.onTaste?.(sectionKey, false);
                    setSaid("less");
                  }}
                >
                  <ThumbsDown size={15} strokeWidth={2.4} aria-hidden="true" /> Më pak
                </button>
              </>
            )
          )}
          <Link href={href} className="fy-btn fy-btn--ghost fy-btn--small">
            Të gjitha <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** A light screen for the boxes and the end of the paper; scrolls inside if it must. */
export function PanelSlide({ kicker, title, children }: { kicker?: string; title: string; children: ReactNode }) {
  return (
    <div className="fy-panel">
      <div className="fy-panel-body">
        {kicker && <p className="fy-panel-kicker">{kicker}</p>}
        <h2 className="fy-panel-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
