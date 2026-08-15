// One foreign article, with the words that decided its label.
//
// Deliberately not a client component and deliberately motion-free: /toni
// renders it straight from the server, and the homepage module wraps it in a
// motion.div for its stagger. Keeping the animation outside is what lets both
// pages show the identical card instead of two that drift apart.

import { ExternalLink, Quote } from "lucide-react";
import { TONE_COLOR, TONE_INK } from "@/lib/tone-scale";
import type { ToneArticle } from "@/lib/tone-data";

export const TONE_META: Record<string, { label: string; color: string }> = {
  positive: { label: "Pozitiv", color: TONE_COLOR.positive },
  neutral: { label: "Neutral", color: TONE_COLOR.neutral },
  negative: { label: "Kritik", color: TONE_COLOR.critical },
};

export type ToneCardArticle = ToneArticle & { outlet: string; country?: string };

export default function ToneArticleCard({ a }: { a: ToneCardArticle }) {
  const meta = TONE_META[a.sentiment];

  return (
    <a
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block", padding: "14px 16px", background: "#FFFFFF",
        border: "1px solid #E8E3DB", borderLeft: `3px solid ${meta?.color ?? TONE_COLOR.neutral}`,
        borderRadius: "10px", textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "7px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "11.5px", fontWeight: 800, color: TONE_INK.strong }}>{a.outlet}</span>
        {/* Only where the articles come from many countries and the outlet
            alone doesn't place them — a topic list, not a country's own. */}
        {a.country && <span style={{ fontSize: "11px", color: TONE_INK.faint }}>· {a.country}</span>}
        {a.date && <span style={{ fontSize: "11px", color: TONE_INK.faint }}>· {a.date}</span>}
        <span style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: meta?.color ?? TONE_INK.muted, marginLeft: "auto" }}>
          {meta?.label ?? "—"}
        </span>
      </div>

      {/* Albanian first — the original is right underneath for anyone who
          wants to check the rendering. */}
      <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, lineHeight: 1.4, color: TONE_INK.strong }}>
        {a.albanianTitle || a.title}
      </p>
      {a.albanianTitle && a.albanianTitle !== a.title && (
        <p style={{ margin: "0 0 8px", fontSize: "12px", lineHeight: 1.45, color: TONE_INK.faint, fontStyle: "italic" }}>
          {a.title}
        </p>
      )}

      {/* The classifier has always had to produce this span to justify a
          non-neutral call — showing it turns the label from something the
          reader has to trust into something they can check. */}
      {a.evidence && a.sentiment !== "neutral" && (
        <p
          style={{
            margin: "9px 0 0", padding: "7px 11px",
            borderLeft: `2px solid ${meta?.color ?? TONE_COLOR.neutral}`,
            background: "#FAFAF8", borderRadius: "0 6px 6px 0",
            fontSize: "13px", lineHeight: 1.45, color: TONE_INK.strong,
            fontStyle: "italic",
          }}
        >
          «{a.evidence}»
        </p>
      )}

      {a.reason && (
        <p style={{ margin: "8px 0 0", fontSize: "12.5px", lineHeight: 1.5, color: TONE_INK.muted, display: "flex", gap: "7px", alignItems: "flex-start" }}>
          {a.isQuote && <Quote size={13} strokeWidth={2} style={{ flexShrink: 0, marginTop: "2px", color: TONE_INK.faint }} aria-label="Citim" />}
          <span>
            {a.isQuote && a.speaker ? `Citim i ${a.speaker}. ` : ""}
            {a.reason}
          </span>
        </p>
      )}

      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", marginTop: "10px", fontSize: "12px", fontWeight: 700, color: "#FF4422" }}>
        Lexo te {a.outlet} <ExternalLink size={12} strokeWidth={2.2} />
      </span>
    </a>
  );
}
