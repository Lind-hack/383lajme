"use client";

// The map, on its own. Tapping a country opens the sheet with the two biggest
// stories its press ran this week; everything else the old dashboard did
// around it (rows, drill-down, topic chips) is gone.

import { useEffect, useRef, useState } from "react";
import ToneMap from "@/components/tone/tone-map";
import type { ToneCardArticle } from "@/components/tone/tone-article-card";
import { flagToCode } from "@/lib/tone-scale";
import s from "./bota.module.css";

export interface MapCountry {
  country: string;
  flag: string;
  index: number | null;
  n: number;
  confident: boolean;
}

export default function BotaMap({
  countries,
  highlights,
}: {
  countries: MapCountry[];
  highlights: Record<string, ToneCardArticle[]>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const available = countries.filter((country) => (highlights[country.country]?.length ?? 0) > 0)
    .sort((a, b) => a.country < b.country ? -1 : a.country > b.country ? 1 : 0);

  // Search results and old /toni links arrive with ?vendi=<country>. Read from
  // window.location so the page needs no Suspense boundary; runs once.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("vendi");
    if (!wanted || !countries.some((c) => c.country === wanted)) return;
    setSelected(wanted);
    requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" }));
  }, [countries]);

  useEffect(() => {
    if (!selected) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : ref.current?.querySelector("select") ?? null;
    ref.current?.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="Mbyll"]')?.focus({ preventScroll: true });
    return () => returnFocus.current?.focus({ preventScroll: true });
  }, [selected]);

  return (
    <div ref={ref} onKeyDown={(event) => {
      if (event.key === "Escape" && selected) { event.preventDefault(); setSelected(null); }
    }}>
      <div className={s.exploreTools}>
        <label>Zgjidh një vend
          <select aria-label="Zgjidh një vend" value={selected ?? ""} onChange={(event) => setSelected(event.target.value || null)}>
            <option value="">Shiko hartën</option>
            {countries.slice().sort((a, b) => a.country < b.country ? -1 : a.country > b.country ? 1 : 0).map((country) => <option key={country.country} value={country.country}>{country.flag} {country.country}</option>)}
          </select>
        </label>
        <button type="button" disabled={!available.length} onClick={() => {
          const choices = available.filter((country) => country.country !== selected);
          const pool = choices.length ? choices : available;
          setSelected(pool[Math.floor(Math.random() * pool.length)].country);
        }}>Zgjidh një vend për mua <span aria-hidden>↗</span></button>
      </div>
      <p className={s.exploreHint} role="status">{selected ? `Po shikon shtypin nga ${selected}.` : "Nga cili vend do ta shohësh Kosovën sot? Zgjidh më sipër ose prek hartën."}</p>
      <ToneMap
        countries={countries.map((c) => ({
          code: flagToCode(c.flag),
          country: c.country,
          index: c.index,
          confident: c.confident,
          n: c.n,
        }))}
        active={selected ?? hovered}
        selected={selected}
        onHover={setHovered}
        onSelect={(country) => setSelected((prev) => (prev === country ? null : country))}
        articlesFor={(country) => highlights[country] ?? []}
        statsFor={(country) => {
          const c = countries.find((x) => x.country === country);
          return c ? { flag: c.flag, n: c.n, confident: c.confident } : null;
        }}
      />
    </div>
  );
}
