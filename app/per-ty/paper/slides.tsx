"use client";

// The screens of the reader's reel (app/per-ty/paper/reel.tsx, reel.css):
//
//   CoverSlide    the paper's name over the lead's photo, how much is in it
//                 and "Fillo leximin ↓" (the first headlines only on a wide
//                 screen — a phone's cover stays simple)
//   StorySlide    one story, full screen: the photo, and over it why it is
//                 here, the headline, its key points (lib/key-points — the
//                 story's own sentences; the excerpt until they come) and
//                 "Lexo". Tapping the headline or the points, "Lexo", or a
//                 swipe to the left opens the whole story over the screen
//                 (reader-sheet.tsx) without leaving the reel; down the right
//                 side the reader's buttons — more of this, less of this, react,
//                 comments, share, why. Liking, disliking and reacting each
//                 burst in the middle of the screen. Each story wears its
//                 section's colour (lib/category-colors)
//   RecapSlide    "Sot në 30 sekonda": the whole edition on one screen, a line
//                 a story (Dardani's, or the story's own words), each a tap
//                 from its screen, with how many the reader has read
//   SectionSlide  a follow's own screen in its colour: what it is, why it is in
//                 the paper, how many stories, more / less of it
//   CheckpointSlide  the end of the reader's own paper, said plainly: a big
//                 tick, "Kaq ishte gazeta jote e sotme", how much of it they
//                 read, the streak, and then "Vazhdo me më shumë lajme" — the
//                 reel goes on without end after it
//   PanelSlide    a light screen that scrolls inside (the shared copy's end)
//
// A shared copy (/gazeta) passes `readOnly`: no reasons, no read marks, no
// "more / less" — those are the sharer's, not the friend's.

import { Fragment, useRef, useState, type ReactNode } from "react";
import ReaderSheet from "./reader-sheet";
import { useStoryData } from "./story-data";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, ChevronDown, MessageCircle, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import DardaniFace from "@/components/dardani/dardani-face";
import { recapRows } from "@/lib/perty-brief.mjs";
import { useBriefLines } from "./boxes";
import TimeAgo from "@/components/time-ago";
import CommentsSheet from "@/components/comments/comments-sheet";
import { useCommentThread } from "@/components/comments/use-comment-thread";
import { shortCount } from "@/lib/article-comments.mjs";
import { CATEGORY_COLORS, CATEGORY_LIGHT_BG, getCategoryColor } from "@/lib/category-colors";
import { isNewSince } from "@/lib/perty-visits.mjs";
import { STORY_REACTIONS, shares, topLine } from "@/lib/story-reactions.mjs";
import { useReactions } from "./reactions";
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
  /** A story opened in the reel's reader. */
  onRead?: (slug: string) => void;
};

/**
 * A section's own colour, as the rest of 383 paints it (Sport cyan, Ekonomi
 * green, Botë amber…), with the ink that reads on it. Sections without one keep
 * the paper's colour.
 */
export function sectionTone(category: string | null | undefined): React.CSSProperties | undefined {
  const color = category ? CATEGORY_COLORS[category] : undefined;
  if (!color || !category) return undefined;
  return { "--fy-accent": color, "--fy-accent-text": CATEGORY_LIGHT_BG.has(category) ? "#151412" : "#fff" } as React.CSSProperties;
}

/** A burst in the middle of the screen: the picked emoji, and a ring of small ones flying out. */
type Burst = { id: number; emoji: string; kind: "like" | "dislike" | "react" | "tap"; x?: number; y?: number };
const RING = [0, 45, 90, 135, 180, 225, 270, 315];

/** Each burst leaves when its own animation ends, however late a busy phone gets to play it. */
function Bursts({ list, onDone }: { list: Burst[]; onDone: (id: number) => void }) {
  return (
    <>
      {list.map((b) =>
        b.kind === "tap" ? (
          <span key={b.id} className="fy-heart" style={{ left: b.x, top: b.y }} aria-hidden="true" onAnimationEnd={() => onDone(b.id)}>
            {b.emoji}
          </span>
        ) : (
          <span key={b.id} className="fy-burst" data-kind={b.kind} aria-hidden="true">
            <b onAnimationEnd={() => onDone(b.id)}>{b.emoji}</b>
            {b.kind !== "dislike" &&
              RING.map((a, i) => (
                <i key={a} style={{ "--a": `${a + (i % 2 ? 12 : 0)}deg`, "--d": `${i % 2 ? 92 : 128}px`, "--w": `${i * 18}ms` } as React.CSSProperties}>
                  {b.emoji}
                </i>
              ))}
          </span>
        )
      )}
    </>
  );
}

