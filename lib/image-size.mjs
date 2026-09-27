/**
 * The pixel width of hotlinked article photos, and which stories may fill a
 * large slot.
 *
 * Outlets publish at every size: measured 2026-09-26, about four in ten
 * homepage photos were 1068px wide or smaller, some only 640px. On a phone
 * that is plenty. In the homepage lead, 700–920 CSS px wide on a 1.25–2x
 * laptop, the browser has to stretch it and the photo looks pixelated. No
 * optimizer setting can add pixels the source does not have, so big slots
 * prefer stories whose photo is large enough, and small photos go to the
 * thumbnails where they stay sharp.
 *
 * Widths are read from the first bytes of the file (JPEG, PNG, WebP, GIF), not
 * from the whole image, and remembered per URL: a published photo URL never
 * changes what it serves.
 */

/** A photo narrower than this is kept out of the page's large slots. */
export const SHARP_MIN_WIDTH = 1200;

const MAX_HEADER_BYTES = 256 * 1024;
const PROBE_TIMEOUT_MS = 2500;
const CACHE_LIMIT = 4000;

/**
 * Dimensions from an image file's leading bytes, or null when the format is
 * not one of JPEG, PNG, WebP or GIF or the header is not complete yet.
 *
 * @param {Uint8Array} b
 * @returns {{ width: number, height: number } | null}
 */
export function imageSizeFromBytes(b) {
  if (!b || b.length < 10) return null;
  const u16be = (i) => (b[i] << 8) | b[i + 1];
  const u16le = (i) => b[i] | (b[i + 1] << 8);
  const u24le = (i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  const u32be = (i) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
  const ok = (width, height) => (width > 0 && height > 0 ? { width, height } : null);

  // PNG: IHDR is always the first chunk.
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return b.length >= 24 ? ok(u32be(16), u32be(20)) : null;
  }
  // GIF87a / GIF89a
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return ok(u16le(6), u16le(8));
  // WebP: RIFF....WEBP then a VP8, VP8L or VP8X chunk.
  if (b.length >= 30 && String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WEBP") {
    const chunk = String.fromCharCode(...b.subarray(12, 16));
    if (chunk === "VP8 ") return ok(u16le(26) & 0x3fff, u16le(28) & 0x3fff);
    if (chunk === "VP8L") {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return ok((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
    }
    if (chunk === "VP8X") return ok(u24le(24) + 1, u24le(27) + 1);
    return null;
  }
  // JPEG: walk the segments to the first start-of-frame marker. EXIF and ICC
  // blocks come first and can be long, hence the generous byte budget.
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker === 0xff) { i++; continue; }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) return ok(u16be(i + 7), u16be(i + 5));
      i += 2 + u16be(i + 2);
    }
    return null;
  }
  return null;
}

async function readHeader(url, fetchImpl) {
  const res = await fetchImpl(url, {
    headers: {
      Range: `bytes=0-${MAX_HEADER_BYTES - 1}`,
      "User-Agent": "Mozilla/5.0 (compatible; 383ks-image-probe)",
      Accept: "image/webp,image/png,image/jpeg,image/*;q=0.8",
    },
    // No `cache` option on purpose: `no-store` would switch the homepage from
    // ISR to rendering on every request. Results are memoised below instead.
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
  if (!res.ok || !res.body) return null;
  // Read only as far as the header: a server that ignores Range would
  // otherwise send the whole photo, which has measured 11.8 MB.
  const reader = res.body.getReader();
  let buf = new Uint8Array(0);
  try {
    while (buf.length < MAX_HEADER_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const next = new Uint8Array(buf.length + value.length);
      next.set(buf);
      next.set(value, buf.length);
      buf = next;
      const size = imageSizeFromBytes(buf);
      if (size) return size;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return imageSizeFromBytes(buf);
}

const cache = new Map();

/**
 * The photo's pixel size, or null when it cannot be read. Never throws: a
 * slow or broken image host costs a story its big slot, never the page.
 *
 * @param {string | undefined} url
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{ width: number, height: number } | null>}
 */
export function probeImageSize(url, fetchImpl = fetch) {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return Promise.resolve(null);
  const hit = cache.get(url);
  if (hit) return hit;
  const pending = readHeader(url, fetchImpl).catch(() => null);
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(url, pending);
  // A failure is not remembered: the host may just have been slow this time.
  pending.then((size) => { if (!size) cache.delete(url); });
  return pending;
}

/**
 * The same articles with `imageWidth` / `imageHeight` filled in where the
 * photo could be measured. Order and identity of the list are preserved.
 *
 * @template {{ imageUrl?: string }} T
 * @param {T[]} articles
 * @returns {Promise<Array<T & { imageWidth?: number, imageHeight?: number }>>}
 */
export async function withImageSizes(articles, fetchImpl = fetch) {
  const list = articles ?? [];
  const sizes = await Promise.all(list.map((a) => probeImageSize(a?.imageUrl, fetchImpl)));
  return list.map((a, i) => (sizes[i] ? { ...a, imageWidth: sizes[i].width, imageHeight: sizes[i].height } : a));
}

/** Whether a measured photo is wide enough for a large slot. */
export function isSharpEnough(article, minWidth = SHARP_MIN_WIDTH) {
  return Boolean(article?.imageUrl) && (article?.imageWidth ?? 0) >= minWidth;
}

/**
 * Reorder so the first `slots` positions go to stories with a sharp photo.
 *
 * Stable: sharp stories keep their ranking among themselves and so does the
 * rest. When there are not enough sharp photos the remaining big slots take
 * the next stories in their usual order, so a section is never emptied.
 *
 * @template T
 * @param {T[]} list
 * @param {number} slots
 * @returns {T[]}
 */
export function sharpFirst(list, slots, minWidth = SHARP_MIN_WIDTH) {
  if (!Array.isArray(list) || slots <= 0) return list ?? [];
  const sharp = [];
  const rest = [];
  for (const article of list) {
    (sharp.length < slots && isSharpEnough(article, minWidth) ? sharp : rest).push(article);
  }
  const head = [...sharp, ...rest.splice(0, slots - sharp.length)];
  return [...head, ...rest];
}
