export type RecordedPoint = { t: number; p: number };
export type RecordedSeries<T = unknown> = T & { points: RecordedPoint[] };
export type RecordedRangeKey = "1s" | "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w" | "Gjithë";
export const RECORDED_RANGE_OPTIONS: readonly {
  key: RecordedRangeKey;
  ms: number;
  description: string;
}[];
export function probabilityDomain(values: unknown[]): {
  lo: number;
  hi: number;
  rawLo: number;
  rawHi: number;
  ticks: number[];
  tickStep: number;
  zoomed: boolean;
};
export function formatProbabilityTick(value: number, step?: number): string;
export function cleanRecordedPoints(points?: unknown[] | null): RecordedPoint[];
export function selectRecordedRange<T extends { points: RecordedPoint[] }>(
  series: T[],
  rangeKey?: RecordedRangeKey,
  visibleEnd?: number | null
): {
  option: (typeof RECORDED_RANGE_OPTIONS)[number];
  start: number | null;
  end: number | null;
  series: (T & { hold?: RecordedPoint })[];
};
export function recordedRangeDisplaySeries<T extends { points: RecordedPoint[]; hold?: RecordedPoint }>(
  series: T[],
  start: number | null,
  end: number | null
): (T & { displayPoints: (RecordedPoint & { held: boolean })[] })[];
export function angularRecordedPath(
  points: RecordedPoint[],
  xFor: (timestamp: number) => number,
  yFor: (probability: number) => number
): string;
export function smoothRecordedPath(
  points: RecordedPoint[],
  xFor: (timestamp: number) => number,
  yFor: (probability: number) => number
): string;
