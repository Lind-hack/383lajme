/**
 * Memories card geometry and vibes — pure, so it can be tested in node.
 * The browser side (lib/xhep/memories-render.ts) draws onto a canvas.
 */

export const MEMORIES_W = 1080;
export const MEMORIES_H = 1350; // 4:5, the feed-friendly portrait
export const FRAME = 64; // woven border width
export const MAX_PHOTOS = 8;

/** A vibe is a palette plus a photo tone; all four stay in the qilim world. */
export const VIBES = {
  prizren: { ground: "#9E2A1E", light: "#F4EBDD", accent: "#EE7A5E", dark: "#1E1712", text: "#FBF6EE", filter: "saturate(1.08) contrast(1.04) sepia(0.12)" },
  rugova: { ground: "#1F5140", light: "#EEF3EC", accent: "#6FA58C", dark: "#15211B", text: "#F4F7F2", filter: "saturate(1.12) contrast(1.05)" },
  prishtina: { ground: "#232A55", light: "#F1EEE6", accent: "#D2A949", dark: "#12152B", text: "#F7F3E8", filter: "contrast(1.1) saturate(0.95) brightness(0.97)" },
  brezovica: { ground: "#25617E", light: "#F4F8FA", accent: "#8CC3DB", dark: "#0F2733", text: "#FFFFFF", filter: "brightness(1.06) saturate(0.9) contrast(1.02)" },
};

export const LAYOUTS = ["grid", "hero", "strip"];

/** Photo rectangles inside the frame, above the caption band. */
export function photoRects(layout, count) {
  const n = Math.max(0, Math.min(MAX_PHOTOS, Math.floor(count)));
  if (n === 0) return [];
  const gap = 14;
  const x0 = FRAME + gap;
  const y0 = FRAME + gap;
  const w = MEMORIES_W - 2 * (FRAME + gap);
  const h = MEMORIES_H - 2 * FRAME - gap - 230; // leaves the caption band
  const rects = [];
  const grid = (cols, rows, ox, oy, gw, gh, take) => {
    const cw = (gw - gap * (cols - 1)) / cols;
    const ch = (gh - gap * (rows - 1)) / rows;
    for (let i = 0; i < take; i += 1) {
      rects.push({ x: ox + (i % cols) * (cw + gap), y: oy + Math.floor(i / cols) * (ch + gap), w: cw, h: ch });
    }
  };
  if (layout === "hero" && n > 1) {
    const heroH = Math.round(h * 0.62);
    rects.push({ x: x0, y: y0, w, h: heroH });
    const rest = n - 1;
    grid(Math.min(rest, 4), Math.ceil(rest / 4), x0, y0 + heroH + gap, w, h - heroH - gap, rest);
  } else if (layout === "strip") {
    grid(1, n, x0, y0, w, h, n);
  } else {
    const cols = n === 1 ? 1 : n <= 4 ? 2 : n <= 6 ? 3 : 4;
    grid(cols, Math.ceil(n / cols), x0, y0, w, h, n);
  }
  return rects.map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) }));
}

/** Cover-fit a source of (sw, sh) into a box: the crop to draw. */
export function coverCrop(sw, sh, bw, bh) {
  const scale = Math.max(bw / sw, bh / sh);
  const cw = bw / scale;
  const ch = bh / scale;
  return { sx: (sw - cw) / 2, sy: (sh - ch) / 2, sw: cw, sh: ch };
}
