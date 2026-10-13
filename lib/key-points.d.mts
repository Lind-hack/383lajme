export const MAX_POINTS: number;
export const MAX_CHARS: number;
export const LEAD_CHARS: number;
export function sentences(text: string | null | undefined): string[];
export function keyPoints(story: { title?: string; excerpt?: string; paragraphs?: readonly string[] } | null | undefined): string[];
