"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { DosjeEntry } from "@/components/dosje-panel";
import { entryDate } from "@/lib/albanian-date.mjs";
import DosjeMotifs from "@/components/dosje-motifs";

/**
 * The full dossier, over the article rather than away from it.
 *
 * The rail beside the text can hold a headline and a date; it cannot hold the
 * whole subject. Rather than send a reader to another page and lose the story
 * they were in the middle of, the rail opens this: the complete chronology,
 * with the real published imagery, at a width where it can be read.
 *
 * The spine is three effects stacked. It fills as you scroll (a scroll-driven
 * line drawing), a gradient loops inside the filled part so the colour appears
 * to travel through it, and the leading edge carries a pulse where fill meets
 * empty track. All three are motion for orientation, not decoration: the spine
 * tells you how deep into the subject's history you currently are. Under
 * prefers-reduced-motion the travel and the pulse stop and the fill remains,
 * because the fill is the part carrying information.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  topicSlug: string;
  topicTitle: string;
  blurb: string;
  /** Explainers in English. Every id was checked live before being added. */
  videos?: { id: string; channel: string; title: string }[];
  entries: DosjeEntry[];
}

export default function DosjeDrawer({ open, onClose, topicSlug, topicTitle, blurb, videos, entries }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [surge, setSurge] = useState(0);

  const toggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
    setSurge((n) => n + 1);
  };
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Scroll-driven fill: how far through the subject's history the reader is.
  const onScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    // A drawer that opens already scrolled shows a filled spine and lies about
    // depth, so measure once on open.
    requestAnimationFrame(onScroll);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, onScroll]);

  if (!open) return null;

  const milestones = entries.filter((e) => e.kind === "milestone").length;
  const articles = entries.length - milestones;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Dosje e plotë: ${topicTitle}`}
      style={{ position: "fixed", inset: 0, zIndex: 1200, display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={onClose}
        aria-hidden="true"
        className="dosje-scrim"
        style={{ position: "absolute", inset: 0, background: "rgba(17,17,17,0.44)", backdropFilter: "blur(2px)" }}
      />

      <aside
        className="dosje-drawer dosje-archival"
        style={{
          position: "relative",
          width: "min(720px, 94vw)",
          height: "100%",
          borderLeft: "1px solid #D9CFBB",
          boxShadow: "-24px 0 64px rgba(17,17,17,0.16)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid #E8E3DB",
            background: "#FFFFFF",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#FF4422" }} />
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "#6B6B6B",
                  }}
                >
                  Dosje e plotë
                </span>
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "clamp(22px, 3.2vw, 30px)",
                  fontWeight: 800,
                  lineHeight: 1.12,
                  letterSpacing: "-0.025em",
                  color: "#111111",
                }}
              >
                {topicTitle}
              </h2>
              <p style={{ margin: "8px 0 0", fontSize: "13.5px", lineHeight: 1.55, color: "#5A5A5A" }}>{blurb}</p>
              <p style={{ margin: "8px 0 0", fontSize: "11.5px", fontWeight: 700, color: "#9A9A9A" }}>
                {milestones} momente historike · {articles} artikuj nga 383
              </p>
            </div>

            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Mbyll dosjen"
              style={{
                marginLeft: "auto",
                flexShrink: 0,
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                border: "1px solid #E8E3DB",
                background: "#FFFFFF",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#111111",
              }}
            >
              <X size={18} strokeWidth={2.2} />
            </button>
          </div>
        </header>

        <div
          ref={bodyRef}
          onScroll={onScroll}
          style={{ flex: 1, overflowY: "auto", padding: "26px 24px 40px", position: "relative" }}
        >
          <div style={{ position: "relative" }}>
            <DosjeMotifs variant="full" />

            {/* The spine. Track, then the filled section that carries the flow. */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "17px",
                top: "6px",
                bottom: "6px",
                width: "6px",
                borderRadius: "6px",
                background: "rgba(140,118,86,0.20)",
                overflow: "hidden",
              }}
            >
              <div
                key={`fill-${surge}`}
                className="dosje-spine-fill dosje-surging"
                style={{ height: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <div
              aria-hidden="true"
              className="dosje-meniscus"
              style={{ top: `calc(6px + ${Math.round(progress * 100)}% - 4px)` }}
            />

            {entries.map((e) => {
              const isOpen = openId === e.id;
              const date = entryDate(e);

              return (
                <article key={e.id} style={{ position: "relative", paddingLeft: "48px", paddingBottom: "26px" }}>
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: e.isCurrent ? "11px" : "12.5px",
                      top: "6px",
                      width: e.isCurrent ? "15px" : "12px",
                      height: e.isCurrent ? "15px" : "12px",
                      borderRadius: "50%",
                      background: e.isCurrent ? "#FF4422" : "#FFFFFF",
                      border: e.isCurrent ? "none" : "2px solid #D8D2C8",
                      boxShadow: e.isCurrent ? "0 0 0 5px rgba(255,68,34,0.18)" : "none",
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => toggle(e.id)}
                    aria-expanded={isOpen}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "1px solid",
                      borderColor: e.isCurrent ? "rgba(255,68,34,0.32)" : "#E8E3DB",
                      background: e.isCurrent ? "rgba(255,68,34,0.05)" : "#FFFFFF",
                      borderRadius: "14px",
                      padding: "14px 16px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      display: "block",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "7px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "12px", fontWeight: 800, color: "#111111" }}>{date}</span>
                      {e.tag && (
                        <span
                          style={{
                            fontSize: "9.5px",
                            fontWeight: 700,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "#8A8A8A",
                          }}
                        >
                          {e.tag}
                        </span>
                      )}
                      {e.isCurrent && (
                        <span
                          style={{
                            fontSize: "9.5px",
                            fontWeight: 800,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "#FF4422",
                          }}
                        >
                          Ky artikull
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                      {e.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.imageUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          style={{
                            width: "104px",
                            height: "72px",
                            objectFit: "cover",
                            borderRadius: "9px",
                            flexShrink: 0,
                            background: "#EFEAE2",
                          }}
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          style={{
                            width: "104px",
                            height: "72px",
                            borderRadius: "9px",
                            flexShrink: 0,
                            background: "#F2ECE3",
                            border: "1px solid #E8E3DB",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "17px",
                            fontWeight: 800,
                            letterSpacing: "-0.02em",
                            color: "#B9B1A5",
                          }}
                        >
                          {e.year}
                        </span>
                      )}

                      <div style={{ minWidth: 0 }}>
                        <h3
                          style={{
                            margin: "0 0 5px",
                            fontSize: "15px",
                            fontWeight: 700,
                            lineHeight: 1.35,
                            color: "#111111",
                          }}
                        >
                          {e.title}
                        </h3>
                        {!isOpen && e.summary && (
                          <p
                            style={{
                              margin: 0,
                              fontSize: "12.5px",
                              lineHeight: 1.5,
                              color: "#6B6B6B",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {e.summary}
                          </p>
                        )}
                        {!isOpen && (
                          <span style={{ display: "inline-block", marginTop: "6px", fontSize: "10.5px", fontWeight: 700, color: "#FF4422" }}>
                            zgjero +
                          </span>
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div style={{ marginTop: "12px", borderTop: "1px solid #F0EBE3", paddingTop: "12px" }}>
                        {e.summary && (
                          <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.65, color: "#3F3F3F" }}>{e.summary}</p>
                        )}
                        {e.why && (
                          <div style={{ marginTop: "12px", borderLeft: "2px solid rgba(255,68,34,0.35)", paddingLeft: "12px" }}>
                            <div
                              style={{
                                fontSize: "9.5px",
                                fontWeight: 800,
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                color: "#FF4422",
                                marginBottom: "4px",
                              }}
                            >
                              Pse ka rëndësi
                            </div>
                            <p style={{ margin: 0, fontSize: "13.5px", lineHeight: 1.6, color: "#3F3F3F" }}>{e.why}</p>
                          </div>
                        )}
                        <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
                          {e.source && (
                            <span style={{ fontSize: "11px", fontWeight: 600, color: "#9A9A9A" }}>{e.source}</span>
                          )}
                          {e.slug && !e.isCurrent && (
                            <Link
                              href={`/article/${e.slug}`}
                              style={{ fontSize: "12px", fontWeight: 700, color: "#FF4422", textDecoration: "none" }}
                            >
                              Lexo artikullin →
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </button>
                </article>
              );
            })}
          </div>

          {videos && videos.length > 0 && (
            <section aria-label="Shpjegime në video" style={{ marginTop: "10px" }}>
              <div className="dosje-rule" style={{ marginBottom: "16px" }} />
              <h3
                className="dosje-inscription"
                style={{ margin: "0 0 4px", fontSize: "10px", fontWeight: 800, color: "#3E3527" }}
              >
                Shpjegime në video
              </h3>
              <p style={{ margin: "0 0 14px", fontSize: "11.5px", color: "#6A5D48", lineHeight: 1.5 }}>
                Në anglisht, nga media dhe institute ndërkombëtare. Hapen në YouTube.
              </p>

              <div style={{ display: "grid", gap: "10px" }}>
                {videos.map((v) => (
                  <a
                    key={v.id}
                    href={`https://www.youtube.com/watch?v=${v.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      gap: "12px",
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: "12px",
                      border: "1px solid rgba(140,118,86,0.28)",
                      background: "rgba(255,255,255,0.55)",
                      textDecoration: "none",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={92}
                      height={52}
                      style={{
                        width: "92px",
                        height: "52px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        flexShrink: 0,
                        background: "#EFE6D6",
                      }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          lineHeight: 1.35,
                          color: "#241F17",
                        }}
                      >
                        {v.title}
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginTop: "3px",
                          fontSize: "10.5px",
                          fontWeight: 600,
                          color: "#8C7752",
                        }}
                      >
                        {v.channel} · YouTube
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>

        <footer
          style={{
            flexShrink: 0,
            borderTop: "1px solid #E8E3DB",
            background: "#FFFFFF",
            padding: "12px 24px",
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "11.5px", color: "#9A9A9A", fontWeight: 600 }}>
            Kronologjia vazhdon me çdo artikull të ri.
          </span>
          <Link
            href={`/dosje/${topicSlug}`}
            style={{
              marginLeft: "auto",
              height: "36px",
              display: "inline-flex",
              alignItems: "center",
              padding: "0 14px",
              borderRadius: "9px",
              border: "1px solid #E8E3DB",
              color: "#111111",
              fontSize: "12.5px",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Hape si faqe →
          </Link>
        </footer>
      </aside>
    </div>
  );
}
