"use client";

// The reward for a finished puzzle: the city's gold seal, Dardani celebrating,
// a burst of confetti the moment it completes, and a postcard of the whole
// picture to keep or share (drawn here on a canvas from the pack art).

import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";
import DardaniImage from "@/components/dardani/dardani-image";
import { PACK_ART } from "@/lib/xhep/packs.mjs";
import { downloadBlob, shareBlob } from "@/lib/xhep/card-export";
import { track } from "@/lib/analytics";
import * as sfx from "@/lib/xhep/sound";
import styles from "./detail.module.css";

export type RewardText = {
  title: (city: string) => string;
  body: string;
  seal: string;
  save: string;
  share: string;
  saving: string;
  postcardLine: (city: string) => string;
};

/** The pack's picture, cropped the way the puzzle shows it (cards.tsx CROP). */
const CROP = { top: 0.26, bottom: 0.75, side: 0.055 };

async function postcard(cityId: string, city: string, line: string, seal: string): Promise<Blob> {
  const art = PACK_ART[cityId as keyof typeof PACK_ART];
  const img = new Image();
  img.src = art.src;
  await img.decode();
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#fff8ea");
  bg.addColorStop(1, "#f3e3c2");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // The picture, in a gold frame.
  const sx = img.naturalWidth * CROP.side, sy = img.naturalHeight * CROP.top;
  const sw = img.naturalWidth * (1 - 2 * CROP.side), sh = img.naturalHeight * (CROP.bottom - CROP.top);
  const fw = W - 120, fh = Math.round((fw * sh) / sw);
  const fx = 60, fy = 150;
  g.fillStyle = "#e8b53e";
  g.fillRect(fx - 14, fy - 14, fw + 28, fh + 28);
  g.fillStyle = "#fff";
  g.fillRect(fx - 6, fy - 6, fw + 12, fh + 12);
  g.drawImage(img, sx, sy, sw, sh, fx, fy, fw, fh);
  g.fillStyle = "#1b1410";
  g.font = "900 64px system-ui, sans-serif";
  g.textAlign = "center";
  g.fillText(city, W / 2, 105);
  g.font = "700 34px system-ui, sans-serif";
  g.fillStyle = "#5e5048";
  g.fillText(line, W / 2, fy + fh + 90);
  // The seal.
  const cx = W - 150, cy = fy + fh - 10;
  const seal_ = g.createRadialGradient(cx - 20, cy - 25, 10, cx, cy, 95);
  seal_.addColorStop(0, "#fff6c8");
  seal_.addColorStop(0.55, "#e8b53e");
  seal_.addColorStop(1, "#a7741a");
  g.fillStyle = seal_;
  g.beginPath();
  g.arc(cx, cy, 90, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#4a3000";
  g.font = "900 26px system-ui, sans-serif";
  g.fillText("★ " + seal, cx, cy + 9);
  g.fillStyle = "#ff4422";
  g.font = "900 40px system-ui, sans-serif";
  g.fillText("383", W / 2 - 150, H - 70);
  g.fillStyle = "#1b1410";
  g.font = "700 30px system-ui, sans-serif";
  g.fillText("Kosova në xhep · 383ks.com", W / 2 + 70, H - 72);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png"));
}

/** Gold, cream and 383 red only, thrown out from the seal and falling back. */
const CONFETTI = Array.from({ length: 36 }, (_, i) => {
  const angle = (i / 36) * Math.PI * 2 + (i % 3) * 0.2;
  const power = 90 + ((i * 53) % 80);
  return {
    dx: Math.round(Math.cos(angle) * power * 1.6),
    dy: Math.round(Math.sin(angle) * power - 40),
    r: ((i * 97) % 720) - 360,
    d: (i % 6) * 25,
    shape: i % 4 === 0 ? "star" : i % 3 === 0 ? "dot" : "foil",
    color: ["#e8b53e", "#f6d36b", "#fff3c4", "#c98a2b", "#ff4422"][i % 5],
  };
});

export default function PuzzleReward({ cityId, city, justCompleted, t }: { cityId: string; city: string; justCompleted: boolean; t: RewardText }) {
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    if (!justCompleted) return;
    // The seal lands after the pieces have rippled and the seams have melted.
    const land = window.setTimeout(() => {
      sfx.thump();
      sfx.fanfare();
      setBurst(true);
    }, 1750);
    const done = window.setTimeout(() => setBurst(false), 1750 + 3200);
    return () => {
      window.clearTimeout(land);
      window.clearTimeout(done);
    };
  }, [justCompleted]);

  const run = async (share: boolean) => {
    setBusy(true);
    try {
      const blob = await postcard(cityId, city, t.postcardLine(city), t.seal);
      const name = `383-${cityId}-puzzle.png`;
      if (!share || !(await shareBlob(blob, name, t.postcardLine(city)))) downloadBlob(blob, name);
      track("xhep_puzzle_postcard", { city: cityId, share });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.reward} data-celebrate={justCompleted || undefined} aria-live="polite">
      {burst && (
        <span className={styles.confetti} aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <i key={i} data-shape={c.shape} style={{ "--dx": `${c.dx}px`, "--dy": `${c.dy}px`, "--r": `${c.r}deg`, "--d": `${c.d}ms`, "--c": c.color } as React.CSSProperties} />
          ))}
        </span>
      )}
      <DardaniImage name="celebrating" decorative className={styles.rewardDardani} />
      <div>
        <span className={styles.rewardSeal}><span className={styles.rewardStar} aria-hidden="true">★</span> {t.seal}</span>
        <h3>{t.title(city)}</h3>
        <p>{t.body}</p>
        <div className={styles.rewardActions}>
          <button type="button" className={styles.primary} onClick={() => void run(true)} disabled={busy}>
            <Share2 size={16} aria-hidden="true" />
            {busy ? t.saving : t.share}
          </button>
          <button type="button" className={styles.ghost} onClick={() => void run(false)} disabled={busy}>
            <Download size={16} aria-hidden="true" />
            {t.save}
          </button>
        </div>
      </div>
    </section>
  );
}
