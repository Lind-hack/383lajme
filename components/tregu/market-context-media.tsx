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
  const [src, setSrc] = useState(media?.src ?? "");
  const [hidden, setHidden] = useState(!media);

  useEffect(() => {
    setSrc(media?.src ?? "");
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
      {/* Arbitrary verified news domains are intentionally rendered as a raw
          image. The deterministic owned fallback handles a broken hotlink. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        loading={variant === "detail" ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          if (src !== media.fallbackSrc) setSrc(media.fallbackSrc);
          else setHidden(true);
        }}
      />
      <figcaption>
        <span>{CONTEXT_LABEL[media.context]}</span>
        <strong>{media.kind === "source_article" ? "Pamje nga lajmi" : "Pamje orientuese"}</strong>
      </figcaption>
    </figure>
  );
}
