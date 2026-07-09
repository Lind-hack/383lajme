"use client";

import Link from "next/link";
import { useRef } from "react";

// Liquid-glass intro tile — first cell of the market grid. Explains what
// Tregu is; the specular highlight tracks the pointer (CSS vars set
// directly on the element, no React state, so it never re-renders).
export default function HeroTile({ loggedIn }: { loggedIn: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className="tregu-glass tregu-glass-hi tregu-hero tregu-span2"
      style={{ padding: "26px 28px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 18 }}
    >
      <div>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "#FF4422", margin: "0 0 10px" }}>
          383 Tregu
        </p>
        <h2 style={{ fontSize: "clamp(21px, 2.6vw, 27px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2, margin: "0 0 10px" }}>
          Çka mendon se do të ndodhë?
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "#444444", margin: 0, maxWidth: 460 }}>
          Tregu i parashikimeve i 383 — çdo pyetje lind nga lajmet e ditës.
          Zgjidh <strong style={{ color: "#007A3C" }}>Po</strong> ose <strong style={{ color: "#B4181A" }}>Jo</strong>,
          vër bast me 383 Coin falas dhe përqindja tregon çka beson Kosova.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {!loggedIn && (
          <Link
            href="/hyr"
            className="tregu-btn-primary"
            style={{ padding: "11px 20px", borderRadius: 100, fontSize: 13, textDecoration: "none" }}
          >
            Merr 100 383 Coin falas
          </Link>
        )}
        <span style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B" }}>
          Lexo lajmin&ensp;→&ensp;Parashiko&ensp;→&ensp;Fito 383 Coin
        </span>
      </div>
    </div>
  );
}
