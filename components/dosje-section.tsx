"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import DosjeMotifs from "@/components/dosje-motifs";
import DosjeWritten, { useRevealOnce } from "@/components/dosje-written";
import { entryDate } from "@/lib/albanian-date.mjs";

/**
 * The dossier, in the article and at full width.
 *
 * The rail version asked the reader to open every entry by hand to see any of
 * it, in a 280px column that could not hold a paragraph. Both were the same
 * mistake: the dossier was being treated as an index when what a reader wants
 * is the account itself.
 *
 * So nothing is collapsed. Every entry is already open, and reveals itself as
 * it scrolls into view — the text writes itself in, the photograph fades up
 * beside it. There is no expand control, because there is nothing to expand;
 * the only clicks left are the ones that take you somewhere else.
 *
 * At full article width there is room for the photograph and the prose to sit
 * side by side; below 720px they stack. One component, three breakpoints, no
 * separate mobile build to fall out of sync.
 */

export interface DosjeEntry {
  kind: "milestone" | "article";
  id: string;
  year?: string;
  date?: string;
  tag?: string;
  title: string;
  summary?: string;
  why?: string;
  slug?: string;
  imageUrl?: string | null;
  /** Where an illustrative photograph came from, always shown with it. */
  imageCredit?: string | null;
  imageSlug?: string | null;
  source?: string | null;
  publishedAt?: string | null;
  isCurrent?: boolean;
  /**
   * Where this claim comes from. Present only on milestones that went through
   * the research pipeline, where two distinct publishers were fetched and
   * answered before it could be approved. The hand-written file has none and
   * therefore shows none — the absence is accurate, not an omission.
   */
  citations?: {
    url: string;
    publisher: string;
    title?: string | null;
    date?: string | null;
  }[];
}

export interface DosjeVideo {
  id: string;
  channel: string;
  title: string;
}

interface Props {
  topicSlug: string;
  topicTitle: string;
  blurb: string;
  videos?: DosjeVideo[];
  entries: DosjeEntry[];
}

const SERIF = "var(--font-garamond), Georgia, serif";
const SANS = "var(--font-manrope), sans-serif";
const INK = "#241F1B";
const MUTED = "rgba(43,37,33,.52)";
const RULE = "rgba(43,37,33,.2)";
const ACCENT = "#E4322B";

function spanLabel(entries: DosjeEntry[]): string | null {
  const first = entries.find((e) => e.date || e.publishedAt);
  const last = [...entries].reverse().find((e) => e.date || e.publishedAt);
  const a = first ? entryDate(first) : null;
  const b = last ? entryDate(last) : null;
  if (!a || !b || a === b) return a ?? null;
  return `${a} — ${b}`;
}

const diamond = (size: number, color: string) => (
  <span
    aria-hidden="true"
    style={{ width: `${size}px`, height: `${size}px`, background: color, transform: "rotate(45deg)", display: "inline-block", flexShrink: 0 }}
  />
);

const Rule = () => (
  <div style={{ display: "flex", alignItems: "center", gap: "10px" }} aria-hidden="true">
    <span style={{ flex: 1, height: "1px", background: RULE }} />
    {diamond(5, "rgba(43,37,33,.35)")}
    <span style={{ flex: 1, height: "1px", background: RULE }} />
  </div>
);

