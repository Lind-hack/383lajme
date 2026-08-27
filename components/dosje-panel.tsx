"use client";

import { useState } from "react";
import DosjeDrawer from "@/components/dosje-drawer";
import DosjeMotifs from "@/components/dosje-motifs";
import { entryDate } from "@/lib/albanian-date.mjs";

/**
 * The dossier card beside an article — design 3a.
 *
 * A reader arriving at story nine of an ongoing subject has no way to know it
 * is story nine. This puts the arc next to the text: authored history first,
 * this archive's own coverage after it, and the piece being read marked in
 * place.
 *
 * A dossier is the record behind the story rather than the story, so it is set
 * on pale paper in a serif with a year gutter, and the figures of the period
 * are ghosted into the stock behind it.
 *
 * The spine is liquid, and it tracks the entry you have open rather than
 * sitting still: open something later and the level runs down to it, open
 * something earlier and it climbs back. Each segment carries its own delay,
 * measured from wherever the level previously stood, so the run reads as one
 * body moving rather than a set of bars recolouring together.
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
  source?: string | null;
  publishedAt?: string | null;
  isCurrent?: boolean;
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
const MUTED = "rgba(43,37,33,.5)";
const RULE = "rgba(43,37,33,.2)";
const ACCENT = "#E4322B";

const COMPACT_BEFORE = 3;
/** Per-segment delay as the level travels. Long enough to read as flow. */
const STAGGER_MS = 85;

function spanLabel(entries: DosjeEntry[]): string | null {
  const first = entries.find((e) => e.date || e.publishedAt);
  const last = [...entries].reverse().find((e) => e.date || e.publishedAt);
  const a = first ? entryDate(first) : null;
  const b = last ? entryDate(last) : null;
  if (!a || !b || a === b) return a ?? null;
  return `${a} — ${b}`;
}

