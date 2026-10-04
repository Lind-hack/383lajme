"use client";

// The faces of a pack's cards, drawn at any size: every measure is in em and
// the card sets its font-size from --card-w, so the same card works big in
// the reveal and small in the binder.
//
//   PlaceFace   — a place to visit: photo, name, time to spend
//   StampFace   — the city's scenery, one piece in colour per stamped place
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
import { puzzlePieces } from "@/lib/xhep/puzzle.mjs";
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

/**
 * The scene: the pack's own illustration without its title, its bottom band
 * and its sealed side edges. In % of the pack art (64:100): the picture runs
 * from 26% to 75% of the height, and 5.5% in from each side.
 */
const CROP = { top: 26, bottom: 75, side: 5.5 };
const PACK_RATIO = 0.64;
/** The scene's width : height. */
export const SCENE_RATIO = (PACK_RATIO * (1 - (2 * CROP.side) / 100)) / ((CROP.bottom - CROP.top) / 100);
/** The pack art's size and offset inside the scene, in % of the scene. */
const ART_W = 100 / (1 - (2 * CROP.side) / 100);
const ART_H = (ART_W * SCENE_RATIO) / PACK_RATIO;
const ART_LEFT = -(CROP.side * ART_W) / 100;
const ART_TOP = -(CROP.top * ART_H) / 100;

/** The scene's viewBox: 1000 wide, as tall as the picture. */
const VB_W = 1000;
const VB_H = Math.round(VB_W / SCENE_RATIO);
/** The pack art inside that box. */
const ART_BOX = { x: (ART_LEFT / 100) * VB_W, y: (ART_TOP / 100) * VB_H, width: (ART_W / 100) * VB_W, height: (ART_W / 100) * VB_W / 0.633 };
/** One stable seed per city, so each city's puzzle is cut its own way. */
const seedOf = (cityId: string) => [...cityId].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/**
 * The stamp card's picture as a jigsaw: one piece per place. A stamped piece
 * sits in full colour; the rest stay a pencil sketch with their outline and
 * number. The freshly stamped piece snaps in; all seven melt the seams away.
 */
export function Scene({ cityId, profile, justStamped, celebrate }: { cityId: string; profile: XhepProfile | null; justStamped?: string | null; celebrate?: boolean }) {
  const art = PACK_ART[cityId as keyof typeof PACK_ART];
  const state = stampState(profile, cityId);
  const uid = useId().replace(/:/g, "");
  const pieces = useMemo(() => puzzlePieces(VB_W, VB_H, seedOf(cityId)), [cityId]);
  const shape = (i: number) => pieces[i].points.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
  return (
    <span className={styles.scene} data-complete={state.complete || undefined} data-celebrate={celebrate || undefined} style={{ aspectRatio: SCENE_RATIO }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className={styles.puzzle} aria-hidden="true">
        <defs>
          {pieces.map((_, i) => (
            <clipPath key={i} id={`${uid}-p${i}`}>
              <polygon points={shape(i)} />
            </clipPath>
          ))}
        </defs>
        <image href={art.src} {...ART_BOX} className={styles.puzzleSketch} preserveAspectRatio="xMidYMin slice" />
        {state.places.slice(0, pieces.length).map((entry, i) =>
          entry.stamp ? (
            <g key={entry.place.id} className={styles.puzzlePiece} data-fresh={justStamped === entry.place.id || undefined} data-stamp={entry.stamp} style={{ "--n": i } as React.CSSProperties}>
              <g clipPath={`url(#${uid}-p${i})`}>
                <image href={art.src} {...ART_BOX} preserveAspectRatio="xMidYMin slice" />
              </g>
              <polygon points={shape(i)} className={styles.puzzleEdge} />
            </g>
          ) : (
            <polygon key={entry.place.id} points={shape(i)} className={styles.puzzleHole} />
          )
        )}
        {/* The finished picture's gold frame, drawn round once it is whole. */}
        {state.complete && <rect x="4" y="4" width={VB_W - 8} height={VB_H - 8} rx="14" pathLength={1} className={styles.puzzleFrame} />}
      </svg>
      {state.places.slice(0, pieces.length).map((entry, i) => (
        <span
          key={`mark-${i}`}
          className={styles.sceneMark}
          data-stamp={entry.stamp ?? "none"}
          data-fresh={justStamped === entry.place.id || undefined}
          style={{ left: `${((pieces[i].cx / VB_W) * 100).toFixed(2)}%`, top: `${((pieces[i].cy / VB_H) * 100).toFixed(2)}%` }}
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
