export function videoKey(id: unknown): string | null;
export function videoIdFromKey(key: unknown): string | null;
/** "video-tt-…" for a TikTok id (its digits), or null. */
export function tiktokKey(id: unknown): string | null;
/** The TikTok id inside a video key, or null. */
export function tiktokIdFromKey(key: unknown): string | null;
