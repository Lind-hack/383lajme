"use client";

import { useState } from "react";
import Link from "next/link";
import DosjeMotifs from "@/components/dosje-motifs";
import DosjeWritten, { useRevealOnce } from "@/components/dosje-written";
import { entryDate } from "@/lib/albanian-date.mjs";
import type { DosjeEntry, DosjeVideo } from "@/components/dosje-section";

/**
 * The dossier as it sits beside a story: the file's own look, at the length of
 * a short read.
 *
 * The full dossier (components/dosje-section.tsx) ran to 3,600px on the
 * article page — every moment open, every video — a wall between the reader
 * and everything after it. What a reader of today's story wants from it is the
 * part that explains it: what happened before, in order, ending on this story.
 * So this keeps the dossier's paper, rim, year gutter, motifs and the text that
 * writes itself in, and shows only the moments that lead up to the article.
 * Earlier ones open on request; the whole file is one link away.
 *
 * What it drops from the full card is the drama — no scroll lock, no shake on
 * opening. The writing effect stays because it is the file's signature, and it
 * runs once per moment as it comes into view.
 */

const SERIF = "var(--font-garamond), Georgia, serif";
const SANS = "var(--font-manrope), sans-serif";
const INK = "var(--theme-ink, #241F1B)";
const MUTED = "var(--theme-muted, rgba(43,37,33,.6))";
const RULE = "var(--theme-border, rgba(43,37,33,.2))";
const RED = "#E4322B";
const RED_INK = "var(--theme-accent-ink, #C42A23)";

/** Moments shown before the reader asks for more. */
const LEAD = 3;
/** Earlier moments revealed per "Vazhdo historinë". */
const MORE = 6;

interface Props {
  topicSlug: string;
  topicTitle: string;
  blurb: string;
  /** Two or three sentences that explain the subject from the start. */
  primer?: string | null;
  videos?: DosjeVideo[];
  entries: DosjeEntry[];
  sourced?: boolean;
}

const diamond = (size: number, color: string) => (
  <span aria-hidden="true" style={{ width: size, height: size, background: color, transform: "rotate(45deg)", display: "inline-block", flexShrink: 0 }} />
);

const Rule = () => (
  <div style={{ display: "flex", alignItems: "center", gap: "10px" }} aria-hidden="true">
    <span style={{ flex: 1, height: "1px", background: RULE }} />
    {diamond(5, "rgba(43,37,33,.35)")}
    <span style={{ flex: 1, height: "1px", background: RULE }} />
  </div>
);

