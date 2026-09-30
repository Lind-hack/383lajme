export const MAX_WIGGLE: number;
export function niceStep(ms: number): number;
export function seedOf(text: string): number;
export function wiggleAmplitude(span: number): number;
export function livelyPoints(
  points: { t: number; p: number }[],
  options?: {
    seed?: number;
    start?: number | null;
    end?: number | null;
    amplitude?: number;
    now?: number;
    samples?: number;
    rampFraction?: number;
    animate?: { from: number; progress: number } | null;
  }
): { t: number; p: number }[];
