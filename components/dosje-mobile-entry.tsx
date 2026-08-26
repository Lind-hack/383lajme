"use client";

import { useState } from "react";
import DosjeDrawer from "@/components/dosje-drawer";
import type { DosjeEntry } from "@/components/dosje-panel";

/**
 * The dossier, on phones.
 *
 * The rail lives in the sidebar column, and that column is hidden below
 * 1024px — so without this, the entire dossier is invisible to most of the
 * audience. This is the mirror of the rail's breakpoint: it shows only where
 * the rail does not, so exactly one entry point exists at any width.
 *
 * It is a bar rather than a copy of the rail because vertical space in a phone
 * article is the scarcest thing on the page. It states what the dossier is and
 * how deep it goes, and opens the same drawer the rail opens.
 */

interface Props {
  topicSlug: string;
  topicTitle: string;
  blurb: string;
  videos?: { id: string; channel: string; title: string }[];
  entries: DosjeEntry[];
}

export default function DosjeMobileEntry({ topicSlug, topicTitle, blurb, videos, entries }: Props) {
  const [open, setOpen] = useState(false);

  if (entries.length === 0) return null;

  const position = entries.findIndex((e) => e.isCurrent) + 1;

  return (
    <div className="dosje-mobile-entry" style={{ margin: "28px 0 8px" }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "14px 16px",
          borderRadius: "var(--radius-md)",
          border: "1px solid rgba(255,68,34,0.28)",
          background: "rgba(255,68,34,0.05)",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
          minHeight: "44px",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: "9px",
            height: "9px",
            borderRadius: "50%",
            background: "#FF4422",
            flexShrink: 0,
          }}
        />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span
            style={{
              display: "block",
              fontSize: "9.5px",
              fontWeight: 800,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#FF4422",
              marginBottom: "3px",
            }}
          >
            Dosje
          </span>
          <span style={{ display: "block", fontSize: "14.5px", fontWeight: 700, color: "#111111", lineHeight: 1.3 }}>
            {topicTitle}
          </span>
          <span style={{ display: "block", marginTop: "3px", fontSize: "11.5px", fontWeight: 600, color: "#6B6B6B" }}>
            {position > 0
              ? `Ky artikull është zhvillimi ${position} nga ${entries.length}`
              : `${entries.length} momente në këtë temë`}
          </span>
        </span>
        <span style={{ fontSize: "13px", fontWeight: 800, color: "#FF4422", flexShrink: 0 }}>→</span>
      </button>

      <DosjeDrawer
        open={open}
        onClose={() => setOpen(false)}
        topicSlug={topicSlug}
        topicTitle={topicTitle}
        blurb={blurb}
        videos={videos}
        entries={entries}
      />

      <style>{`
        /* The rail owns the dossier from 1024px up; this bar owns it below,
           so the two never appear together. */
        @media (min-width: 1024px) {
          .dosje-mobile-entry { display: none; }
        }
      `}</style>
    </div>
  );
}
