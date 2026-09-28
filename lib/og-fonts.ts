/* Manrope for next/og cards, fetched once per server instance. Google serves
   TTF to a client that does not advertise woff2, which is what satori needs.
   If the fetch fails the card still renders in the default face rather than
   erroring, and the failure is not cached, so the next card tries again. */
const fontCache = new Map<number, Promise<ArrayBuffer | null>>();

function manrope(weight: number) {
  if (!fontCache.has(weight)) {
    fontCache.set(
      weight,
      (async () => {
        try {
          const css = await fetch(`https://fonts.googleapis.com/css2?family=Manrope:wght@${weight}`, {
            headers: { "User-Agent": "Mozilla/4.0" },
            signal: AbortSignal.timeout(4000),
          }).then((r) => r.text());
          const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
          if (!url) return null;
          return await fetch(url, { signal: AbortSignal.timeout(4000) }).then((r) => (r.ok ? r.arrayBuffer() : null));
        } catch {
          return null;
        }
      })().then((font) => {
        if (!font) fontCache.delete(weight);
        return font;
      })
    );
  }
  return fontCache.get(weight)!;
}

export type OgFont = { name: string; data: ArrayBuffer; weight: 500 | 700 | 800; style: "normal" };

/** Manrope 500/700/800 for ImageResponse, or [] if Google Fonts is unreachable. */
export async function manropeFonts(): Promise<OgFont[]> {
  const [regular, bold, heavy] = await Promise.all([manrope(500), manrope(700), manrope(800)]);
  return [
    regular && { name: "Manrope", data: regular, weight: 500 as const, style: "normal" as const },
    bold && { name: "Manrope", data: bold, weight: 700 as const, style: "normal" as const },
    heavy && { name: "Manrope", data: heavy, weight: 800 as const, style: "normal" as const },
  ].filter(Boolean) as OgFont[];
}
