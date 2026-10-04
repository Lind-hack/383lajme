"use client";

// The faces of a pack's cards, drawn at any size: every measure is in em and
// the card sets its font-size from --card-w, so the same card works big in
// the reveal and small in the binder.
//
//   PlaceFace   — a place to visit: photo, name, time to spend
//   StampFace   — the city as a painting, one area painted in per stamped place
//   MuralFace   — the visitor's own trip photos, as a painted wall
//   StoryFace   — the visitor's own words about the city
//
// Holo shine follows the pointer through --mx/--my, set by the parent.

import { useEffect, useId, useMemo, useState } from "react";
import { Clock3, Images, PenLine, Stamp } from "lucide-react";
import { muralPhotos, PROFILE_JOURNAL_EVENT } from "@/lib/xhep/journal";
import { KOSOVO_CITIES } from "@/lib/visit-v2-data";
import { localizedPlace } from "@/lib/xhep/places.mjs";
import { PACK_ART, stampState } from "@/lib/xhep/packs.mjs";
import type { XhepLang } from "@/lib/xhep/i18n";
import type { XhepProfile } from "./use-profile";
import styles from "./packs.module.css";

export type PackCard =
  | { kind: "place"; id: string; place: { id: string; cityId: string; name: string; visitHint: string; category: { sq: string; en: string } } }
  | { kind: "mural"; id: string }
  | { kind: "story"; id: string }
  | { kind: "stamps"; id: string };

/** The curated photo and alt text for a place, from the live city guide. */
export function placePhoto(cityId: string, name: string) {
  const city = KOSOVO_CITIES.find((c) => c.id === cityId);
  const place = city?.places.find((p) => p.name === name);
  return place ? { src: place.image, alt: place.imageAlt, credit: place.imageCredit ?? null } : null;
}

export function cityName(cityId: string) {
  return KOSOVO_CITIES.find((c) => c.id === cityId)?.name ?? cityId;
}

/** The stamp card's painting (public/visit/scenes, painted from the pack art): width : height. */
export const SCENE_RATIO = 1000 / 868;
const VB_W = 1000;
const VB_H = 868;
/** One stable seed per city, so each city's brush strokes fall their own way. */
const seedOf = (cityId: string) => [...cityId].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** Seven areas of the canvas, one per place: rows of 3, 2 and 2. */
const ROWS = [
  { cols: 3, h: 0.36 },
  { cols: 2, h: 0.32 },
  { cols: 2, h: 0.32 },
];
const AREAS = ROWS.flatMap((row, r) => {
  const y = ROWS.slice(0, r).reduce((sum, x) => sum + x.h, 0);
  return Array.from({ length: row.cols }, (_, c) => ({ x: c / row.cols, y, w: 1 / row.cols, h: row.h }));
});

/**
 * Three broad brush strokes that cover one area and reach a little past it,
 * so neighbouring places overlap like paint and never meet in a seam.
 */
function strokesFor(area: (typeof AREAS)[number], seed: number) {
  let s = seed || 1;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  const bleed = 0.05;
  const x = (area.x - bleed) * VB_W;
  const w = (area.w + 2 * bleed) * VB_W;
  const top = (area.y - bleed) * VB_H;
  const height = (area.h + 2 * bleed) * VB_H;
  return [0, 1, 2].map((k) => {
    const h = height / 2.2;
    const y = top + (k * (height - h)) / 2;
    return { x: x + (rnd() - 0.5) * 30, y, w: w * (0.92 + rnd() * 0.12), h, rot: (rnd() - 0.5) * 8 };
  });
}

/**
 * The stamp card: the city as an acrylic painting. Unvisited areas are the
 * faded underpainting with their number; each stamped place paints its area
 * in with three brush strokes. All seven: the whole painting, framed in gold.
 */
