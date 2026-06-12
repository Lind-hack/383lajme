// Design tokens for framer-motion and inline-style components.
// CSS counterparts live in app/globals.css @theme — keep the two in sync.

export const EASE = [0.22, 1, 0.36, 1] as const;

export const FONT = {
  sans: "var(--font-manrope), sans-serif",
  serif: "var(--font-serif)",
} as const;

export const DUR = {
  fast: 0.15,
  base: 0.2,
  slow: 0.3,
  reveal: 0.45,
} as const;

/** Per-item stagger for list/grid entrances (40ms). */
export const STAGGER = 0.04;

export const RADIUS = {
  sm: 12,
  md: 16,
  lg: 24,
  pill: 100,
} as const;

export const SHADOW = {
  rest: "0 1px 3px rgba(17,17,17,0.05)",
  card: "0 2px 12px rgba(17,17,17,0.06)",
  hover: "0 16px 40px rgba(17,17,17,0.10)",
} as const;

export const SPACE = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;
