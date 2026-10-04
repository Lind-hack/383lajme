"use client";

// The trip as a story-sized picture (1080 × 1920) for Instagram, TikTok and
// WhatsApp: the seven city paintings as medallions (finished ones in full
// colour with a gold ring, started ones with their progress, the rest faded),
// the numbers, and a big QR to the trip room or the trip itself.

import { qrMatrix } from "@/lib/xhep/qr-art.mjs";
import { PACK_CITIES } from "@/lib/xhep/packs.mjs";
import { CITY_NAMES } from "@/lib/xhep/card-art.mjs";
import type { Progress } from "@/lib/xhep/rooms-client";

export type ShareText = {
  title: (name: string) => string;
  untitled: string;
  stats: (packs: number, places: number, paintings: number) => string;
  scan: string;
  roomLine: (room: string) => string;
};

const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export async function shareCardPng({ name, progress, url, roomName, t }: { name: string; progress: Progress; url: string; roomName: string | null; t: ShareText }): Promise<Blob> {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#fff6dc");
  bg.addColorStop(0.55, "#ffe2a6");
  bg.addColorStop(1, "#ffc978");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Brand line.
  g.textAlign = "left";
  g.fillStyle = "#1b1410";
  g.font = "900 64px system-ui, sans-serif";
  g.fillText("383", 80, 140);
  g.fillStyle = "#ff4422";
  g.fillText(".", 80 + g.measureText("383").width, 140);
  g.fillStyle = "#5e4630";
  g.font = "800 34px system-ui, sans-serif";
  g.textAlign = "right";
  g.fillText("Kosova në xhep", W - 80, 136);

  // Title.
  g.textAlign = "center";
  g.fillStyle = "#1b1410";
  g.font = "900 84px system-ui, sans-serif";
  const title = name ? t.title(name) : t.untitled;
  const words = title.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > W - 160 && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  lines.push(line);
  lines.slice(0, 2).forEach((l, i) => g.fillText(l, W / 2, 300 + i * 96));

  // Seven medallions: 3 / 2 / 2... laid out 4 + 3.
  const R = 118;
  const rows = [PACK_CITIES.slice(0, 4), PACK_CITIES.slice(4)];
  const images = await Promise.all(PACK_CITIES.map((c) => load(`/visit/scenes/${c}.webp`).catch(() => null)));
  let top = 560;
  for (const row of rows) {
    const gap = (W - row.length * 2 * R) / (row.length + 1);
    row.forEach((city, i) => {
      const cx = gap + R + i * (2 * R + gap);
      const cy = top;
      const img = images[PACK_CITIES.indexOf(city)];
      const done = progress.cities[city] ?? 0;
      const painted = progress.painted.includes(city);
      const opened = progress.opened.includes(city);
      g.save();
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.clip();
      if (img) {
        g.filter = painted ? "none" : done > 0 ? "saturate(0.55) brightness(1.05)" : opened ? "grayscale(1) brightness(1.15)" : "grayscale(1) brightness(1.3) opacity(0.55)";
        const s = Math.max((2 * R) / img.width, (2 * R) / img.height);
        g.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s);
        g.filter = "none";
      }
      g.restore();
      // Ring: gold when finished, a progress arc while started.
      g.lineWidth = 12;
      g.strokeStyle = "rgba(255,255,255,0.9)";
      g.beginPath();
      g.arc(cx, cy, R + 4, 0, Math.PI * 2);
      g.stroke();
      if (painted || done > 0) {
        g.strokeStyle = painted ? "#e8b53e" : "#ff4422";
        g.beginPath();
        g.arc(cx, cy, R + 4, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * (painted ? 7 : done)) / 7);
        g.stroke();
      }
      if (painted) {
        g.fillStyle = "#e8b53e";
        g.beginPath();
        g.arc(cx + R * 0.72, cy - R * 0.72, 30, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#4a3000";
        g.font = "900 34px system-ui, sans-serif";
        g.fillText("★", cx + R * 0.72, cy - R * 0.72 + 12);
      }
      g.fillStyle = "#1b1410";
      g.font = "850 34px system-ui, sans-serif";
      g.fillText(CITY_NAMES[city as keyof typeof CITY_NAMES] ?? city, cx, cy + R + 52);
      g.fillStyle = "#6b5440";
      g.font = "700 26px system-ui, sans-serif";
      g.fillText(painted ? "7/7 ★" : `${done}/7`, cx, cy + R + 86);
    });
    top += 2 * R + 150;
  }

  // Numbers.
  g.fillStyle = "#1b1410";
  g.font = "800 40px system-ui, sans-serif";
  g.fillText(t.stats(progress.opened.length, progress.stamps, progress.painted.length), W / 2, 1300);

  // QR on a white card.
  const qr = qrMatrix(url);
  const size = 380;
  const qx = (W - size) / 2, qy = 1370;
  g.fillStyle = "#fff";
  g.beginPath();
  g.roundRect(qx - 30, qy - 30, size + 60, size + 60, 36);
  g.fill();
  const m = size / qr.size;
  g.fillStyle = "#1b1410";
  for (let r = 0; r < qr.size; r++) for (let c = 0; c < qr.size; c++) if (qr.isDark(r, c)) g.fillRect(qx + c * m, qy + r * m, Math.ceil(m), Math.ceil(m));
  g.fillStyle = "#1b1410";
  g.font = "850 36px system-ui, sans-serif";
  g.fillText(roomName ? t.roomLine(roomName) : t.scan, W / 2, qy + size + 90);
  g.fillStyle = "#6b5440";
  g.font = "700 28px system-ui, sans-serif";
  g.fillText("383ks.com/visit", W / 2, qy + size + 136);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png"));
}
