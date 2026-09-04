"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Film, ImageOff } from "lucide-react";

/**
 * One picture, in the state it is actually in.
 *
 * The whole point of rendering dossier media is that the approver can judge
 * whether the image belongs to its milestone. A URL that 404s renders as an
 * empty grey rectangle, which looks like a plain image rather than a broken
 * one -- and a milestone with a dead picture then reads as fine. Some rows have
 * never been checked at all (check_status null), so the failure is only visible
 * at render time, which is why this is a client component.
 */
export default function MediaThumb({
  src,
  alt,
  isVideo,
}: {
  src: string;
  alt: string;
  isVideo: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  /**
   * onError alone is not enough. A URL that has already failed once is served
   * from the browser cache as a completed-but-empty image, and that happens
   * before React attaches the handler on the next render -- so the second visit
   * to a dossier showed a dead picture as a plain grey box again. Re-checking
   * on mount catches the image that broke before anyone was listening.
   */
  const check = useCallback((node: HTMLImageElement | null) => {
    imgRef.current = node;
    if (node?.complete && node.naturalWidth === 0) setFailed(true);
  }, []);

  useEffect(() => {
    const node = imgRef.current;
    if (node?.complete && node.naturalWidth === 0) setFailed(true);
  }, [src]);

  return (
    <div className="relative aspect-video">
      {src && !failed ? (
        <Image
          ref={check}
          src={src}
          alt={alt}
          fill
          unoptimized
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center"
          style={{ color: "var(--a-danger)" }}
        >
          <ImageOff size={17} aria-hidden />
          <span className="text-[10px] font-bold leading-tight">
            {src ? "Nuk u ngarkua" : "Pa URL"}
          </span>
        </span>
      )}

      {isVideo && !failed && (
        <span
          className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10px] font-bold"
          style={{ background: "rgba(20,18,15,0.78)", color: "#fff" }}
        >
          <Film size={10} aria-hidden />
          Video
        </span>
      )}
    </div>
  );
}
