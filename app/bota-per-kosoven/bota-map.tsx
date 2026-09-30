"use client";

// The map, on its own. Tapping a country opens the sheet with the two biggest
// stories its press ran this week; everything else the old dashboard did
// around it (rows, drill-down, topic chips) is gone.

import { useEffect, useRef, useState } from "react";
import ToneMap from "@/components/tone/tone-map";
import type { ToneCardArticle } from "@/components/tone/tone-article-card";
import { flagToCode } from "@/lib/tone-scale";

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

  // Search results and old /toni links arrive with ?vendi=<country>. Read from
  // window.location so the page needs no Suspense boundary; runs once.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("vendi");
    if (!wanted || !countries.some((c) => c.country === wanted)) return;
    setSelected(wanted);
    requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [countries]);

  return (
    <div ref={ref}>
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
