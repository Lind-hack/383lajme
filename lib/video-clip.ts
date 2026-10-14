/**
 * The YouTube id of a story's official clip — only the exact watch URL the
 * pipeline writes (scripts/news_video_policy.py); anything else is no video.
 */
export function youtubeIdOf(url: string | null | undefined): string | null {
  return url?.match(/^https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})$/)?.[1] ?? null;
}
