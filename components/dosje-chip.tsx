"use client";

import { useRouter } from "next/navigation";
import type { Article } from "@/lib/mock-data";
import { dosjeLinkForArticle, isDosjeActivationKey } from "@/lib/dosje-feed.mjs";

interface Props {
  article: Pick<Article, "title" | "excerpt" | "category">;
  dark?: boolean;
  compact?: boolean;
}

/**
 * A discoverable, keyboard-operable dossier destination inside an article
 * card. The parent card still opens the article; this chip opens the full file.
 */
export default function DosjeChip({ article, dark = false, compact = false }: Props) {
  const router = useRouter();
  const link = dosjeLinkForArticle(article);
  if (!link) return null;
  const dossierHref = link.href;
  const dossierTitle = link.title;

  function blockParent(event: React.SyntheticEvent) {
    event.stopPropagation();
  }

  function open(event: React.MouseEvent | React.KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();
    // A chip lives inside a card link. Capture the activation before that
    // parent link can handle it, then use the exact dossier destination.
    router.push(dossierHref);
  }

  return (
    <span
      role="link"
      tabIndex={0}
      data-dosje-chip={link.slug}
      aria-label={`Hap dosjen: ${dossierTitle}`}
      title={`Hap dosjen: ${dossierTitle}`}
      onPointerDownCapture={open}
      onMouseDownCapture={blockParent}
      onClickCapture={blockParent}
      onKeyDownCapture={(event) => {
        if (isDosjeActivationKey(event.key)) open(event);
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? "5px" : "6px",
        maxWidth: "100%",
        padding: compact ? "4px 8px" : "5px 10px",
        borderRadius: "999px",
        border: dark ? "1px solid rgba(255,255,255,.42)" : "1px solid rgba(228,50,43,.32)",
        background: dark ? "rgba(228,50,43,.22)" : "#fff7f3",
        color: dark ? "#fff" : "#a9362d",
        cursor: "pointer",
        userSelect: "none",
        outline: "none",
        fontSize: compact ? "9px" : "10px",
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        lineHeight: 1.2,
      }}
    >
      <span aria-hidden="true" style={{ width: "6px", height: "6px", borderRadius: "50%", background: dark ? "#ff8a73" : "#e4322b", flexShrink: 0 }} />
      <span style={{ flexShrink: 0 }}>Dosje</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, letterSpacing: "0.02em", textTransform: "none" }}>
        {dossierTitle}
      </span>
    </span>
  );
}