function Entry({ e, index, unlockIndex }: { e: DosjeEntry; index: number; unlockIndex: number | null }) {
  const { ref, shown, armed } = useRevealOnce<HTMLDivElement>();
  const date = entryDate(e);
  const body = e.summary ?? "";
  const bodyDelay = 260;
  const whyDelay = bodyDelay + body.split(/\s+/).length * 26 + 180;

  return (
    <div
      ref={ref}
      className={[
        shown ? "dosje-writing" : armed ? "dosje-armed" : "",
        unlockIndex !== null ? "dosje-attached" : "",
      ]
        .filter(Boolean)
        .join(" ") || undefined}
      style={{
        display: "grid",
        gridTemplateColumns: "var(--dosje-gutter) 1fr",
        gap: "0",
        position: "relative",
        ...(unlockIndex !== null ? ({ ["--u" as string]: `${unlockIndex * 110}ms` } as React.CSSProperties) : {}),
      }}
    >
      <div style={{ textAlign: "right", paddingRight: "18px", paddingTop: "2px" }}>
        <div style={{ font: `500 clamp(20px, 3vw, 26px)/1 ${SERIF}`, color: INK, letterSpacing: "0.01em" }}>{e.year}</div>
        {e.tag && (
          <div style={{ marginTop: "6px", font: `600 9px ${SANS}`, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED }}>
            {e.tag}
          </div>
        )}
      </div>

      <div
        style={{
          borderLeft: `1px solid ${RULE}`,
          paddingLeft: "clamp(16px, 3vw, 28px)",
          paddingBottom: "clamp(28px, 4vw, 44px)",
          minWidth: 0,
        }}
      >
        {e.isCurrent && (
          <div style={{ font: `600 9px ${SANS}`, letterSpacing: "0.2em", textTransform: "uppercase", color: ACCENT, marginBottom: "8px" }}>
            Ky artikull
          </div>
        )}

        <DosjeWritten
          as="div"
          active={shown}
          offset={0}
          step={22}
          text={e.title}
          style={{ font: `600 clamp(19px, 2.4vw, 24px)/1.24 ${SERIF}`, color: INK, marginBottom: "8px" }}
        />

        {date && (
          <div style={{ font: `500 12px ${SANS}`, color: MUTED, marginBottom: "14px" }}>
            {date}
            {e.source ? ` · ${e.source}` : ""}
          </div>
        )}

        <div className="dosje-entry-body">
          {e.imageUrl && e.imageCredit && e.imageSlug && (
            <figure className="dosje-plate-in" style={{ margin: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={e.imageUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="dosje-entry-img"
                style={{ borderRadius: "12px", objectFit: "cover", background: "#EFEAE2", display: "block" }}
              />
              {e.kind === "milestone" && (
                /* One tier, not two. "Foto ilustruese" was the other half of a
                   bug that put a Bitcoin chart under the 2013 NATO drawdown: a
                   disclaimer made a wrong pairing survivable in review. A
                   photograph here is this archive's own reporting of that
                   event, credited and linked so a reader can check it in one
                   click — or it is not shown. */
                <figcaption style={{ marginTop: "6px", font: `500 10px ${SANS}`, color: "rgba(43,37,33,.5)", letterSpacing: "0.02em" }}>
                  <Link href={`/article/${e.imageSlug}`} style={{ color: "inherit", textDecoration: "underline" }}>
                    Nga mbulimi i 383-shit
                  </Link>
                  {e.imageCredit ? ` · ${e.imageCredit}` : ""}
                </figcaption>
              )}
            </figure>
          )}

          <div style={{ minWidth: 0 }}>
            {body && (
              <DosjeWritten
                active={shown}
                offset={bodyDelay}
                step={24}
                text={body}
                showNib={!e.why}
                style={{ margin: 0, font: `400 clamp(15px, 1.7vw, 16.5px)/1.72 ${SANS}`, color: "rgba(36,31,27,.9)" }}
              />
            )}

            {e.why && (
              <div style={{ marginTop: "16px", borderTop: `1px solid rgba(43,37,33,.16)`, borderBottom: `1px solid rgba(43,37,33,.16)`, padding: "13px 0" }}>
                <div style={{ font: `600 9px ${SANS}`, letterSpacing: "0.2em", textTransform: "uppercase", color: ACCENT, marginBottom: "7px" }}>
                  Pse ka rëndësi
                </div>
                <DosjeWritten
                  active={shown}
                  offset={whyDelay}
                  step={24}
                  text={e.why}
                  showNib
                  style={{ margin: 0, font: `italic 400 clamp(15.5px, 1.8vw, 17px)/1.6 ${SERIF}`, color: "rgba(36,31,27,.9)" }}
                />
              </div>
            )}

            {/* The sources, in the open.
                A historical claim the reader cannot check is precisely what
                went wrong here before: a confident date, an authoritative
                tone, and nothing underneath it. Two publishers had to answer
                before this line could be published, and naming them is what
                makes that requirement worth anything to the person reading. */}
            {e.kind === "milestone" && e.citations && e.citations.length > 0 && (
              <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "baseline" }}>
                <span style={{ font: `600 9px ${SANS}`, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(43,37,33,.45)" }}>
                  Burimet
                </span>
                {e.citations.map((c) => (
                  <a
                    key={c.url}
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    title={c.title ?? c.url}
                    style={{
                      font: `500 11.5px ${SANS}`,
                      color: "rgba(43,37,33,.68)",
                      textDecoration: "none",
                      borderBottom: `1px solid ${ACCENT}55`,
                      paddingBottom: "1px",
                    }}
                  >
                    {c.publisher}
                    {c.date ? ` ${String(c.date).slice(0, 4)}` : ""}
                  </a>
                ))}
              </div>
            )}

            {e.slug && !e.isCurrent && (
              <Link
                href={`/article/${e.slug}`}
                style={{ display: "inline-block", marginTop: "14px", font: `600 10px ${SANS}`, letterSpacing: "0.16em", textTransform: "uppercase", color: ACCENT, textDecoration: "none" }}
              >
                Lexo artikullin →
              </Link>
            )}
          </div>
        </div>
      </div>

      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "calc(var(--dosje-gutter) - 5px)",
          top: "6px",
          width: "9px",
          height: "9px",
          borderRadius: "50%",
          background: e.isCurrent ? ACCENT : "#FAF6F1",
          border: `1px solid ${e.isCurrent ? ACCENT : "rgba(43,37,33,.45)"}`,
          boxShadow: e.isCurrent ? "0 0 0 4px rgba(228,50,43,.14)" : undefined,
        }}
      />
    </div>
  );
}

export default function DosjeSection({ topicSlug, topicTitle, blurb, videos, entries }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);

  const currentIdx = entries.findIndex((e) => e.isCurrent);
  const anchorIdx = currentIdx >= 0 ? currentIdx : entries.length - 1;
  const firstShown = Math.max(0, anchorIdx - 4);
  const shownCount = Math.min(anchorIdx + 2, entries.length) - firstShown;
  const hiddenCount = entries.length - shownCount;

  /**
   * Opening the rest of the file. The card returns to its own top first —
   * without that the new moments land above the fold and the reader only ever
   * finds them by scrolling back — then the card is held for the length of the
   * entrance so the arrival is watched rather than scrolled past.
   */
  const unlock = useCallback(() => {
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    cardRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    setShowAll(true);
    if (reduced) return;

    setUnlocking(true);

    // The page is held while the moments land, so the arrival is watched
    // rather than scrolled past. Two things matter here: the lock is released
    // on a timer that is always longer than the animation it covers, and it is
    // released again in the cleanup, because a lock that survives its
    // animation is a page the reader cannot scroll.
    document.documentElement.classList.add("dosje-locked");
    document.body.classList.add("dosje-locked");

    const total = 900 + Math.min(hiddenCount, 8) * 110;
    window.setTimeout(() => {
      document.documentElement.classList.remove("dosje-locked");
      document.body.classList.remove("dosje-locked");
      setUnlocking(false);
    }, total);
  }, [hiddenCount]);

  // Whatever happens — navigation, unmount, a thrown error mid-animation — the
  // page is never left locked.
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove("dosje-locked");
      document.body.classList.remove("dosje-locked");
    };
  }, []);

  if (entries.length === 0) return null;

  const INITIAL = 6;
  const currentIndex = entries.findIndex((e) => e.isCurrent);
  const anchor = currentIndex >= 0 ? currentIndex : entries.length - 1;
  const from = showAll ? 0 : Math.max(0, anchor - (INITIAL - 2));
  const visible = showAll ? entries : entries.slice(from, anchor + 2);
  const hidden = entries.length - visible.length;
  // Where the list ended before unlocking, so only the new arrivals animate.
  const visibleBefore = Math.min(anchor + 2, entries.length) - Math.max(0, anchor - (INITIAL - 2));
  const span = spanLabel(entries);

  return (
    <section
      aria-label={`Dosje: ${topicTitle}`}
      ref={cardRef}
      className={`dosje-section${unlocking ? " dosje-quake dosje-holding" : ""}`}
      style={{
        position: "relative",
        background: "#FAF6F1",
        border: "1.5px solid rgba(228,50,43,.42)",
        borderRadius: "16px",
        boxShadow: "0 1px 3px rgba(228,50,43,.08)",
        ...(unlocking
          ? ({ ["--shake" as string]: `${Math.min(3 + hiddenCount * 0.7, 11)}px` } as React.CSSProperties)
          : {}),
        overflow: "hidden",
        margin: "clamp(32px, 5vw, 52px) 0",
      }}
    >
      <DosjeMotifs variant="full" />

      <div className="dosje-inner">

      <div style={{ position: "relative", padding: "clamp(22px, 4vw, 34px) clamp(18px, 4vw, 34px) 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {diamond(6, ACCENT)}
            <span style={{ font: `600 10px ${SANS}`, letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(43,37,33,.66)" }}>
              Dosje
            </span>
          </div>
          <span style={{ font: `500 11px ${SERIF}`, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>
            {entries.length} momente
          </span>
        </div>

        <h2 style={{ margin: "14px 0 0", font: `600 clamp(28px, 5vw, 44px)/1.05 ${SERIF}`, letterSpacing: "-0.015em", color: INK }}>
          {topicTitle}
        </h2>

        <p style={{ margin: "12px 0 0", maxWidth: "62ch", font: `italic 400 clamp(16px, 2vw, 18px)/1.55 ${SERIF}`, color: "rgba(43,37,33,.74)" }}>
          {blurb}
        </p>

        <div style={{ margin: "20px 0 6px" }}><Rule /></div>

        {span && (
          <div style={{ textAlign: "center", font: `500 10px ${SANS}`, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(43,37,33,.46)" }}>
            {span}
          </div>
        )}
      </div>

      <div style={{ position: "relative", padding: "clamp(24px, 4vw, 36px) clamp(18px, 4vw, 34px) 0" }}>
        {visible.map((e, i) => (
          <Entry
            key={e.id}
            e={e}
            index={i}
            unlockIndex={unlocking && i >= visibleBefore ? i - visibleBefore : null}
          />
        ))}
      </div>

      {videos && videos.length > 0 && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            margin: "clamp(8px, 2vw, 16px) clamp(18px, 4vw, 34px) 0",
            padding: "clamp(20px, 3vw, 26px) clamp(18px, 3vw, 24px)",
            background: "rgba(36,31,27,.045)",
            border: "1px solid rgba(43,37,33,.16)",
            borderRadius: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "6px" }}>
            <span
              aria-hidden="true"
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: ACCENT,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: "7px solid #fff", marginLeft: "2px" }} />
            </span>
            <h3 style={{ margin: 0, font: `600 clamp(19px, 2.2vw, 23px)/1.2 ${SERIF}`, color: INK }}>
              Shikoje të shpjeguar
            </h3>
          </div>

          <p style={{ margin: "0 0 16px", maxWidth: "58ch", font: `italic 400 15px/1.55 ${SERIF}`, color: "rgba(43,37,33,.7)" }}>
            Nese do të kuptosh temen nga fillimi, këto jane shpjegimet më të mira në anglisht — nga Al Jazeera, BBC, DW dhe institute ndërkombëtare.
          </p>

          <div className="dosje-video-grid">
            {videos.map((v) => (
              <a
                key={v.id}
                href={`https://www.youtube.com/watch?v=${v.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="dosje-video"
                style={{ display: "block", border: "1px solid rgba(43,37,33,.16)", background: "#fff", textDecoration: "none", overflow: "hidden" }}
              >
                <span style={{ display: "block", position: "relative" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block", background: "#EFE6D6" }}
                  />
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "50%",
                        background: "rgba(228,50,43,.92)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 14px rgba(17,17,17,.28)",
                      }}
                    >
                      <span style={{ width: 0, height: 0, borderTop: "7px solid transparent", borderBottom: "7px solid transparent", borderLeft: "12px solid #fff", marginLeft: "3px" }} />
                    </span>
                  </span>
                </span>
                <span style={{ display: "block", padding: "12px 14px 14px" }}>
                  <span style={{ display: "block", font: `600 14.5px/1.35 ${SERIF}`, color: INK }}>{v.title}</span>
                  <span style={{ display: "block", marginTop: "5px", font: `500 10.5px ${SANS}`, letterSpacing: "0.06em", color: MUTED }}>
                    {v.channel} · YouTube
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1, padding: "clamp(22px, 4vw, 30px) clamp(18px, 4vw, 34px)" }}>
        <div style={{ marginBottom: "16px" }}><Rule /></div>

        <div className="dosje-actions">
          {hidden > 0 && !showAll && (
            <button type="button" onClick={unlock} className="dosje-ghost dosje-btn">
              Shfaq {hidden} momente të tjera
            </button>
          )}
          <Link href={`/dosje/${topicSlug}`} className="dosje-action dosje-btn dosje-btn-primary">
            Dosja e plotë
          </Link>
        </div>

        <p style={{ margin: "14px 0 0", textAlign: "center", font: `italic 400 14px/1.5 ${SERIF}`, color: "rgba(43,37,33,.58)" }}>
          Kronologjia përditësohet me çdo artikull të ri.
        </p>
      </div>
      </div>
    </section>
  );
}