export default function DosjePanel({ topicSlug, topicTitle, blurb, videos, entries }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const currentIndex = entries.findIndex((e) => e.isCurrent);
  const fallbackIndex = currentIndex >= 0 ? currentIndex : entries.length - 1;

  // Where the level is now, where it came from, and which way it is going.
  const activeIndex = openId ? entries.findIndex((e) => e.id === openId) : fallbackIndex;
  const [flowFrom, setFlowFrom] = useState(activeIndex);
  const [direction, setDirection] = useState<"down" | "up">("down");

  const toggle = (id: string) => {
    const next = openId === id ? null : id;
    const nextIndex = next ? entries.findIndex((e) => e.id === next) : fallbackIndex;
    setFlowFrom(activeIndex);
    setDirection(nextIndex >= activeIndex ? "down" : "up");
    setOpenId(next);
  };

  if (entries.length === 0) return null;

  const anchor = fallbackIndex;
  const start = showAll ? 0 : Math.max(0, anchor - COMPACT_BEFORE);
  const visible = showAll ? entries : entries.slice(start, anchor + 2);
  const hidden = entries.length - visible.length;
  const span = spanLabel(entries);

  const diamond = (size: number, color: string) => (
    <span
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: color,
        transform: "rotate(45deg)",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );

  const rule = (
    <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
      <span style={{ flex: 1, height: "1px", background: RULE }} />
      {diamond(5, "rgba(43,37,33,.35)")}
      <span style={{ flex: 1, height: "1px", background: RULE }} />
    </div>
  );

  return (
    <section
      aria-label={`Dosje: ${topicTitle}`}
      className="dosje-card-in"
      style={{
        position: "relative",
        background: "#FAF6F1",
        border: "1px solid rgba(43,37,33,.16)",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      <DosjeMotifs variant="rail" />

      <div style={{ position: "relative", padding: "20px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            {diamond(6, ACCENT)}
            <span style={{ font: `600 10px ${SANS}`, letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(43,37,33,.66)" }}>
              Dosje
            </span>
          </div>
          <span style={{ font: `500 11px ${SERIF}`, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>
            {entries.length} momente
          </span>
        </div>

        <h2 style={{ margin: "12px 0 0", font: `600 32px/1.08 ${SERIF}`, letterSpacing: "-0.01em", color: INK }}>
          {topicTitle}
        </h2>

        <div style={{ marginTop: "10px", font: `italic 400 15.5px/1.55 ${SERIF}`, color: "rgba(43,37,33,.72)" }}>{blurb}</div>

        <div style={{ margin: "16px 0 5px" }}>{rule}</div>

        {span && (
          <div style={{ textAlign: "center", font: `500 9.5px ${SANS}`, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(43,37,33,.46)" }}>
            {span}
          </div>
        )}
      </div>

      <div
        style={{
          position: "relative",
          padding: "20px 18px 0",
          maxHeight: showAll ? "660px" : undefined,
          overflowY: showAll ? "auto" : undefined,
        }}
      >
        {visible.map((e, i) => {
          const isOpen = openId === e.id;
          const idx = start + i;
          const filled = idx < activeIndex;
          const last = i === visible.length - 1;
          const date = entryDate(e);
          // Delay measured from where the level previously stood.
          const delay = Math.min(Math.abs(idx - flowFrom), 8) * STAGGER_MS;

          if (e.isCurrent) {
            return (
              <div key={e.id} style={{ display: "grid", gridTemplateColumns: "40px 16px 1fr" }}>
                <div />
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <div style={{ width: "11px", height: "11px", borderRadius: "50%", background: ACCENT, boxShadow: "0 0 0 4px rgba(228,50,43,.14)", marginTop: "5px" }} />
                </div>
                <div style={{ padding: "0 0 4px 2px" }}>
                  <div style={{ border: "1px solid rgba(228,50,43,.35)", background: "rgba(255,255,255,.62)", borderRadius: "12px", padding: "13px 14px" }}>
                    <div style={{ font: `600 9px ${SANS}`, letterSpacing: "0.2em", textTransform: "uppercase", color: ACCENT, marginBottom: "7px" }}>
                      Ky artikull{date ? ` · ${date}` : ""}
                    </div>
                    <div style={{ font: `600 18px/1.3 ${SERIF}`, color: INK }}>{e.title}</div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={e.id} style={{ display: "grid", gridTemplateColumns: "40px 16px 1fr" }}>
              <div style={{ textAlign: "right", paddingTop: "1px" }}>
                <span style={{ font: `500 16px ${SERIF}`, color: INK, letterSpacing: "0.02em" }}>{e.year}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: filled ? ACCENT : "#FDFBF8",
                    border: `1px solid ${filled ? ACCENT : "rgba(43,37,33,.5)"}`,
                    marginTop: "7px",
                    flexShrink: 0,
                    transition: "background-color .4s ease-out, border-color .4s ease-out",
                    transitionDelay: `${delay}ms`,
                  }}
                />
                {!last && (
                  <div
                    key={filled ? `fill-${activeIndex}` : `track-${activeIndex}`}
                    className={
                      filled
                        ? `dosje-seg dosje-seg-fill ${direction === "down" ? "dosje-seg-down" : "dosje-seg-up"}`
                        : "dosje-seg"
                    }
                    style={{ flex: 1, animationDelay: filled ? `0ms, ${delay}ms` : undefined, transitionDelay: `${delay}ms` }}
                  />
                )}
              </div>

              <div style={{ padding: "0 0 20px 2px", minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => toggle(e.id)}
                  aria-expanded={isOpen}
                  style={{ width: "100%", textAlign: "left", border: 0, background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {e.tag && (
                    <div style={{ font: `600 9px ${SANS}`, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, marginBottom: "5px" }}>
                      {e.tag}
                    </div>
                  )}

                  <div style={{ font: `600 18px/1.3 ${SERIF}`, color: INK }}>{e.title}</div>

                  {!isOpen ? (
                    <div style={{ marginTop: "7px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ font: `500 11.5px ${SANS}`, color: "rgba(43,37,33,.55)" }}>{date}</span>
                      <span style={{ flex: 1, height: "1px", background: "rgba(43,37,33,.14)" }} />
                      <span style={{ font: `600 9.5px ${SANS}`, letterSpacing: "0.16em", textTransform: "uppercase", color: ACCENT }}>Zgjero</span>
                    </div>
                  ) : (
                    <div>
                      <div style={{ marginTop: "7px", font: `500 11.5px ${SANS}`, color: "rgba(43,37,33,.55)" }}>
                        {date}
                        {e.source ? ` · ${e.source}` : ""}
                      </div>

                      {e.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.imageUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          style={{
                            width: "100%",
                            height: "128px",
                            objectFit: "cover",
                            borderRadius: "10px",
                            marginTop: "11px",
                            background: "#EFEAE2",
                          }}
                        />
                      )}

                      {e.summary && (
                        <div style={{ marginTop: "11px", font: `400 15px/1.68 ${SANS}`, color: "rgba(36,31,27,.9)" }}>{e.summary}</div>
                      )}

                      {e.why && (
                        <div style={{ marginTop: "13px", borderTop: "1px solid rgba(43,37,33,.16)", borderBottom: "1px solid rgba(43,37,33,.16)", padding: "12px 0" }}>
                          <div style={{ font: `600 9px ${SANS}`, letterSpacing: "0.2em", textTransform: "uppercase", color: ACCENT, marginBottom: "7px" }}>
                            Pse ka rëndësi
                          </div>
                          <div style={{ font: `italic 400 15.5px/1.6 ${SERIF}`, color: "rgba(36,31,27,.88)" }}>{e.why}</div>
                        </div>
                      )}

                      {e.slug && (
                        <div style={{ marginTop: "12px", font: `600 10px ${SANS}`, letterSpacing: "0.16em", textTransform: "uppercase", color: ACCENT }}>
                          Lexo artikullin →
                        </div>
                      )}
                    </div>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {videos && videos.length > 0 && (
        <div style={{ position: "relative", zIndex: 1, padding: "4px 18px 0" }}>
          <div style={{ marginBottom: "13px" }}>{rule}</div>
          <div style={{ font: `600 9px ${SANS}`, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, marginBottom: "4px" }}>
            Kuptoje më thellë
          </div>
          <div style={{ font: `italic 400 13.5px/1.5 ${SERIF}`, color: "rgba(43,37,33,.6)", marginBottom: "11px" }}>
            Shpjegime në anglisht, nga media dhe institute ndërkombëtare.
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            {videos.slice(0, 3).map((v) => (
              <a
                key={v.id}
                href={`https://www.youtube.com/watch?v=${v.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="dosje-video"
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                  padding: "8px 10px",
                  border: "1px solid rgba(43,37,33,.16)",
                  background: "rgba(255,255,255,.55)",
                  textDecoration: "none",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={{ width: "68px", height: "40px", objectFit: "cover", borderRadius: "7px", flexShrink: 0, background: "#EFE6D6" }}
                />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", font: `600 12.5px/1.35 ${SERIF}`, color: INK }}>{v.title}</span>
                  <span style={{ display: "block", marginTop: "2px", font: `500 10px ${SANS}`, color: MUTED }}>{v.channel}</span>
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1, padding: "20px 18px 22px" }}>
        <div style={{ marginBottom: "14px" }}>{rule}</div>

        {hidden > 0 && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="dosje-ghost"
            style={{
              width: "100%",
              height: "44px",
              marginBottom: "10px",
              border: "1px solid rgba(43,37,33,.22)",
              background: "transparent",
              color: INK,
              font: `600 10.5px ${SANS}`,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Shfaq {hidden} të tjera
          </button>
        )}

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="dosje-action"
          style={{
            width: "100%",
            height: "50px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: 0,
            background: ACCENT,
            color: "#fff",
            font: `700 11.5px ${SANS}`,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Hap dosjen e plotë
        </button>

        <div style={{ marginTop: "12px", textAlign: "center", font: `italic 400 13px/1.5 ${SERIF}`, color: "rgba(43,37,33,.58)" }}>
          Kronologjia përditësohet me çdo artikull të ri.
        </div>
      </div>

      <DosjeDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        topicSlug={topicSlug}
        topicTitle={topicTitle}
        blurb={blurb}
        videos={videos}
        entries={entries}
      />
    </section>
  );
}
