"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DARDANI_LOOPS, type DardaniLoopName } from "@/lib/dardani-assets";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

/**
 * One Dardani loop, looked up by name in lib/dardani-assets.ts.
 *
 * The server renders only the loop's first frame, so there is something on
 * screen before any video loads and no hydration mismatch over which source a
 * browser can play. The video mounts over it after hydration:
 *
 *   - WebM (VP9 with alpha) first, MP4 second, as the asset map asks.
 *   - Except on WebKit. Safari will play a VP9 WebM but drops its alpha plane
 *     and paints a black box, so source order alone does not make it fall back.
 *     Every iOS browser is WebKit too; all of them get the MP4, which is
 *     flattened onto the site cream so its edges disappear on #F9F6F1.
 *   - Under prefers-reduced-motion no video is mounted; the still stays.
 *
 * Changing `name` hands over in two beats rather than a cut or a cross-fade:
 * the current Dardani dips out (170ms), then the new one hops in with a little
 * overshoot. One Dardani on screen at a time — a cross-fade of two transparent
 * videos shows both birds stacked for its whole length. The loops themselves
 * are never trimmed or faded at their own loop point.
 */
type Phase = "idle" | "out" | "in";

export default function DardaniLoop({
  name,
  alt,
  decorative = false,
  fit = "contain",
  className,
  style,
}: {
  name: DardaniLoopName;
  alt?: string;
  decorative?: boolean;
  fit?: "contain" | "cover";
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = usePrefersReducedMotion();
  const [engine, setEngine] = useState<"none" | "webkit" | "other">("none");
  const [shown, setShown] = useState<{ name: DardaniLoopName; id: number; phase: Phase }>({
    name,
    id: 0,
    phase: "idle",
  });
  /** The loop to hop in once the current one has finished dipping out. */
  const pending = useRef<DardaniLoopName>(name);

  useEffect(() => {
    setEngine(/Apple/.test(navigator.vendor) ? "webkit" : "other");
  }, []);

  useEffect(() => {
    pending.current = name;
    setShown((s) => {
      if (s.name === name) return s.phase === "out" ? { ...s, phase: "idle" } : s;
      // Reduced motion: swap in place, no travel.
      if (reduced) return { name, id: s.id + 1, phase: "idle" };
      return s.phase === "out" ? s : { ...s, phase: "out" };
    });
  }, [name, reduced]);

  const onPhaseEnd = () =>
    setShown((s) =>
      s.phase === "out"
        ? { name: pending.current, id: s.id + 1, phase: "in" }
        : s.phase === "in"
          ? { ...s, phase: "idle" }
          : s,
    );

  const loop = DARDANI_LOOPS[shown.name];
  const label = decorative ? undefined : (alt ?? loop.alt);

  return (
    <span
      className={["dardani-loop", className].filter(Boolean).join(" ")}
      style={
        {
          "--dl-ratio": `${loop.width} / ${loop.height}`,
          "--dl-fit": fit,
          ...style,
        } as CSSProperties
      }
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Layer
        key={shown.id}
        name={shown.name}
        phase={shown.phase}
        animate={engine !== "none" && !reduced}
        webkit={engine === "webkit"}
        onPhaseEnd={onPhaseEnd}
      />
    </span>
  );
}

function Layer({
  name,
  phase,
  animate,
  webkit,
  onPhaseEnd,
}: {
  name: DardaniLoopName;
  phase: Phase;
  animate: boolean;
  webkit: boolean;
  onPhaseEnd: () => void;
}) {
  const loop = DARDANI_LOOPS[name];
  // The still is hidden once the video is really playing: behind a
  // transparent WebM it would otherwise show through as a ghost of frame one.
  const [playing, setPlaying] = useState(false);

  return (
    <span
      className="dardani-loop-layer"
      data-phase={phase === "idle" ? undefined : phase}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && phase !== "idle") onPhaseEnd();
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the poster must be the exact file the video uses */}
      <img src={loop.poster} alt="" draggable={false} data-hidden={(animate && playing) || undefined} />
      {animate && (
        <video
          // React sets `muted` as a property but never writes the attribute,
          // and iOS Safari only autoplays a video whose markup says muted.
          ref={(v) => {
            if (v) {
              v.muted = true;
              v.setAttribute("muted", "");
            }
          }}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={loop.poster}
          onPlaying={() => setPlaying(true)}
          aria-hidden="true"
          tabIndex={-1}
        >
          {!webkit && <source src={loop.webm} type="video/webm" />}
          <source src={loop.mp4} type="video/mp4" />
        </video>
      )}
    </span>
  );
}
