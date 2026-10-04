"use client";

// Kosovo as an illustrated travel-poster map: drawn peaks, forests and rivers
// from real elevation, the Natural Earth border and OSM rivers; on top, each
// pack city as a round painted medallion, the four main crossings (with
// today's wait when we have it) and Gjeravica. Every point is placed with the
// same projection the map was drawn in (lib/xhep/kosovo-map), so nothing sits
// "about" where it should. Data credits are in the figure's accessible text.

import { BORDER_CROSSINGS } from "@/lib/visit-v2-data";
import { MAP_H, MAP_W, project } from "@/lib/xhep/kosovo-map";
import { PACK_ART } from "@/lib/xhep/packs.mjs";
import type { XhepLang } from "@/lib/xhep/i18n";
import styles from "./relief-map.module.css";

/** Town centres (OpenStreetMap), for the city pins. */
export const CITY_POINTS: Record<string, { name: string; lat: number; lon: number }> = {
  prishtine: { name: "Prishtinë", lat: 42.6629, lon: 21.1655 },
  prizren: { name: "Prizren", lat: 42.2139, lon: 20.7397 },
  peje: { name: "Pejë", lat: 42.6593, lon: 20.2887 },
  gjakove: { name: "Gjakovë", lat: 42.3803, lon: 20.4308 },
  mitrovice: { name: "Mitrovicë", lat: 42.8914, lon: 20.866 },
  gjilan: { name: "Gjilan", lat: 42.4635, lon: 21.4694 },
  ferizaj: { name: "Ferizaj", lat: 42.3702, lon: 21.1553 },
};

/** Where each city's painting shows its landmark best, inside the round medallion. */
const MEDAL_FOCUS: Record<string, string> = {
  prizren: "52% 45%",
  peje: "45% 40%",
  prishtine: "50% 45%",
  gjakove: "30% 50%",
  mitrovice: "35% 70%",
  ferizaj: "40% 55%",
  gjilan: "60% 45%",
};

/** Labels left or right of the pin, so neighbours don't collide. */
const LABEL_SIDE: Record<string, "left" | "right"> = { peje: "right", gjakove: "left", prizren: "left", mitrovice: "right", prishtine: "right", gjilan: "right", ferizaj: "right" };
/** Crossing labels on the side away from the nearest town label. */
const CROSSING_SIDE: Record<string, "left" | "right"> = { kulle: "left", merdare: "right", "hani-i-elezit": "right", "vermice-morine": "left" };

export default function ReliefMap({
  lang,
  waits,
  onCity,
}: {
  lang: XhepLang;
  /** Today's longest wait at each crossing, in minutes. */
  waits?: Record<string, number | null>;
  onCity?: (cityId: string) => void;
}) {
  const pct = (lon: number, lat: number) => {
    const [x, y] = project(lon, lat);
    // Fixed decimals: the server and the browser print long floats differently.
    return { left: `${((x / MAP_W) * 100).toFixed(3)}%`, top: `${((y / MAP_H) * 100).toFixed(3)}%` };
  };
  return (
    <figure className={styles.map} aria-label={lang === "en" ? "Map of Kosovo" : "Harta e Kosovës"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/visit/kosovo-illustrated.webp" alt="" width={MAP_W} height={MAP_H} fetchPriority="high" />

      {/* Gjeravica, 2,656 m (Wikipedia). */}
      <span className={styles.peak} style={pct(20.14, 42.5336)}>
        <i aria-hidden="true" />
        <span>Gjeravica · 2.656 m</span>
      </span>

      {BORDER_CROSSINGS.map((c) => {
        const wait = waits?.[c.id];
        return (
          <span key={c.id} className={styles.crossing} data-side={CROSSING_SIDE[c.id]} style={pct(c.longitude, c.latitude)} title={c.officialName}>
            <i aria-hidden="true" />
            <span>
              {c.name}
              {typeof wait === "number" && <b>{wait} min</b>}
            </span>
          </span>
        );
      })}

      {Object.entries(CITY_POINTS).map(([id, c]) => {
        const art = PACK_ART[id as keyof typeof PACK_ART];
        return (
          <button
            key={id}
            type="button"
            className={styles.city}
            data-side={LABEL_SIDE[id]}
            style={{ ...pct(c.lon, c.lat), "--pin": art.accent } as React.CSSProperties}
            onClick={() => onCity?.(id)}
          >
            <span className={styles.medal} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/visit/scenes/${id}.webp`} alt="" loading="lazy" style={{ objectPosition: MEDAL_FOCUS[id] ?? "50% 50%" }} />
            </span>
            <span className={styles.cityName}>{c.name}</span>
          </button>
        );
      })}
      <figcaption className={styles.srOnly}>
        {lang === "en" ? "Heights: AWS Terrain Tiles · Border: Natural Earth · Rivers: OpenStreetMap contributors" : "Lartësitë: AWS Terrain Tiles · Kufiri: Natural Earth · Lumenjtë: kontribuuesit e OpenStreetMap"}
      </figcaption>
    </figure>
  );
}
