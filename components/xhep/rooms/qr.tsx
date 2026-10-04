"use client";

import { useMemo } from "react";
import { qrMatrix } from "@/lib/xhep/qr-art.mjs";

/** A QR drawn from modules as SVG: sharp at any size, nothing to fetch. */
export default function Qr({ text, className }: { text: string; className?: string }) {
  const qr = useMemo(() => {
    try {
      return qrMatrix(text);
    } catch {
      return null;
    }
  }, [text]);
  if (!qr) return null;
  const cells: string[] = [];
  for (let r = 0; r < qr.size; r++) for (let c = 0; c < qr.size; c++) if (qr.isDark(r, c)) cells.push(`M${c + 2} ${r + 2}h1v1h-1z`);
  return (
    <svg className={className} viewBox={`0 0 ${qr.size + 4} ${qr.size + 4}`} shapeRendering="crispEdges" role="img" aria-label="QR">
      <rect width="100%" height="100%" fill="#fff" />
      <path d={cells.join("")} fill="#1b1410" />
    </svg>
  );
}
