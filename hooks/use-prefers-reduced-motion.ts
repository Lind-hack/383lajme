"use client";
import { useEffect, useState } from "react";

/**
 * True when the visitor has asked the OS for less motion.
 *
 * Starts false and corrects in an effect, deliberately: reading matchMedia
 * during render is a hydration mismatch, and the honest default for a first
 * paint is "animate" — a reduced-motion visitor sees the still state one frame
 * later, which is invisible, whereas the reverse would make every visitor's
 * entrance animation start mid-flight.
 *
 * Mirrors hooks/use-can-hover.ts, including the live `change` subscription, so
 * toggling the OS setting takes effect without a reload.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
