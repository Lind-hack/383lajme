"use client";

// Article imagery for the homepage.
//
// This is a client component for exactly one reason: onError. Article images are
// hotlinked from arbitrary publishers (next.config.ts allows every https host),
// so a dead or hotlink-blocked image is routine, not exceptional. Without a
// fallback the card renders a broken-image glyph, which looks like the site is
// broken rather than like one publisher moved a file.
//
// It also owns the page's single `priority` hint. Lighthouse resolves the
// homepage LCP to the lead story's image; `priority` gives it eager loading,
// fetchpriority=high and a preload link. A second priority hint anywhere on the
// page only dilutes this one, so exactly one caller may pass it.

import Image from "next/image";
import { useState } from "react";

export default function ArticleImage({
  src,
  alt = "",
  sizes,
  priority = false,
  accent = "#FF4422",
  radius = 0,
}: {
  src?: string;
  alt?: string;
  sizes: string;
  priority?: boolean;
  /** Tints the placeholder so a missing image still reads as its category. */
  accent?: string;
  radius?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius ? `${radius}px` : undefined,
          background: `linear-gradient(135deg, ${accent}cc 0%, ${accent}44 100%)`,
        }}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      // Decorative when the headline beside it already carries the meaning.
      aria-hidden={alt ? undefined : "true"}
      fill
      sizes={sizes}
      priority={priority}
      onError={() => setFailed(true)}
      style={{
        objectFit: "cover",
        borderRadius: radius ? `${radius}px` : undefined,
      }}
    />
  );
}
