import Image from "next/image";
import type { CSSProperties } from "react";
import { DARDANI_STILLS, type DardaniStillName } from "@/lib/dardani-assets";

/**
 * One Dardani still, looked up by name in lib/dardani-assets.ts.
 *
 * Size it from the outside (a height or width in `style`/`className`); the
 * intrinsic size from the manifest only fixes the aspect ratio so nothing
 * shifts while it loads. `decorative` is for a face inside a button or next
 * to text that already says who it is: the alt text would only be read twice.
 */
export default function DardaniImage({
  name,
  alt,
  decorative = false,
  className,
  style,
  priority = false,
  unoptimized = false,
  sizes,
}: {
  name: DardaniStillName;
  alt?: string;
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
  /** Serve the file as built, for images that are preloaded by their own URL. */
  unoptimized?: boolean;
  sizes?: string;
}) {
  const still = DARDANI_STILLS[name];
  return (
    <Image
      src={still.src}
      width={still.width}
      height={still.height}
      alt={decorative ? "" : (alt ?? still.alt)}
      className={className}
      style={{ width: "auto", ...style }}
      priority={priority}
      unoptimized={unoptimized}
      sizes={sizes}
      draggable={false}
    />
  );
}