export function Scene({ cityId, profile, justStamped, celebrate }: { cityId: string; profile: XhepProfile | null; justStamped?: string | null; celebrate?: boolean }) {
  const src = `/visit/scenes/${cityId}.webp`;
  const state = stampState(profile, cityId);
  const uid = useId().replace(/:/g, "");
  const seed = seedOf(cityId);
  const strokes = useMemo(() => AREAS.map((area, i) => strokesFor(area, seed + i * 7919)), [seed]);
  const places = state.places.slice(0, AREAS.length);
  return (
    <span className={styles.scene} data-complete={state.complete || undefined} data-celebrate={celebrate || undefined} style={{ aspectRatio: SCENE_RATIO }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className={styles.painting} aria-hidden="true">
        <defs>
          {/* Ragged, bristly stroke edges. */}
          <filter id={`${uid}-brush`} filterUnits="userSpaceOnUse" x="-50" y="-50" width={VB_W + 100} height={VB_H + 100}>
            <feTurbulence type="fractalNoise" baseFrequency="0.011 0.03" numOctaves="3" seed={seed % 97} result="warp" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="70" xChannelSelector="R" yChannelSelector="G" result="shape" />
            <feTurbulence type="fractalNoise" baseFrequency="0.6 0.025" numOctaves="2" seed={(seed >> 3) % 97} result="bristle" />
            <feDisplacementMap in="shape" in2="bristle" scale="14" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <mask id={`${uid}-paint`} maskUnits="userSpaceOnUse" x="0" y="0" width={VB_W} height={VB_H}>
            <g filter={`url(#${uid}-brush)`}>
              {places.map((entry, i) =>
                entry.stamp
                  ? strokes[i].map((st, k) => (
                      <rect
                        key={`${entry.place.id}-${k}`}
                        className={styles.paintStroke}
                        data-fresh={justStamped === entry.place.id || undefined}
                        style={{ "--k": k } as React.CSSProperties}
                        x={st.x.toFixed(1)}
                        y={st.y.toFixed(1)}
                        width={st.w.toFixed(1)}
                        height={st.h.toFixed(1)}
                        rx={(st.h / 2).toFixed(1)}
                        transform={`rotate(${st.rot.toFixed(2)} ${(st.x + st.w / 2).toFixed(1)} ${(st.y + st.h / 2).toFixed(1)})`}
                        fill="#fff"
                      />
                    ))
                  : null
              )}
            </g>
          </mask>
        </defs>
        <image href={src} width={VB_W} height={VB_H} className={styles.underpainting} preserveAspectRatio="xMidYMid slice" />
        <image href={src} width={VB_W} height={VB_H} mask={`url(#${uid}-paint)`} preserveAspectRatio="xMidYMid slice" />
        {/* Finished: the whole painting, once the last strokes have gone on. */}
        {state.complete && <image href={src} width={VB_W} height={VB_H} className={styles.paintFull} preserveAspectRatio="xMidYMid slice" />}
        {/* The finished painting's gold frame, drawn round once it is whole. */}
        {state.complete && <rect x="4" y="4" width={VB_W - 8} height={VB_H - 8} rx="14" pathLength={1} className={styles.paintFrame} />}
      </svg>
      {places.map((entry, i) => (
        <span
          key={`mark-${i}`}
          className={styles.sceneMark}
          data-stamp={entry.stamp ?? "none"}
          data-fresh={justStamped === entry.place.id || undefined}
          style={{ left: `${((AREAS[i].x + AREAS[i].w / 2) * 100).toFixed(2)}%`, top: `${((AREAS[i].y + AREAS[i].h / 2) * 100).toFixed(2)}%` }}
          aria-hidden="true"
        >
          {entry.stamp ? "✓" : i + 1}
        </span>
      ))}
    </span>
  );
}

/** The mural card's face: the visitor's own first photos, pinned up; or an invitation. */
function MuralWall({ cityId, empty }: { cityId: string; empty: string }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    let made: string[] = [];
    const load = () =>
      void muralPhotos(cityId).then((list) => {
        if (!alive) return;
        made.forEach((u) => URL.revokeObjectURL(u));
        made = list.slice(0, 4).map((p) => URL.createObjectURL(p.blob));
        setUrls(made);
      });
    load();
    window.addEventListener(PROFILE_JOURNAL_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(PROFILE_JOURNAL_EVENT, load);
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [cityId]);
  return (
    <span className={styles.muralWall} data-count={urls.length}>
      {urls.length === 0 ? (
        <span>{empty}</span>
      ) : (
        urls.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt="" style={{ "--i": i } as React.CSSProperties} />
        ))
      )}
    </span>
  );
}

/**
 * A place card's family, from its category: each family has its own frame,
 * like the types in a trading-card game, so a pack is a mix of colours.
 */
const FAMILY: Record<string, string> = {
  History: "history",
  Heritage: "heritage",
  Architecture: "architecture",
  Culture: "culture",
  Art: "art",
  Nature: "nature",
  Waterfall: "water",
  Mountain: "mountain",
  Geology: "mountain",
  "Day trip": "trip",
  View: "view",
  City: "city",
  Centre: "city",
  Walk: "walk",
};

