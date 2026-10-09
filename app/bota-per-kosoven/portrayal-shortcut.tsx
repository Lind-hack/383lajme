"use client";

import { ArrowDown } from "lucide-react";
import s from "./bota.module.css";

export default function PortrayalShortcut() {
  return <a className={s.portrayalShortcut} href="#bota-sot" onClick={(event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = document.getElementById("bota-sot");
    if (!target) return;
    event.preventDefault();
    const instant = event.detail === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: instant ? "instant" : "smooth", block: "start" });
    window.history.replaceState(window.history.state, "", "#bota-sot");
    target.focus({ preventScroll: true });
  }}>Si shkruhet për ne? <ArrowDown size={18} aria-hidden /></a>;
}
