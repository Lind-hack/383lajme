"use client";

import { MotionConfig } from "framer-motion";

// Site-wide framer-motion config: respect the user's OS reduced-motion
// preference (transforms removed, opacity kept — all reveals animate
// opacity so content never stays hidden).
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
