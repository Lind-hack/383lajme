export function keyLabel(key: unknown): string | null;
export function whyLine(
  item: { article: unknown; kind: string; primaryKey?: string; reason?: string },
  interests: unknown,
  now?: number
): { short: string; long: string; key: string | null; picked: boolean };
