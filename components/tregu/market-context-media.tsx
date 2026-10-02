"use client";

import { useEffect, useState } from "react";
import type { MarketMedia } from "@/lib/tregu-market-media.mjs";

const CONTEXT_LABEL: Record<MarketMedia["context"], string> = {
  kosovo: "Kosovë",
  albania: "Shqipëri",
  world: "Botë",
  economy: "Ekonomi",
};

export default function MarketContextMedia({
  media,
  variant = "card",
}: {
  media: MarketMedia | null | undefined;
  variant?: "card" | "featured" | "detail";
}) {
  const [hidden, setHidden] = useState(!media);

  useEffect(() => {
    setHidden(!media);
  }, [media]);

  if (!media || hidden) return null;

  return (
    <figure
      className="tregu-context-media"
      data-variant={variant}
      data-context={media.context}
      data-kind={media.kind}
      aria-label={`Pamje konteksti: ${CONTEXT_LABEL[media.context]}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={media.src}
        alt={media.kind === "market_identity" ? media.title ?? "Pamje e subjektit të tregut" : ""}
        aria-hidden={media.kind !== "market_identity"}
        loading={variant === "detail" ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setHidden(true)}
      />
      <figcaption>
        <span>{CONTEXT_LABEL[media.context]}</span>
        <strong>{media.kind === "market_identity" ? "Subjekti i tregut" : "Pamje nga lajmi"}</strong>
        {variant === "detail" && /^https:\/\//i.test(media.source ?? "") && (
          <a href={media.source!} target="_blank" rel="noopener noreferrer">{media.credit || "Burimi i pamjes"}</a>
        )}
      </figcaption>
    </figure>
  );
}
