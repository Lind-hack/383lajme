/**
 * Browser-only memories card: prepare visitor photos and draw the card.
 *
 * Privacy: every photo is decoded and re-encoded through a canvas before it
 * is used, so EXIF — including GPS — never survives. Nothing is uploaded.
 */
import { FRAME, MAX_PHOTOS, MEMORIES_H, MEMORIES_W, VIBES, coverCrop, photoRects } from "./memories-layout.mjs";

export const MAX_MEGAPIXELS = 24;
const MAX_EDGE = 1600;

export type PreparedPhoto = { bitmap: ImageBitmap; url: string; width: number; height: number };
export type PhotoError = "type" | "decode" | "too_large";

const ACCEPTED = /^image\/(jpeg|png|webp|heic|heif)$/;

/** Decode, bound, re-encode to WebP (drops EXIF/GPS). Throws a PhotoError code. */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!ACCEPTED.test(file.type)) throw "type" satisfies PhotoError;
  let source: ImageBitmap;
  try {
    source = await createImageBitmap(file);
  } catch {
    // HEIC decodes only where the browser supports it (Safari); elsewhere this lands here.
    throw "decode" satisfies PhotoError;
  }
  if ((source.width * source.height) / 1e6 > MAX_MEGAPIXELS) {
    source.close();
    throw "too_large" satisfies PhotoError;
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject("decode")), "image/webp", 0.86));
  const bitmap = await createImageBitmap(blob);
  return { bitmap, url: URL.createObjectURL(blob), width: bitmap.width, height: bitmap.height };
}

function wovenFrame(ctx: CanvasRenderingContext2D, vibe: (typeof VIBES)[keyof typeof VIBES]) {
  const cell = 16;
  const cols = Math.ceil(MEMORIES_W / cell);
  const rows = Math.ceil(MEMORIES_H / cell);
  const band = FRAME / cell;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const inFrame = c < band || c >= cols - band || r < band || r >= rows - band;
      if (!inFrame) continue;
      const k = (c + r) % 6;
      ctx.fillStyle = k < 2 ? vibe.dark : k < 3 ? vibe.light : k < 4 ? vibe.accent : vibe.ground;
      ctx.fillRect(c * cell, r * cell, cell, cell);
    }
  }
  // Inner light thread, like the kilim's edge warp.
  ctx.strokeStyle = vibe.light;
  ctx.lineWidth = 4;
  ctx.strokeRect(FRAME - 2, FRAME - 2, MEMORIES_W - 2 * FRAME + 4, MEMORIES_H - 2 * FRAME + 4);
}

export type MemoriesOptions = {
  photos: PreparedPhoto[];
  vibe: keyof typeof VIBES;
  layout: string;
  title: string;
  subtitle: string;
  stamps: number;
  stampsLabel: string;
};

export function drawMemories(canvas: HTMLCanvasElement, o: MemoriesOptions) {
  canvas.width = MEMORIES_W;
  canvas.height = MEMORIES_H;
  const ctx = canvas.getContext("2d")!;
  const vibe = VIBES[o.vibe] ?? VIBES.prizren;
  ctx.fillStyle = vibe.ground;
  ctx.fillRect(0, 0, MEMORIES_W, MEMORIES_H);
  wovenFrame(ctx, vibe);

  const photos = o.photos.slice(0, MAX_PHOTOS);
  const rects = photoRects(o.layout, photos.length);
  ctx.save();
  ctx.filter = vibe.filter;
  photos.forEach((photo, i) => {
    const r = rects[i];
    const crop = coverCrop(photo.width, photo.height, r.w, r.h);
    ctx.fillStyle = vibe.light;
    ctx.fillRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12);
    ctx.drawImage(photo.bitmap, crop.sx, crop.sy, crop.sw, crop.sh, r.x, r.y, r.w, r.h);
  });
  ctx.restore();

  if (photos.length === 0) {
    ctx.fillStyle = vibe.light;
    ctx.globalAlpha = 0.14;
    const r = photoRects("grid", 1)[0];
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.globalAlpha = 1;
  }

  // Caption band.
  const baseY = MEMORIES_H - FRAME - 40;
  ctx.fillStyle = vibe.text;
  ctx.textBaseline = "alphabetic";
  ctx.font = "800 18px Manrope, Arial, sans-serif";
  ctx.globalAlpha = 0.85;
  ctx.fillText("383 · KOSOVA NË XHEP", FRAME + 22, baseY - 140);
  ctx.globalAlpha = 1;
  let size = 68;
  ctx.font = `800 ${size}px Manrope, Arial, sans-serif`;
  while (ctx.measureText(o.title).width > MEMORIES_W - 2 * FRAME - 44 && size > 36) {
    size -= 2;
    ctx.font = `800 ${size}px Manrope, Arial, sans-serif`;
  }
  ctx.fillText(o.title, FRAME + 22, baseY - 64);
  ctx.font = "700 28px Manrope, Arial, sans-serif";
  ctx.globalAlpha = 0.9;
  ctx.fillText(o.subtitle, FRAME + 22, baseY - 16, MEMORIES_W - 2 * FRAME - 44);
  ctx.globalAlpha = 1;
  if (o.stamps > 0) {
    ctx.font = "800 22px Manrope, Arial, sans-serif";
    ctx.fillStyle = vibe.accent;
    const label = o.stampsLabel;
    ctx.fillText(label, MEMORIES_W - FRAME - 22 - ctx.measureText(label).width, baseY - 140);
  }
}

export function canvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/png"));
}
