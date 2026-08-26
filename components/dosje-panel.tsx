"use client";

import { useState } from "react";
import DosjeDrawer from "@/components/dosje-drawer";
import { entryDate } from "@/lib/albanian-date.mjs";

/**
 * The dossier rail beside an article.
 *
 * A reader arriving at story nine of an ongoing subject has no way to know it
 * is story nine. This puts the arc next to the text: authored history first,
 * this archive's own coverage after it, and the piece being read marked in
 * place, so its position in the sequence is visible without leaving the page.
 *
 * The rail is a real view of the dossier, not an advert for one. It carries
 * the thumbnails, the written-out dates and the flowing spine, because a
 * reader who never presses the button should still get the story. The drawer
 * is for depth, not for the first useful thing.
 *
 * The spine fills from the beginning of the subject up to the article being
 * read, and the flow runs inside that filled length only. Filled means
 * "already happened"; the grey remainder is what came after this story.
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

const COMPACT_BEFORE = 3;

export default function DosjePanel({ topicSlug, topicTitle, blurb, videos, entries }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Bumped on every expand. Remounting the filled segments restarts their
  // surge animation, which is what makes the click visibly move the liquid.
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

  const firstYear = (entries.map((e) => e.year).filter(Boolean) as string[]).find((y) =>
    /^\d{4}$/.test(y)
  );

  return (
    <section
      aria-label={`Dosje: ${topicTitle}`}
      className="dosje-archival"
      style={{
        border: "1px solid #D9CFBB",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(120,98,68,0.10), inset 0 0 0 1px rgba(255,255,255,0.45)",
      }}
    >
      <div style={{ position: "relative", padding: "16px 18px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "9px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#FF4422" }} />
          <span
            className="dosje-inscription"
            style={{ fontSize: "10px", fontWeight: 800, color: "#3E3527" }}
          >
            Dosje
          </span>
          {currentIndex >= 0 && (
            <span style={{ marginLeft: "auto", fontSize: "10.5px", fontWeight: 700, color: "#9A9A9A" }}>
              {currentIndex + 1}/{entries.length}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: "19px",
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            color: "#111111",
          }}
        >
          {topicTitle}
        </div>
        <div style={{ marginTop: "7px", fontSize: "11.5px", fontWeight: 500, lineHeight: 1.5, color: "#6A5D48" }}>
          {entries.length} momente{firstYear ? ` · ${firstYear} deri sot` : ""}. {blurb}
        </div>
        <div className="dosje-rule" style={{ marginTop: "13px" }} />
      </div>

      <div
        style={{
          maxHeight: showAll ? "620px" : undefined,
          overflowY: showAll ? "auto" : undefined,
          padding: "16px 18px 6px",
        }}
      >
        {visible.map((e, i) => {
          const isOpen = openId === e.id;
          const last = i === visible.length - 1;
          const absoluteIndex = start + i;
          // Filled up to the article being read; grey after it.
          const flows = currentIndex >= 0 && absoluteIndex < currentIndex;
          const date = entryDate(e);

          return (
            <div key={e.id} style={{ display: "grid", gridTemplateColumns: "14px 1fr", gap: "11px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span
                  style={
                    e.isCurrent
                      ? {
                          width: "12px",
                          height: "12px",
                          borderRadius: "50%",
                          background: "#FF4422",
                          boxShadow: "0 0 0 4px rgba(255,68,34,0.16)",
                          marginTop: "5px",
                          flexShrink: 0,
                        }
                      : {
                          width: "9px",
                          height: "9px",
                          borderRadius: "50%",
                          background: flows ? "#FF4422" : "#FFFFFF",
                          border: flows ? "2px solid #FF4422" : "2px solid #D8D2C8",
                          marginTop: "6px",
                          flexShrink: 0,
                        }
                  }
                />
                {!last && (
                  <span
                    key={flows ? `flow-${surge}` : "track"}
                    className={flows ? "dosje-rail-flow dosje-surging" : undefined}
                    style={{
                      width: flows ? undefined : "2px",
                      flex: 1,
                      marginTop: "6px",
                      borderRadius: "2px",
                      background: flows ? undefined : "rgba(140,118,86,0.22)",
                    }}
                  />
                )}
              </div>

              <div style={{ paddingBottom: "16px", minWidth: 0 }}>
                {e.isCurrent ? (
                  <div
                    style={{
                      background: "rgba(255,68,34,0.06)",
                      border: "1px solid rgba(255,68,34,0.28)",
                      borderRadius: "11px",
                      padding: "12px 13px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "9px",
                        fontWeight: 800,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        color: "#FF4422",
                        marginBottom: "7px",
                      }}
                    >
                      Ky artikull{date ? ` · ${date}` : ""}
                    </div>
                    <div style={{ fontSize: "13.5px", fontWeight: 700, lineHeight: 1.35, color: "#111111" }}>
                      {e.title}
                    </div>
                  </div>
                ) : (
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
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                      <span style={{ fontSize: "11.5px", fontWeight: 800, color: "#111111" }}>{e.year}</span>
                      {e.tag && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: "#8A8A8A",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {e.tag}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                      {e.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.imageUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className={isOpen ? undefined : "dosje-photo"}
                          style={{
                            width: "52px",
                            height: "40px",
                            objectFit: "cover",
                            borderRadius: "7px",
                            flexShrink: 0,
                            background: "#EFEAE2",
                          }}
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="dosje-plate"
                          style={{
                            width: "52px",
                            height: "40px",
                            borderRadius: "7px",
                            flexShrink: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "11px",
                            fontWeight: 800,
                          }}
                        >
                          {e.year}
                        </span>
                      )}

                      <span style={{ minWidth: 0, display: "block" }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: "12.5px",
                            fontWeight: 600,
                            lineHeight: 1.35,
                            color: "#2B2B2B",
                          }}
                        >
                          {e.title}
                        </span>
                        {!isOpen && (
                          <span
                            style={{
                              display: "block",
                              marginTop: "4px",
                              fontSize: "10.5px",
                              fontWeight: 600,
                              color: "#9A9A9A",
                            }}
                          >
                            {date ? `${date} · ` : ""}
                            <span style={{ color: "#FF4422", fontWeight: 700 }}>zgjero +</span>
                          </span>
                        )}
                      </span>
                    </div>

                    {isOpen && (
                      <div style={{ marginTop: "10px", borderLeft: "2px solid #EFEAE2", paddingLeft: "11px" }}>
                        {e.summary && (
                          <div style={{ fontSize: "12.5px", lineHeight: 1.6, color: "#5A5A5A" }}>{e.summary}</div>
                        )}
                        {e.why && (
                          <>
                            <div
                              style={{
                                marginTop: "9px",
                                marginBottom: "4px",
                                fontSize: "9px",
                                fontWeight: 800,
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                color: "#FF4422",
                              }}
                            >
                              Pse ka rëndësi
                            </div>
                            <div style={{ fontSize: "12.5px", fontWeight: 500, lineHeight: 1.55, color: "#3F3F3F" }}>
                              {e.why}
                            </div>
                          </>
                        )}
                        <span
                          style={{
                            display: "block",
                            marginTop: "9px",
                            fontSize: "10.5px",
                            fontWeight: 700,
                            color: "#9A9A9A",
                          }}
                        >
                          {date}
                          {e.source ? ` · ${e.source}` : ""}
                        </span>
                      </div>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "relative",
          borderTop: "1px solid rgba(140,118,86,0.24)",
          padding: "12px 18px",
          display: "flex",
          gap: "9px",
        }}
      >
        {hidden > 0 && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            style={{
              flex: 1,
              height: "38px",
              border: "1px solid #E8E3DB",
              borderRadius: "9px",
              background: "#FFFFFF",
              color: "#111111",
              fontSize: "12.5px",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Shfaq {hidden} të tjera
          </button>
        )}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          style={{
            flex: 1,
            height: "38px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "9px",
            border: 0,
            background: "#FF4422",
            color: "#FFFFFF",
            fontSize: "12.5px",
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Dosja e plotë →
        </button>
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
