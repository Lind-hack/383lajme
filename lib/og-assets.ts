import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * What the server-drawn cards share: fonts, story pictures and Dardani, all
 * read so that a card never depends on the network for its own furniture.
 *
 * Two production traps shape this file:
 *   - behind Railway's proxy a request's own origin is https://localhost:8080,
 *     which the server cannot reach, so nothing of ours is fetched by URL — it
 *     is read from public/ on disk;
 *   - the card renderer (satori) reads TTF/WOFF fonts and JPEG/PNG pictures
 *     only, so outlet pictures (often WebP or AVIF) are re-encoded with sharp.
 */

type Font = { name: string; data: Buffer; weight: 500 | 700 | 800; style: "normal" };

let manropeFonts: Promise<Font[]> | null = null;
/** Manrope 500 and 800 (Latin subset, every Albanian letter included). */
export function manrope() {
  manropeFonts ??= Promise.all(
    ([500, 800] as const).map(async (weight) => ({
      name: "Manrope",
      data: await readFile(path.join(process.cwd(), "public", "wrapped", "fonts", `Manrope-${weight}-latin.woff`)),
      weight,
      style: "normal" as const,
    }))
  );
  return manropeFonts;
}

let garamondFont: Promise<Font> | null = null;
/** EB Garamond 700, the nameplate's face in the "Klasike" and "Natë" papers. */
export function garamond() {
  garamondFont ??= readFile(path.join(process.cwd(), "public", "wrapped", "fonts", "EBGaramond-700.ttf")).then(
    (data) => ({ name: "EB Garamond", data, weight: 700 as const, style: "normal" as const })
  );
  return garamondFont;
}

/**
 * A story's picture as a JPEG data URL, or null. Pictures come from many news
 * sites; a slow, missing or unsupported one must cost the card its picture,
 * not the card itself. Sized to the card so a 12 MB original never reaches the
 * renderer. Failures are logged with their reason so they show in production.
 */
export async function picture(
  url: string | null | undefined,
  {
    width = 904,
    height = 508,
    timeoutMs = 6000,
    maxBytes = 15_000_000,
    tag = "[wrapped]",
  }: { width?: number; height?: number; timeoutMs?: number; maxBytes?: number; tag?: string } = {}
) {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; 383ks.com wrapped)", Accept: "image/*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`too large (${declared} bytes)`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > maxBytes) throw new Error(`too large (${bytes.length} bytes)`);
    const jpeg = await sharp(bytes).resize(width, height, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch (error) {
    console.warn(`${tag} story picture skipped`, url, error instanceof Error ? error.message : error);
    return null;
  }
}

const dardaniCache = new Map<string, Promise<string | null>>();
/** A Dardani PNG from public/wrapped (e.g. "dardani-wave.png") as a data URL, or null. */
export function dardaniPng(file: string, tag = "[wrapped]") {
  let hit = dardaniCache.get(file);
  if (!hit) {
    hit = readFile(path.join(process.cwd(), "public", "wrapped", file))
      .then((png) => `data:image/png;base64,${png.toString("base64")}`)
      .catch((error) => {
        console.warn(`${tag} Dardani image unavailable`, error instanceof Error ? error.message : error);
        dardaniCache.delete(file);
        return null;
      });
    dardaniCache.set(file, hit);
  }
  return hit;
}
