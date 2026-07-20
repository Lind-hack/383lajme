"use client";

import { useRef, useState } from "react";

// Deterministic confetti ring — 16 particles fan out from behind the button on
// each confirm. Two-tone orange (brand + burnt) so it reads as the 383 family,
// not generic party color. Angles alternate a touch so the ring isn't rigid.
const CONFETTI = Array.from({ length: 16 }, (_, i) => {
  const ang = (i / 16) * Math.PI * 2 + (i % 2 ? 0.22 : -0.22);
  const dist = 46 + (i % 4) * 9;
  const colors = ["#FF4422", "#EA580C", "#FF7A00", "#FFB347"];
  return {
    tx: Math.cos(ang) * dist,
    ty: Math.sin(ang) * dist,
    r: (i % 2 ? 1 : -1) * (120 + i * 14),
    c: colors[i % colors.length],
    s: 6 + (i % 3) * 1.6,
    d: (i % 5) * 14,
  };
});

export default function ConfirmButton({
  onClick,
  disabled,
  children,
  variant = "buy",
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: "buy" | "sell";
}) {
  const [burst, setBurst] = useState(0);
  const [pop, setPop] = useState(false);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handle = () => {
    if (disabled) return;
    setBurst((b) => b + 1);
    setPop(true);
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setPop(false), 300);
    onClick();
  };

  return (
    <div className="tregu-confirm-wrap">
      {burst > 0 && (
        <span className="tregu-confetti" key={burst} aria-hidden>
          {CONFETTI.map((p, i) => (
            <i
              key={i}
              style={{
                width: p.s,
                height: p.s,
                background: p.c,
                ["--tx" as string]: `${p.tx}px`,
                ["--ty" as string]: `${p.ty}px`,
                ["--r" as string]: `${p.r}deg`,
                ["--d" as string]: `${p.d}ms`,
              }}
            />
          ))}
        </span>
      )}
      <button
        type="button"
        onClick={handle}
        disabled={disabled}
        className={`tregu-btn-primary tregu-confirm-btn${pop ? " tregu-pop" : ""}`}
        style={{
          background: variant === "sell" ? "var(--tg-orange)" : undefined,
        }}
      >
        {children}
      </button>
    </div>
  );
}