/** The back every card shares: what you see before it turns over. */
export function CardBack() {
  return (
    <span className={styles.cardBack} aria-hidden="true">
      <span className={styles.cardBackMark}>
        <b>383</b>
        <small>Kosova në xhep</small>
      </span>
    </span>
  );
}

function Frame({ cityId, kind, children, label, family }: { cityId: string; kind: string; children: React.ReactNode; label: string; family?: string }) {
  const art = PACK_ART[cityId as keyof typeof PACK_ART];
  return (
    <article
      className={styles.card}
      data-kind={kind}
      data-family={family}
      aria-label={label}
      style={{ "--accent": art.accent, "--ink": art.ink, "--crimp": art.crimp } as React.CSSProperties}
    >
      {children}
      <i className={styles.holo} aria-hidden="true" />
    </article>
  );
}

export function CardFace({
  card,
  cityId,
  lang,
  profile,
  index,
  total,
  t,
}: {
  card: PackCard;
  cityId: string;
  lang: XhepLang;
  profile: XhepProfile | null;
  index: number;
  total: number;
  t: { stampCard: string; muralCard: string; storyCard: string; muralEmpty: string; storyEmpty: string; stampsDone: (n: number, of: number) => string; photos: (n: number) => string };
}) {
  const number = (
    <span className={styles.cardNo}>
      {index}/{total}
    </span>
  );

  if (card.kind === "place") {
    const photo = placePhoto(cityId, card.place.name);
    const local = localizedPlace(cityId, card.place, lang);
    const stamp = stampState(profile, cityId).places.find((p) => p.place.id === card.place.id)?.stamp ?? null;
    return (
      <Frame cityId={cityId} kind="place" label={card.place.name} family={FAMILY[card.place.category.en] ?? "city"}>
        <span className={styles.cardTop}>
          {number}
          <span className={styles.cardCat}>{local.category}</span>
        </span>
        <span className={styles.cardPhoto}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo && <img src={photo.src} alt={photo.alt} draggable={false} loading="lazy" />}
          {stamp && <span className={styles.cardSeal} data-stamp={stamp} aria-label={stamp === "gold" ? "GPS" : ""}>✓</span>}
        </span>
        <span className={styles.cardName}>{card.place.name}</span>
        <span className={styles.cardDesc}>{local.description}</span>
        <span className={styles.cardFoot}>
          <Clock3 aria-hidden="true" />
          {local.visitHint}
        </span>
      </Frame>
    );
  }

  if (card.kind === "stamps") {
    const state = stampState(profile, cityId);
    return (
      <Frame cityId={cityId} kind="stamps" label={t.stampCard}>
        <span className={styles.cardTop}>
          {number}
          <span className={styles.cardCat}>
            <Stamp aria-hidden="true" />
            {t.stampCard}
          </span>
        </span>
        <Scene cityId={cityId} profile={profile} />
        <span className={styles.cardName}>{cityName(cityId)}</span>
        <span className={styles.stampSlots} aria-hidden="true">
          {state.places.map(({ place, stamp }) => (
            <i key={place.id} data-stamp={stamp ?? "none"} />
          ))}
        </span>
        <span className={styles.cardFoot}>{t.stampsDone(state.done, state.total)}</span>
      </Frame>
    );
  }

  if (card.kind === "mural") {
    return (
      <Frame cityId={cityId} kind="mural" label={t.muralCard}>
        <span className={styles.cardTop}>
          {number}
          <span className={styles.cardCat}>
            <Images aria-hidden="true" />
            {t.muralCard}
          </span>
        </span>
        <MuralWall cityId={cityId} empty={t.muralEmpty} />
        <span className={styles.cardName}>{cityName(cityId)}</span>
      </Frame>
    );
  }

  return (
    <Frame cityId={cityId} kind="story" label={t.storyCard}>
      <span className={styles.cardTop}>
        {number}
        <span className={styles.cardCat}>
          <PenLine aria-hidden="true" />
          {t.storyCard}
        </span>
      </span>
      <span className={styles.storyLines}>
        <span>{t.storyEmpty}</span>
      </span>
      <span className={styles.cardName}>{cityName(cityId)}</span>
    </Frame>
  );
}