/** The news photo first; the clay illustration only stands in when a story has none. */
const photoOf = (a: PaperStory["article"]) => a.imageUrl || a.coverArt || null;

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

/**
 * A wide news photo stretched over a tall phone is cropped to a sliver and
 * blown up five or six times, and turns to mush. Such a photo is shown whole
 * and sharp instead, over a blurred copy of itself — the way TikTok shows a
 * landscape picture. Tall and square photos still fill the screen.
 */
const WIDE = 1.15;
const TALL_SCREEN = 1.25;

/** The screen's picture: the first of `src` and `fallback` that loads. */
function Backdrop({
  src,
  fallback = null,
  priority = false,
  blur = false,
  fit = "auto",
  onFallback,
}: {
  src: string | null;
  fallback?: string | null;
  priority?: boolean;
  blur?: boolean;
  /** "cover" always fills (the cover's name sits on the photo); "auto" shows a wide photo whole on a tall screen. */
  fit?: "auto" | "cover";
  /** Told when the fallback had to stand in. */
  onFallback?: () => void;
}) {
  const [tries, setTries] = useState(0);
  const [whole, setWhole] = useState(false);
  const list = [src, fallback].filter((s, i, all): s is string => Boolean(s) && all.indexOf(s) === i);
  const current = list[tries];
  if (!current) return null;
  return (
    <>
      {whole && (
        <Image key={`${current}#fill`} src={current} alt="" fill sizes="40vw" quality={60} className="fy-bg fy-bg--blur" style={{ objectFit: "cover" }} draggable={false} />
      )}
      <Image
        key={current}
        src={current}
        alt=""
        fill
        sizes="(min-width: 1024px) 70vw, 100vw"
        // Sharper than the default: the photo is the whole screen here.
        quality={blur ? 75 : 90}
        priority={priority}
        className={`fy-bg${blur ? " fy-bg--blur" : ""}${whole ? " fy-bg--whole" : ""}`}
        style={{ objectFit: whole ? "contain" : "cover" }}
        draggable={false}
        onLoad={(e) => {
          if (blur || fit === "cover") return;
          const img = e.currentTarget;
          const box = img.parentElement?.getBoundingClientRect();
          if (!box?.width || !img.naturalWidth || !img.naturalHeight) return;
          setWhole(img.naturalWidth / img.naturalHeight > WIDE && box.height > box.width * TALL_SCREEN);
        }}
        onError={() => {
          if (tries + 1 < list.length) onFallback?.();
          setTries((t) => t + 1);
        }}
      />
    </>
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
  streak = 0,
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
  /** Days in a row the reader has come; shown from the second. */
  streak?: number;
  children?: ReactNode;
}) {
  return (
    <div className="fy-cover">
      <Backdrop src={photo} priority fit="cover" />
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
        {streak >= 2 && (
          <p className="fy-streak">
            <span aria-hidden="true">🔥</span> {streak} ditë rresht — mos e prish sot
          </p>
        )}
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
          <a href={start.href} className="fy-btn fy-btn--light fy-btn--start">
            {start.label} <ChevronDown size={18} strokeWidth={2.8} aria-hidden="true" />
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

/** A swipe this far to the left, and mostly sideways, opens the story. */
const SWIPE_OPEN = 64;

export function StorySlide({
  story,
  meta,
  eager = false,
  near = false,
  next,
}: {
  story: PaperStory;
  meta: ReelMeta;
  eager?: boolean;
  /** On screen or a couple away: its photo and key points load now. */
  near?: boolean;
  /** The next screen's address, for "Lajmi tjetër" in the reader. */
  next?: string;
}) {
  const { article, why } = story;
  const photo = photoOf(article);
  const [plateStoodIn, setPlateStoodIn] = useState(false);
  const plate = (!article.imageUrl || plateStoodIn) && Boolean(article.coverArt);
  const [open, setOpen] = useState(false);
  const [tray, setTray] = useState(false);
  const [taste, setTaste] = useState<null | "more" | "less">(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [talking, setTalking] = useState(false);
  const [reading, setReading] = useState(false);
  const lastTap = useRef(0);
  const down = useRef<{ x: number; y: number } | null>(null);
  const data = useStoryData(article.slug, near || reading);
  const points = data && data !== "off" ? data.points : [];
  const reactions = useReactions();
  const thread = useCommentThread(article.slug, (n) => reactions.setComments(article.slug, n));
  const comments = reactions.comments[article.slug] ?? 0;
  const mine = reactions.mine[article.slug];
  const tally = reactions.tallies[article.slug];
  const top = topLine(tally);
  const isRead = !meta.readOnly && meta.seen.read.has(article.slug);
  const isNew = !meta.readOnly && !isRead && isNewSince(article, meta.seen.since);
  const canTaste = !meta.readOnly && Boolean(why?.key && meta.onTaste);
  const words = article.title.split(/\s+/).filter(Boolean);
  const read = () => {
    setReading(true);
    meta.onRead?.(article.slug);
  };

  const say = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 2200);
  };
  const done = (id: number) => setBursts((list) => list.filter((p) => p.id !== id));
  const burst = (b: Omit<Burst, "id">) => {
    const id = Date.now() + Math.random();
    setBursts((list) => [...list.slice(-2), { ...b, id }]);
    // Only a safety net: with reduced motion there is no animation to end.
    window.setTimeout(() => done(id), 3000);
  };
  const vote = (more: boolean, quiet = false) => {
    if (!why?.key || !meta.onTaste) return;
    const key = why.key;
    const taught = meta.onTaste;
    // Teaching the paper re-ranks every story; let the burst pop first so the
    // tap answers at once, even on a slow phone.
    window.setTimeout(() => taught(key, more), 420);
    setTaste(more ? "more" : "less");
    if (!quiet) burst(more ? { kind: "like", emoji: "❤️" } : { kind: "dislike", emoji: "👎" });
    say(more ? "Do të shohësh më shumë si kjo" : "Do të shohësh më pak si kjo");
  };
  const reacted = (emoji: string) => burst({ kind: "react", emoji });
  // Double-tap the picture: a heart where the finger was, and "more like this".
  const heart = (x: number, y: number) => {
    burst({ kind: "tap", emoji: "❤️", x, y });
    if (canTaste && taste !== "more") vote(true, true);
  };
  const onTap = (e: React.PointerEvent<HTMLDivElement>) => {
    // Taps inside the comments (on <body>, but still React's child) are not on the picture.
    if (!e.currentTarget.contains(e.target as Node)) return;
    const from = down.current;
    down.current = null;
    if (from) {
      const dx = e.clientX - from.x;
      const dy = e.clientY - from.y;
      if (dx < -SWIPE_OPEN && Math.abs(dy) < Math.abs(dx) * 0.6) {
        read();
        return;
      }
    }
    if ((e.target as HTMLElement).closest("a, button, .fy-points")) return;
    const now = Date.now();
    const box = e.currentTarget.getBoundingClientRect();
    if (now - lastTap.current < 320) {
      heart(e.clientX - box.left, e.clientY - box.top);
      lastTap.current = 0;
    } else lastTap.current = now;
  };

  return (
    <div
      className="fy-story"
      data-photo={photo ? "" : undefined}
      data-read={isRead || undefined}
      data-pace={meta.pace}
      style={sectionTone(article.category)}
      onPointerDown={(e) => {
        down.current = e.currentTarget.contains(e.target as Node) ? { x: e.clientX, y: e.clientY } : null;
      }}
      onPointerUp={onTap}
      onPointerCancel={() => {
        down.current = null;
      }}
    >
      <Backdrop src={photo} fallback={article.coverArt ?? null} priority={eager || near} onFallback={() => setPlateStoodIn(true)} />
      <div className="fy-shade" />
      {plate && <small className="fy-credit">Ilustrim me AI</small>}
      <Bursts list={bursts} onDone={done} />

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
          {top && (
            <button type="button" className="fy-mark fy-mark--crowd" onClick={() => setTray(true)}>
              {top.emoji} {top.pct}% {top.label.toLowerCase()} · {top.total}
            </button>
          )}
        </p>
        <h2 className="fy-head">
          <button type="button" onClick={read} aria-label={`${article.title}. Lexoje`}>
            {words.map((w, i) => (
              <Fragment key={i}>
                <span className="fy-w" style={{ "--i": i } as React.CSSProperties} aria-hidden="true">
                  {w}
                </span>{" "}
              </Fragment>
            ))}
          </button>
        </h2>
        {points.length > 0 ? (
          <ul className="fy-points" onClick={read}>
            {points.map((p, i) => (
              <li key={i} style={{ "--i": i } as React.CSSProperties}>
                {p}
              </li>
            ))}
          </ul>
        ) : (
          article.excerpt && <p className="fy-text">{article.excerpt}</p>
        )}
        <div className="fy-story-foot">
          <button type="button" className="fy-btn fy-btn--light" onClick={read}>
            Lexo <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
          </button>
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
        {reactions.ok && (
          <button type="button" className="fy-act fy-act--emoji" onClick={() => setTray((t) => !t)} aria-expanded={tray} aria-label="Reago ndaj këtij lajmi">
            <b aria-hidden="true">{mine ? STORY_REACTIONS.find((r) => r.key === mine)?.emoji : "😮"}</b>
            <span aria-hidden="true">{mine ? "Reagove" : "Reago"}</span>
          </button>
        )}
        {reactions.commentsOk && (
          <button type="button" className="fy-act" onClick={() => setTalking(true)} aria-label={`Komentet: ${comments}`}>
            <MessageCircle size={22} strokeWidth={2.2} aria-hidden="true" />
            <span aria-hidden="true">{comments ? shortCount(comments) : "Komento"}</span>
          </button>
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
      </div>

      {tray && <ReactionTray slug={article.slug} onClose={() => setTray(false)} onPick={reacted} />}
      {reactions.commentsOk && <CommentsSheet open={talking} onClose={() => setTalking(false)} thread={thread} title={article.title} />}
      {reading && (
        <ReaderSheet
          open={reading}
          onClose={() => setReading(false)}
          article={article}
          data={data}
          accent={getCategoryColor(article.category)}
          onNext={
            next
              ? () => {
                  setReading(false);
                  window.location.hash = next;
                }
              : undefined
          }
        />
      )}

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

/** "Si ndihesh?" — five feelings, then how everyone else felt. */
function ReactionTray({ slug, onClose, onPick }: { slug: string; onClose: () => void; onPick: (emoji: string) => void }) {
  const { tallies, mine, react } = useReactions();
  const picked = mine[slug];
  const [failed, setFailed] = useState(false);
  const { total, list } = shares(tallies[slug]);
  return (
    <div className="fy-tray" role="dialog" aria-label="Reago ndaj këtij lajmi">
      <p className="fy-tray-title">{picked ? "Si u ndjenë të tjerët" : "Si ndihesh për këtë lajm?"}</p>
      {!picked ? (
        <div className="fy-tray-pick">
          {STORY_REACTIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={async () => {
                onPick(r.emoji);
                const saved = await react(slug, r.key);
                setFailed(!saved);
              }}
            >
              <b aria-hidden="true">{r.emoji}</b>
              <span>{r.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <ul className="fy-tray-results">
          {list.map((r) => (
            <li key={r.key} data-mine={r.key === picked || undefined}>
              <button
                type="button"
                onClick={() => {
                  if (r.key !== picked) onPick(r.emoji);
                  react(slug, r.key);
                }}
                aria-label={`${r.label}: ${r.pct}%`}
              >
                <span className="fy-tray-bar" style={{ transform: `scaleX(${r.pct / 100})` }} aria-hidden="true" />
                <b aria-hidden="true">{r.emoji}</b>
                <span>{r.label}</span>
                <i>{r.pct}%</i>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="fy-tray-foot">
        {failed ? "Nuk u ruajt — provo sërish." : picked ? `${total} ${total === 1 ? "reagim" : "reagime"} · prek një tjetër për ta ndryshuar` : "Pastaj sheh si ndihen lexuesit e tjerë."}
      </p>
      <button type="button" className="fy-whysheet-close" onClick={onClose}>
        Mbyll
      </button>
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
    <div className="fy-section" style={sectionKey.startsWith("cat:") ? sectionTone(title) : undefined}>
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

export type RecapStory = { slug: string; title: string; excerpt?: string | null; category: string; href: string; read: boolean };

/**
 * "Sot në 30 sekonda": the day in one screen. Every story of the edition gets
 * one line — Dardani's when he has written it, the story's own first sentence
 * until then (lib/perty-brief recapRows), so it is whole and never says more
 * than the stories do. Each line jumps to its story.
 */
export function RecapSlide({ date, stories }: { date: string; stories: RecapStory[] }) {
  const lines = useBriefLines(stories.map((s) => s.slug));
  const rows = recapRows(stories, lines);
  const bySlug = new Map(stories.map((s) => [s.slug, s]));
  const read = stories.filter((s) => s.read).length;
  return (
    <div className="fy-recap">
      <div className="fy-recap-body">
        <header className="fy-recap-head">
          <DardaniFace state="happy" size={46} decorative />
          <div>
            <p className="fy-recap-kicker">Shkurt, për sot · {date}</p>
            <h2 className="fy-recap-title">Sot në 30 sekonda</h2>
          </div>
        </header>
        <div className="fy-recap-progress" aria-label={`${read} nga ${stories.length} lajme të lexuara`}>
          <span>
            <i style={{ transform: `scaleX(${stories.length ? read / stories.length : 0})` }} />
          </span>
          <b>
            {read}/{stories.length}
          </b>
        </div>
        <ol className="fy-recap-list">
          {rows.map((r, i) => {
            const s = bySlug.get(r.slug);
            if (!s) return null;
            return (
              <li key={r.slug} style={{ ...sectionTone(s.category), "--i": i } as React.CSSProperties} data-read={s.read || undefined}>
                <a href={s.href} aria-label={`${s.category}: ${r.text}`}>
                  <span className="fy-recap-n" aria-hidden="true">
                    {s.read ? <Check size={14} strokeWidth={3.2} /> : i + 1}
                  </span>
                  <span className="fy-recap-line">{r.text}</span>
                </a>
              </li>
            );
          })}
        </ol>
        <p className="fy-recap-foot">{lines?.length ? "Përmbledhur nga Dardani, vetëm nga lajmet e sotme." : "Nga lajmet e sotme. Prek një për ta lexuar."}</p>
      </div>
    </div>
  );
}

/**
 * The checkpoint: today's own paper is done, and the reader is told so before
 * the reel carries on with more.
 */
export function CheckpointSlide({
  read,
  total,
  streak,
  minutes,
  next,
  onShare,
  onMore,
}: {
  read: number;
  total: number;
  streak: number;
  minutes: number;
  /** The first screen after it; absent while nothing more has come. */
  next?: string;
  onShare?: () => void;
  /** "Gazeta jote": tomorrow's edition, the boxes, how it works. */
  onMore: () => void;
}) {
  const all = total > 0 && read >= total;
  return (
    <div className="fy-check">
      <div className="fy-check-body">
        <span className="fy-check-tick" aria-hidden="true">
          <Check size={44} strokeWidth={3.4} />
        </span>
        <p className="fy-check-kicker">Fundi i gazetës sate</p>
        <h2 className="fy-check-title">Kaq ishte gazeta jote e sotme.</h2>
        <ul className="fy-check-stats">
          <li>
            <b>
              {read}/{total}
            </b>
            <span>lajme lexuar</span>
          </li>
          {streak >= 1 && (
            <li>
              <b>🔥 {streak}</b>
              <span>{streak === 1 ? "ditë" : "ditë rresht"}</span>
            </li>
          )}
          <li>
            <b>{minutes}</b>
            <span>min lexim</span>
          </li>
        </ul>
        <p className="fy-check-line">{all ? "I lexove të gjitha. Gazeta e nesërme del në 07:00." : "Gazeta e nesërme del në 07:00, me lajmet e reja për ty."}</p>
        <div className="fy-check-actions">
          {onShare && (
            <button type="button" className="fy-btn fy-btn--light fy-btn--small" onClick={onShare}>
              <Share2 size={15} strokeWidth={2.4} aria-hidden="true" /> Ndaje gazetën
            </button>
          )}
          <button type="button" className="fy-btn fy-btn--ghost fy-btn--small" onClick={onMore}>
            Gazeta jote
          </button>
        </div>
      </div>
      {next && (
        <a href={next} className="fy-check-more">
          <span>Vazhdo me më shumë lajme</span>
          <ChevronDown size={22} strokeWidth={2.8} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

/** A light screen for the end of the paper; scrolls inside if it must. */
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
