"use client";

import * as React from "react";

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  accentIcon?: React.ReactNode;
  tiltDirection?: "left" | "right";
}

const DEPTH_RINGS = [
  { size: "170px", position: "8px", depth: "20px", delay: "0ms" },
  { size: "140px", position: "10px", depth: "40px", delay: "120ms" },
  { size: "110px", position: "17px", depth: "60px", delay: "240ms" },
  { size: "80px", position: "23px", depth: "80px", delay: "360ms" },
] as const;

/**
 * Perspective card primitive adapted from the supplied reference.
 * The surface, glass inset, content and orange rings occupy separate Z planes.
 */
const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      accentIcon,
      children,
      className = "",
      tiltDirection = "left",
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`group glass-card-scene [perspective:1000px] ${className}`}
        data-tilt={tiltDirection}
        {...props}
      >
        <div className="glass-card-surface relative h-full [transform-style:preserve-3d]">
          <div className="glass-card-inset absolute inset-2 [transform:translate3d(0,0,25px)] [transform-style:preserve-3d]" />

          <div className="glass-card-content relative h-full [transform:translate3d(0,0,26px)] [transform-style:preserve-3d]">
            {children}
          </div>

          <div
            className="glass-card-depth absolute right-0 top-0 [transform-style:preserve-3d]"
            aria-hidden="true"
          >
            {DEPTH_RINGS.map((ring) => (
              <span
                key={ring.depth}
                className="glass-card-depth-ring absolute aspect-square rounded-full transition-all duration-500 ease-in-out"
                style={{
                  width: ring.size,
                  top: ring.position,
                  right: ring.position,
                  transform: `translate3d(0, 0, ${ring.depth})`,
                  transitionDelay: ring.delay,
                }}
              />
            ))}

            <span className="glass-card-depth-badge absolute grid aspect-square w-[50px] place-content-center rounded-full [transform:translate3d(0,0,100px)]">
              {accentIcon}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";

export default GlassCard;
