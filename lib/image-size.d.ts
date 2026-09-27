export const SHARP_MIN_WIDTH: number;
export function imageSizeFromBytes(bytes: Uint8Array): { width: number; height: number } | null;
export function probeImageSize(
  url: string | undefined,
  fetchImpl?: typeof fetch,
): Promise<{ width: number; height: number } | null>;
export function withImageSizes<T extends { imageUrl?: string }>(
  articles: T[],
  fetchImpl?: typeof fetch,
): Promise<Array<T & { imageWidth?: number; imageHeight?: number }>>;
export function isSharpEnough(
  article: { imageUrl?: string; imageWidth?: number } | undefined,
  minWidth?: number,
): boolean;
export function sharpFirst<T>(list: T[], slots: number, minWidth?: number): T[];
