export interface ReceiptTheme {
  /** Top gradient stop — the club's or category's leading colour. */
  from: string;
  /** Bottom gradient stop: the club's second colour, or one derived from the first. */
  to: string;
  /** Text colour elected by measured contrast against the leading stop. */
  ink: string;
  /** Readable colour for anything sitting ON the ink (the confirm badge). */
  onInk: string;
  /** Veil colour for the copy scrim, in the same polarity as the ink. */
  scrim: string;
  /** Alpha at which the ink clears AA over BOTH stops. 0 when none is needed. */
  scrimAlpha: number;
  /** A rejected white kit, kept for hairlines so the club still reads. */
  accent: string | null;
  source: "alternate" | "synthesized" | "fallback";
  contrast: { from: number; to: number };
}

export function receiptTheme(input: {
  primary?: string | null;
  alternate?: string | null;
  fallback?: [string, string] | null;
}): ReceiptTheme | null;

export function normalizeHex(value: unknown): string | null;
export function relativeLuminance(hex: string): number;
export function contrastRatio(a: string, b: string): number;
export function isAchromaticPale(hex: string): boolean;
export function deepenStop(hex: string, darkInk: boolean, strength?: number): string;
export function compositeOver(topHex: string, bottomHex: string, alpha: number): string;
