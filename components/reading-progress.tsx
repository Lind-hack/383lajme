"use client";

// Fixed reading-progress bar under the navbar. Rendered at page level
// (not inside the sidebar) so it exists on mobile too.

import { motion, useScroll, useSpring, useReducedMotion } from "framer-motion";

type ReadingProgressProps = {
  color?: string;
};

export default function ReadingProgress({ color = "#FF4422" }: ReadingProgressProps) {
  const { scrollYProgress } = useScroll();
  const spring = useSpring(scrollYProgress, { stiffness: 200, damping: 40 });
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden
      style={{
        position: "fixed",
        top: "var(--nav-h)",
        left: 0,
        right: 0,
        height: "3px",
        background: color,
        transformOrigin: "0% 50%",
        scaleX: reducedMotion ? scrollYProgress : spring,
        zIndex: 90,
      }}
    />
  );
}
