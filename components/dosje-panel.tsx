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
 * The register is deliberately not the news register. A dossier is the record
 * behind the story, so it is set on pale paper in a serif, with a year gutter,
 * an inscribed rule, and the figures of the period ghosted into the stock
 * behind it. Everything here follows the imported 3a spec: the diamond mark,
 * the 34px Garamond title, the italic lead, the 40/16/1fr timeline grid, the
 * tag in letterspaced caps, and the full-width closing action.
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
const INK = "#2B2521";
const MUTED = "rgba(43,37,33,.45)";
const RULE = "rgba(43,37,33,.2)";
const ACCENT = "#E4322B";

const COMPACT_BEFORE = 3;

/** "12 qershor 1999 — 22 gusht 2026", from whatever the timeline actually holds. */
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
  // Bumped on every expand; remounting the filled spine restarts its surge.
  const [surge, setSurge] = useState(0);

  const toggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
    setSurge((n) => n + 1);
  };

  if (entries.length === 0) return null;

  const currentIndex = entries.findIndex((e) => e.isCurrent);
  const anchor = currentIndex >= 0 ? currentIndex : entries.length - 1;
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
      style={{
        position: "relative",
        background: "#FAF6F1",
        border: "1px solid rgba(43,37,33,.16)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
      }}
    >
      <DosjeMotifs variant="rail" />

      <div style={{ position: "relative", padding: "20px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            {diamond(6, ACCENT)}
            <span
              style={{
                font: `600 9.5px ${SANS}`,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "rgba(43,37,33,.62)",
              }}
            >
              Dosje
            </span>
          </div>
          <span
            style={{
              font: `500 10px ${SERIF}`,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            {entries.length} momente
          </span>
        </div>

        <h2 style={{ margin: "12px 0 0", font: `600 34px/1.04 ${SERIF}`, letterSpacing: "-0.01em", color: INK }}>
          {topicTitle}
        </h2>

        <div style={{ marginTop: "9px", font: `italic 400 15px/1.5 ${SERIF}`, color: "rgba(43,37,33,.66)" }}>
          {blurb}
        </div>

        <div style={{ margin: "15px 0 4px" }}>{rule}</div>

        {span && (
          <div
            style={{
              textAlign: "center",
              font: `500 9px ${SANS}`,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(43,37,33,.42)",
            }}
          >
            {span}
          </div>
        )}
      </div>

      <div
        style={{
          position: "relative",
          padding: "20px 18px 0",
          maxHeight: showAll ? "640px" : undefined,
          overflowY: showAll ? "auto" : undefined,
        }}
      >
        {visible.map((e, i) => {
          const isOpen = openId === e.id;
          const absoluteIndex = start + i;
          const flows = currentIndex >= 0 && absoluteIndex < currentIndex;
          const date = entryDate(e);
          const last = i === visible.length - 1;

          if (e.isCurrent) {
            return (
              <div key={e.id} style={{ display: "grid", gridTemplateColumns: "40px 16px 1fr" }}>
                <div />
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <div
                    style={{
                      width: "11px",
                      height: "11px",
                      borderRadius: "50%",
                      background: ACCENT,
                      boxShadow: "0 0 0 4px rgba(228,50,43,.14)",
                      marginTop: "5px",
                    }}
                  />
                </div>
                <div style={{ padding: "0 0 4px 2px" }}>
                  <div style={{ border: "1px solid rgba(228,50,43,.35)", background: "rgba(255,255,255,.5)", padding: "13px 14px" }}>
                    <div
                      style={{
                        font: `600 8.5px ${SANS}`,
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        color: ACCENT,
                        marginBottom: "7px",
                      }}
                    >
                      Ky artikull{date ? ` · ${date}` : ""}
                    </div>
                    <div style={{ font: `600 17px/1.28 ${SERIF}`, color: INK }}>{e.title}</div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={e.id} style={{ display: "grid", gridTemplateColumns: "40px 16px 1fr" }}>
              <div style={{ textAlign: "right", paddingTop: "1px" }}>
                <span style={{ font: `500 15px ${SERIF}`, color: INK, letterSpacing: "0.02em" }}>{e.year}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: flows ? ACCENT : "#FDFBF8",
                    border: `1px solid ${flows ? ACCENT : "rgba(43,37,33,.5)"}`,
                    marginTop: "7px",
                    flexShrink: 0,
                  }}
                />
                {!last && (
                  <div
                    key={flows ? `flow-${surge}` : "track"}
                    className={flows ? "dosje-rail-flow dosje-surging" : undefined}
                    style={{
                      width: flows ? undefined : "1px",
                      flex: 1,
                      background: flows ? undefined : "rgba(43,37,33,.22)",
                    }}
                  />
                )}
              </div>

              <div style={{ padding: "0 0 20px 2px", minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => toggle(e.id)}
                  aria-expanded={isOpen}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: 0,
                    background: "transparent",
                    padding: 0,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {e.tag && (
                    <div
                      style={{
                        font: `600 8.5px ${SANS}`,
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        color: MUTED,
                        marginBottom: "5px",
                      }}
                    >
                      {e.tag}
                    </div>
                  )}

                  <div style={{ font: `600 17px/1.28 ${SERIF}`, color: INK }}>{e.title}</div>

                  {!isOpen ? (
                    <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ font: `500 11px ${SANS}`, color: "rgba(43,37,33,.5)" }}>{date}</span>
                      <span style={{ flex: 1, height: "1px", background: "rgba(43,37,33,.14)" }} />
                      <span
                        style={{
                          font: `600 9px ${SANS}`,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: ACCENT,
                        }}
                      >
                        Zgjero
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div style={{ marginTop: "6px", font: `500 11px ${SANS}`, color: "rgba(43,37,33,.5)" }}>
                        {date}
                        {e.source ? ` · ${e.source}` : ""}
                      </div>

                      {e.summary && (
                        <div style={{ marginTop: "10px", font: `400 14px/1.62 ${SANS}`, color: "rgba(43,37,33,.82)" }}>
                          {e.summary}
                        </div>
                      )}

                      {e.why && (
                        <div
                          style={{
                            marginTop: "12px",
                            borderTop: "1px solid rgba(43,37,33,.16)",
                            borderBottom: "1px solid rgba(43,37,33,.16)",
                            padding: "11px 0",
                          }}
                        >
                          <div
                            style={{
                              font: `600 8.5px ${SANS}`,
                              letterSpacing: "0.22em",
                              textTransform: "uppercase",
                              color: ACCENT,
                              marginBottom: "6px",
                            }}
                          >
                            Pse ka rëndësi
                          </div>
                          <div style={{ font: `italic 400 14.5px/1.5 ${SERIF}`, color: "rgba(43,37,33,.8)" }}>{e.why}</div>
                        </div>
                      )}

                      {e.slug && (
                        <div
                          style={{
                            marginTop: "11px",
                            font: `600 9.5px ${SANS}`,
                            letterSpacing: "0.18em",
                            textTransform: "uppercase",
                            color: ACCENT,
                          }}
                        >
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

      <div style={{ position: "relative", zIndex: 1, padding: "22px 18px" }}>
        <div style={{ marginBottom: "14px" }}>{rule}</div>

        {hidden > 0 && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            style={{
              width: "100%",
              height: "42px",
              marginBottom: "9px",
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
          style={{
            width: "100%",
            height: "48px",
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
          Dosja e plotë
        </button>

        <div style={{ marginTop: "11px", textAlign: "center", font: `italic 400 13px/1.5 ${SERIF}`, color: "rgba(43,37,33,.55)" }}>
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
