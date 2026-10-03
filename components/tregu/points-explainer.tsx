"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { pointsExample } from "@/lib/tregu-points.mjs";
import { useFocusTrap } from "@/components/tregu/use-focus-trap";
import "./leagues.css";

/** Opens the explainer from anywhere: a strip, the standings, the pick board. */
export const POINTS_HELP_EVENT = "tregu:points-help";
export function openPointsHelp(probability?: number) {
  window.dispatchEvent(new CustomEvent(POINTS_HELP_EVENT, { detail: { probability } }));
}

/**
 * "Si llogariten pikët": three blocks, the numbers real. Mounted once per
 * page; a dialog with focus moved in and back, Escape and backdrop to close.
 */
export default function PointsExplainer() {
  const [open, setOpen] = useState(false);
  const [probability, setProbability] = useState(0.7);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  useFocusTrap(panel, open);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const p = Number((event as CustomEvent<{ probability?: number }>).detail?.probability);
      if (Number.isFinite(p) && p > 0 && p < 1) setProbability(Math.max(p, 1 - p));
      opener.current = document.activeElement;
      setOpen(true);
    };
    window.addEventListener(POINTS_HELP_EVENT, onOpen);
    return () => window.removeEventListener(POINTS_HELP_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [open]);

  if (!open) return null;
  const example = pointsExample(probability);
  const favPct = Math.round(probability * 100);

  return (
    <div className="ptx-backdrop" onClick={() => setOpen(false)}>
      <div
        ref={panel}
        className="ptx lg-paper"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ptx-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="ptx-x" onClick={() => setOpen(false)} aria-label="Mbyll"><X size={16} /></button>
        <h2 id="ptx-title">Si llogariten pikët</h2>

        <section className="ptx-block">
          <h3>🎯 Surpriza paguan më shumë</h3>
          <p>Parashikimi i saktë merr <b>100 minus gjasat</b>. Nëse gabon, 0. Asnjë monedhë nuk humbet.</p>
          <div className="ptx-example" aria-label="Shembull">
            <span><small>Favoriti · {favPct}%</small><b>+{example.favourite}</b></span>
            <span data-hot><small>Surpriza · {100 - favPct}%</small><b>+{example.surprise}</b></span>
          </div>
        </section>

        <section className="ptx-block">
          <h3>🔥 Seria</h3>
          <p>E treta e saktë rresht merr <b>×1.5</b>, e pesta e tutje <b>×2</b>. Një gabim e nis nga zero.</p>
        </section>

        <section className="ptx-block">
          <h3>⭐ Karta e artë</h3>
          <p>Një herë në ditë në çdo ligë, shëno një parashikim: nëse del, vlen <b>dyfish</b>. Mund ta lëvizësh derisa të nisë ndeshja.</p>
        </section>

        <p className="ptx-note">Seria dhe Karta e artë vlejnë vetëm në ligat e reja; ligat që kanë nisur më parë numërojnë si gjithmonë. Duelet numërojnë pikët pa shumëzues.</p>
      </div>
    </div>
  );
}