function Moment({ e, fresh }: { e: DosjeEntry; fresh: boolean }) {
  const { ref, shown, armed } = useRevealOnce<HTMLLIElement>();
  const date = entryDate(e);
  const refs = e.kind === "milestone" ? e.citations ?? [] : [];
  const body = !e.isCurrent ? e.summary ?? "" : "";
  const bodyDelay = 220;
  const whyDelay = bodyDelay + body.split(/\s+/).length * 22 + 160;

  return (
    <li
      ref={ref}
      className={[
        "dstory-moment",
        e.isCurrent ? "is-current" : "",
        fresh ? "is-fresh" : "",
        shown ? "dosje-writing" : armed ? "dosje-armed" : "",
      ].filter(Boolean).join(" ")}
    >
      <div className="dstory-gutter">
        <div className="dstory-year">{e.year}</div>
        {e.tag && <div className="dstory-tag-line">{e.tag}</div>}
      </div>

      <div className="dstory-body">
        <span className="dstory-dot" aria-hidden="true" />
        {e.isCurrent && <div className="dstory-current-label">Ky artikull</div>}

        {e.slug && !e.isCurrent ? (
          <Link href={`/article/${e.slug}`} className="dstory-title dstory-title-link">
            <DosjeWritten as="span" active={shown} step={20} text={e.title} />
          </Link>
        ) : (
          <DosjeWritten as="div" active={shown} step={20} text={e.title} style={{ font: `600 19px/1.26 ${SERIF}`, color: INK, textWrap: "pretty" }} />
        )}

        {date && <div className="dstory-date">{date}</div>}

        {body && (
          <DosjeWritten
            active={shown}
            offset={bodyDelay}
            step={22}
            text={body}
            showNib={!e.why}
            style={{ margin: "10px 0 0", font: `400 15px/1.68 ${SANS}`, color: INK }}
          />
        )}

        {e.why && !e.isCurrent && (
          <div className="dstory-why">
            <div className="dstory-why-label">Pse ka rëndësi</div>
            <DosjeWritten
              active={shown}
              offset={whyDelay}
              step={22}
              text={e.why}
              showNib
              style={{ margin: 0, font: `italic 400 16px/1.55 ${SERIF}`, color: INK }}
            />
          </div>
        )}

        {refs.length > 0 && (
          <div className="dstory-refs">
            {refs.map((c, i) => (
              <a key={c.url} href={c.url} target="_blank" rel="noreferrer" title={c.quote ? `“${c.quote}”` : (c.title ?? undefined)}>
                Referenca {i + 1}
                <span className="sr-only"> (hapet në skedë të re)</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function VideoTeaser({ video }: { video: DosjeVideo }) {
  const [playing, setPlaying] = useState(false);
  return (
    <figure className="dstory-video">
      <div className="dstory-video-head">
        <span className="dstory-video-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="#fff"><path d="M8 5.5v13l10.5-6.5z" /></svg>
        </span>
        Shikoje të shpjeguar
      </div>
      <div className="dstory-video-frame">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1`}
            title={video.title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} aria-label={`Luaj videon: ${video.title}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`} alt="" loading="lazy" decoding="async" />
            <span className="dstory-play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z" /></svg>
            </span>
          </button>
        )}
      </div>
      <figcaption>
        <span className="dstory-video-title">{video.title}</span>
        <span className="dstory-video-channel">{video.channel} · YouTube</span>
      </figcaption>
    </figure>
  );
}

export default function DosjeStory({ topicSlug, topicTitle, blurb, primer, videos, entries, sourced = false }: Props) {
  const [earlier, setEarlier] = useState(0);
  if (entries.length === 0) return null;

  // The story ends on the article being read (or on the latest moment when it
  // is not in the file yet), and the lead shows what came just before it.
  const currentIdx = entries.findIndex((e) => e.isCurrent);
  const end = currentIdx >= 0 ? currentIdx + 1 : entries.length;
  const leadStart = Math.max(0, end - LEAD);
  const start = Math.max(0, leadStart - earlier);
  const visible = entries.slice(start, end);
  const hiddenBefore = start;
  const video = videos?.[0];

  const firstDate = entryDate(entries[0]);
  const lastDate = entryDate(entries[end - 1]);
  const span = firstDate && lastDate && firstDate !== lastDate ? `${firstDate} — ${lastDate}` : firstDate;

  return (
    <section className="dosje-section dstory" aria-labelledby={`dstory-${topicSlug}`}>
      <DosjeMotifs variant="rail" />
      <div className="dosje-inner dstory-inner">
        <div className="dstory-masthead">
          <span className="dstory-kicker">
            {diamond(6, RED)}
            Dosje
          </span>
          <span className="dstory-count">{entries.length} momente</span>
        </div>

        <h2 id={`dstory-${topicSlug}`} className="dstory-heading">{topicTitle}</h2>
        <p className="dstory-blurb">{blurb}</p>

        {primer && (
          <p className="dstory-primer">
            <span className="dstory-primer-label">Në pak fjalë</span>
            {primer}
          </p>
        )}
        {!sourced && <p className="dstory-unverified">Kronologji pune: burimet ende nuk janë verifikuar.</p>}

        <div style={{ margin: "20px 0 0" }}><Rule /></div>
        {span && <div className="dstory-span">{span}</div>}

        {hiddenBefore > 0 && (
          <button type="button" className="dstory-earlier" onClick={() => setEarlier((n) => n + MORE)}>
            <span aria-hidden="true" className="dstory-earlier-arrow">↑</span>
            Vazhdo historinë nga më herët
            <span className="dstory-earlier-count">{Math.min(hiddenBefore, MORE)}</span>
          </button>
        )}

        <ol className="dstory-thread">
          {visible.map((e, i) => (
            <Moment key={e.id} e={e} fresh={earlier > 0 && i < leadStart - start} />
          ))}
        </ol>

        {video && <VideoTeaser video={video} />}

        <div style={{ margin: "22px 0 16px" }}><Rule /></div>
        <Link href={`/dosje/${topicSlug}`} className="dosje-btn dosje-btn-primary dstory-full">
          Dosja e plotë · {entries.length} momente
        </Link>
      </div>

      <style>{`
        .dstory {
          position: relative; overflow: hidden; color: ${INK};
          background:
            radial-gradient(120% 60% at 100% 0%, rgba(228,50,43,.06), transparent 60%),
            #FAF6F1;
          border: 1.5px solid rgba(228,50,43,.42);
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(228,50,43,.08), 0 18px 40px -28px rgba(120,40,20,.35);
        }
        .dstory::before {
          content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px;
          background: linear-gradient(90deg, ${RED}, rgba(228,50,43,.35));
        }
        .dstory-inner { position: relative; padding: 24px 22px 20px; }
        .dstory-masthead { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .dstory-kicker { display: inline-flex; align-items: center; gap: 8px; font: 600 10px ${SANS}; letter-spacing: .24em; text-transform: uppercase; color: ${MUTED}; }
        .dstory-count { font: 500 11px ${SERIF}; letter-spacing: .16em; text-transform: uppercase; color: ${MUTED}; font-variant-numeric: tabular-nums; }
        .dstory-heading { margin: 12px 0 0; font: 600 clamp(26px, 2.6vw, 32px)/1.06 ${SERIF}; letter-spacing: -.015em; text-wrap: balance; }
        .dstory-blurb { margin: 10px 0 0; font: italic 400 17px/1.5 ${SERIF}; color: ${MUTED}; }
        .dstory-primer { margin: 16px 0 0; font: 400 15px/1.65 ${SANS}; }
        .dstory-primer-label { display: block; margin-bottom: 4px; font: 700 10px ${SANS}; letter-spacing: .2em; text-transform: uppercase; color: ${RED_INK}; }
        .dstory-primer::first-letter { font: 600 2.6em/0.9 ${SERIF}; float: left; margin: 4px 8px 0 0; color: ${RED}; }
        .dstory-unverified { margin: 12px 0 0; font: 500 11px/1.4 ${SANS}; color: ${MUTED}; }
        .dstory-span { margin-top: 8px; text-align: center; font: 500 10px ${SANS}; letter-spacing: .2em; text-transform: uppercase; color: ${MUTED}; font-variant-numeric: tabular-nums; }

        .dstory-earlier {
          display: flex; align-items: center; gap: 10px; width: 100%; margin: 18px 0 0;
          padding: 10px 14px; border-radius: 10px; border: 1px dashed rgba(43,37,33,.28); background: rgba(255,255,255,.5);
          font: 600 12.5px ${SANS}; color: ${INK}; cursor: pointer; text-align: left;
        }
        .dstory-earlier-arrow { color: ${RED}; font-weight: 700; }
        .dstory-earlier-count { margin-left: auto; font: 500 12px ${SERIF}; color: ${MUTED}; font-variant-numeric: tabular-nums; }
        @media (hover: hover) and (pointer: fine) { .dstory-earlier:hover { border-style: solid; background: #fff; } }

        .dstory-thread { list-style: none; margin: 20px 0 0; padding: 0; }
        .dstory-moment { display: grid; grid-template-columns: var(--dosje-gutter) minmax(0, 1fr); position: relative; }
        .dstory-gutter { text-align: right; padding: 2px 14px 0 0; }
        .dstory-year { font: 500 22px/1 ${SERIF}; letter-spacing: .01em; font-variant-numeric: tabular-nums; }
        .dstory-tag-line { margin-top: 6px; font: 600 8px ${SANS}; letter-spacing: .06em; text-transform: uppercase; color: ${MUTED}; white-space: nowrap; }
        .dstory-body { position: relative; min-width: 0; border-left: 1px solid ${RULE}; padding: 0 0 26px 18px; }
        .dstory-moment:last-child .dstory-body { padding-bottom: 4px; }
        .dstory-dot {
          position: absolute; left: -5px; top: 5px; width: 9px; height: 9px; border-radius: 50%;
          background: #FAF6F1; border: 1px solid rgba(43,37,33,.45);
        }
        .dstory-moment.is-current .dstory-body {
          background: linear-gradient(90deg, rgba(228,50,43,.07), rgba(228,50,43,0) 85%);
          border-left-color: rgba(228,50,43,.5); padding-top: 10px; padding-bottom: 10px; border-radius: 0 10px 10px 0;
        }
        .dstory-moment.is-current .dstory-dot { top: 15px; background: ${RED}; border-color: ${RED}; box-shadow: 0 0 0 4px rgba(228,50,43,.14); }
        .dstory-current-label { margin-bottom: 6px; font: 700 9px ${SANS}; letter-spacing: .2em; text-transform: uppercase; color: ${RED_INK}; }
        .dstory-title { display: block; font: 600 19px/1.26 ${SERIF}; color: ${INK}; text-decoration: none; text-wrap: pretty; }
        .dstory-title-link { text-decoration: underline; text-decoration-color: transparent; text-underline-offset: 3px; transition: text-decoration-color .15s; }
        @media (hover: hover) and (pointer: fine) { .dstory-title-link:hover { text-decoration-color: rgba(43,37,33,.4); } }
        .dstory-date { margin-top: 5px; font: 500 12px ${SANS}; color: ${MUTED}; font-variant-numeric: tabular-nums; }
        .dstory-why { margin-top: 14px; padding: 11px 0; border-top: 1px solid rgba(43,37,33,.16); border-bottom: 1px solid rgba(43,37,33,.16); }
        .dstory-why-label { margin-bottom: 6px; font: 600 9px ${SANS}; letter-spacing: .2em; text-transform: uppercase; color: ${RED_INK}; }
        .dstory-refs { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; }
        .dstory-refs a { font: 500 11.5px ${SANS}; color: ${MUTED}; text-decoration: none; border-bottom: 1px solid rgba(228,50,43,.35); padding-bottom: 1px; }
        .dstory-moment.is-fresh { animation: dstory-in .45s cubic-bezier(.22,1,.36,1) both; }
        @keyframes dstory-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }

        .dstory-video { margin: 18px 0 0; padding: 14px; border-radius: 14px; background: rgba(36,31,27,.045); border: 1px solid rgba(43,37,33,.14); }
        .dstory-video-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font: 600 17px/1.2 ${SERIF}; }
        .dstory-video-icon { width: 20px; height: 20px; border-radius: 50%; background: ${RED}; display: grid; place-items: center; padding-left: 1px; }
        .dstory-video-frame { position: relative; aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; background: #1A1714; }
        .dstory-video-frame iframe, .dstory-video-frame button { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
        .dstory-video-frame button { padding: 0; cursor: pointer; background: none; }
        .dstory-video-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .dstory-play {
          position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
          width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center;
          background: rgba(228,50,43,.92); color: #fff; box-shadow: 0 4px 14px rgba(17,17,17,.28);
        }
        .dstory-video figcaption { display: grid; gap: 3px; margin-top: 9px; }
        .dstory-video-title { font: 600 14.5px/1.35 ${SERIF}; }
        .dstory-video-channel { font: 500 10.5px ${SANS}; letter-spacing: .06em; color: ${MUTED}; }

        .dstory-full { border-radius: 10px; }
        @media (hover: hover) and (pointer: fine) { .dstory-full:hover { background: #B32620; } }
        .dstory-earlier:focus-visible, .dstory-full:focus-visible, .dstory-video button:focus-visible,
        .dstory-title-link:focus-visible, .dstory-refs a:focus-visible { outline: 2px solid #FF4422; outline-offset: 2px; border-radius: 6px; }
        @media (max-width: 520px) { .dstory-inner { padding: 22px 16px 18px; } }
        /* A narrow card gives the year column to the prose: year and tag sit
           on one line above the title, on the same thread. */
        @container (max-width: 430px) {
          .dstory-moment { grid-template-columns: minmax(0, 1fr); }
          .dstory-gutter { grid-row: 1; display: flex; align-items: baseline; gap: 8px; text-align: left; padding: 0 0 6px 18px; border-left: 1px solid ${RULE}; }
          .dstory-moment:first-child .dstory-gutter { border-left-color: transparent; }
          .dstory-year { font-size: 17px; }
          .dstory-tag-line { margin-top: 0; }
          .dstory-moment.is-current .dstory-gutter { border-left-color: rgba(228,50,43,.5); }
        }
        @media (prefers-reduced-motion: reduce) { .dstory-moment.is-fresh { animation: none; } .dstory-title-link { transition: none; } }
      `}</style>
    </section>
  );
}
