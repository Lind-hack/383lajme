"use client";

import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

export default function HeroWatermark() {
  const prefersReducedMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const rawY = useTransform(scrollY, [0, 600], [0, 40]);
  const y = prefersReducedMotion ? 0 : rawY;

  return (
    <motion.div
      aria-hidden="true"
      style={{
        y,
        position: "absolute",
        top: "-20px",
        left: "50%",
        x: "-50%",
        fontSize: "clamp(120px, 16vw, 220px)",
        fontWeight: 800,
        color: "transparent",
        WebkitTextStroke: "1px rgba(17,17,17,0.05)",
        letterSpacing: "-0.08em",
        lineHeight: 1,
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "nowrap",
        zIndex: 0,
      }}
    >
      383
    </motion.div>
  );
}
