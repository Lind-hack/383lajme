"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, MoveHorizontal } from "lucide-react";

export default function UtilityRail({ children }: { children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ index: 0, count: 3 });

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => {
      const cards = Array.from(element.children) as HTMLElement[];
      const left = element.getBoundingClientRect().left;
      let index = 0;
      cards.forEach((card, i) => {
        if (Math.abs(card.getBoundingClientRect().left - left) < Math.abs(cards[index].getBoundingClientRect().left - left)) index = i;
      });
      setPosition(previous => previous.index === index && previous.count === cards.length ? previous : { index, count: cards.length });
    };
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    const cardsObserver = new MutationObserver(update);
    cardsObserver.observe(element, { childList: true });
    update();
    return () => { element.removeEventListener("scroll", update); observer.disconnect(); cardsObserver.disconnect(); };
  }, []);

  const move = (direction: number) => {
    const element = track.current;
    const card = element?.children[position.index + direction] as HTMLElement | undefined;
    if (!element || !card) return;
    element.scrollBy({
      left: card.getBoundingClientRect().left - element.getBoundingClientRect().left,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  };

  return (
    <div className="home-utility-rail">
      <div className="home-utility-controls">
        <span><MoveHorizontal size={16} aria-hidden />Tërhiq anash <small>{position.index + 1}/{position.count}</small></span>
        <div>
          <button type="button" aria-label="Karta e mëparshme" aria-controls="home-utility-track" disabled={position.index === 0} onClick={() => move(-1)}><ChevronLeft size={19} /></button>
          <button type="button" aria-label="Karta e ardhshme" aria-controls="home-utility-track" disabled={position.index === position.count - 1} onClick={() => move(1)}><ChevronRight size={19} /></button>
        </div>
      </div>
      <div ref={track} id="home-utility-track" className="home-utility-track" role="region" aria-label="Këmbimi, moti dhe derivatet">{children}</div>
    </div>
  );
}
