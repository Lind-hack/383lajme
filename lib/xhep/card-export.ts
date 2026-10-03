/**
 * Browser-only: turn the card SVG into PNG files for download and sharing.
 * The card is drawn from an <img> of the SVG, so text inside it renders in the
 * SVG's fallback font stack (web fonts don't load inside an SVG image).
 */

function loadSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The card image could not be prepared."));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The card image could not be encoded."))), "image/png");
  });
}

/** The card alone at 2× (1200×1800): crisp enough to print and to scan. */
export async function cardPng(svg: string): Promise<Blob> {
  const img = await loadSvg(svg);
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1800;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.imageSmoothingEnabled = false; // keep QR modules hard-edged
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvasBlob(canvas);
}

/** A 1080×1920 story: the card centred on kilim black with the 383 address. */
export async function storyPng(svg: string, caption: string): Promise<Blob> {
  const img = await loadSvg(svg);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.fillStyle = "#1E1712";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const w = 880;
  const h = w * 1.5;
  const x = (canvas.width - w) / 2;
  const y = 250;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, w, h);
  ctx.fillStyle = "#F4EBDD";
  ctx.textAlign = "center";
  ctx.font = "800 44px Manrope, Arial, sans-serif";
  ctx.fillText("Kosova në xhep", canvas.width / 2, 170);
  ctx.font = "700 30px Manrope, Arial, sans-serif";
  ctx.globalAlpha = 0.75;
  ctx.fillText(caption, canvas.width / 2, y + h + 110);
  ctx.globalAlpha = 1;
  return canvasBlob(canvas);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** Native share with the image when the browser supports files; false otherwise. */
export async function shareBlob(blob: Blob, filename: string, text: string): Promise<boolean> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (!nav.share || !nav.canShare?.({ files: [file] })) return false;
  try {
    await nav.share({ files: [file], text });
    return true;
  } catch (error) {
    // The visitor closing the share sheet is not a failure worth a fallback download.
    if (error instanceof DOMException && error.name === "AbortError") return true;
    return false;
  }
}
