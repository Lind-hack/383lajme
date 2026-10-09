"use client";

import s from "./bota.module.css";
import { useEffect, useRef } from "react";

export default function BriefImage({ src, lead = false, onUnavailable }: { src: string; lead?: boolean; onUnavailable: () => void }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // A cached failure may happen before hydration attaches the error handler.
    if (image.current?.complete && image.current.naturalWidth === 0) onUnavailable();
  }, [src, onUnavailable]);
  // The story's headline supplies context; a failed publisher photo leaves the ink surface intact.
  // eslint-disable-next-line @next/next/no-img-element -- publisher photos use the existing image proxy
  return <img ref={image} className={lead ? s.leadPhoto : s.supportPhoto} src={src} width={960} height={640}
    alt="" loading={lead ? "eager" : "lazy"} fetchPriority={lead ? "high" : "auto"}
    onError={(event) => {
      event.currentTarget.style.display = "none";
      onUnavailable();
    }} />;
}
