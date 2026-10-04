"use client";

// One city's pack as an object with two sides:
//
//   front — the pack art (Lind's designs), with a foil sheen;
//   back  — the pack's label: what is inside, the seven places and how long
//           each takes, the total time, a barcode and the 383 mark.
//
// `motion` sets how it sits on the page: "wiggle" gives it a little shake now
// and then, like a pack in someone's hand; "still" holds it. `flipped`
// shows the back. An opened pack keeps its torn top, with the backs of its
// cards peeking out. Reduced motion holds every pack still.

import { KOSOVO_CITIES } from "@/lib/visit-v2-data";
import { localizedCity, localizedPlace } from "@/lib/xhep/places.mjs";
import { PACK_ART, packPlaces } from "@/lib/xhep/packs.mjs";
import type { XhepLang } from "@/lib/xhep/i18n";
import { BODY_CLIP } from "./tear";
import styles from "./model.module.css";

export type BackText = {
  inside: string;
  contents: string;
  places: string;
  total: (hours: string) => string;
  open: string;
};

/** "1-2 orë" → minutes, "30-45 min" → minutes, "Gjysmë dite" → 240. */
function hintMinutes(hint: string) {
  if (/gjysm/i.test(hint)) return 240;
  const nums = hint.match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return 60;
  const mid = nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0];
  return /or|h\b/i.test(hint) ? mid * 60 : mid;
}

function Barcode({ seed }: { seed: string }) {
  let h = 2166136261;
  let x = 0;
  const bars: React.ReactNode[] = [];
  for (let i = 0; i < 26; i++) {
    h = Math.imul(h ^ (seed.charCodeAt(i % seed.length) + i), 16777619) >>> 0;
    const w = 1 + (h % 3);
    if (i % 2 === 0) bars.push(<rect key={i} x={x} y={0} width={w} height={20} />);
    x += w + 1;
  }
  return (
    <svg className={styles.barcode} viewBox={`0 0 ${x} 20`} preserveAspectRatio="none" aria-hidden="true">
      {bars}
    </svg>
  );
}

export function PackBack({ cityId, lang, t }: { cityId: string; lang: XhepLang; t: BackText }) {
  const art = PACK_ART[cityId as keyof typeof PACK_ART];
  const city = KOSOVO_CITIES.find((c) => c.id === cityId);
  const local = city ? localizedCity(cityId, city, lang) : null;
  const places = packPlaces(cityId);
  const minutes = places.reduce((sum, p) => sum + hintMinutes(p.visitHint), 0);
  const hours = Math.round(minutes / 60);
  return (
    <div className={styles.back} style={{ "--crimp": art.crimp, "--accent": art.accent, "--ink": art.ink } as React.CSSProperties}>
      <div className={styles.backHead}>
        <b>383</b>
        <span>Kosova në xhep</span>
      </div>
      <h3 className={styles.backCity}>{city?.name ?? cityId}</h3>
      {local && <p className={styles.backTag}>{local.tagline}</p>}
      <p className={styles.backLabel}>{t.contents}</p>
      <p className={styles.backLabel}>{t.places}</p>
      <ol className={styles.backList}>
        {places.map((p) => (
          <li key={p.id}>
            <span>{p.name}</span>
            <em>{localizedPlace(cityId, p, lang).visitHint}</em>
          </li>
        ))}
      </ol>
      <div className={styles.backFoot}>
        <span>{t.total(String(hours))}</span>
        <Barcode seed={cityId} />
      </div>
    </div>
  );
}

export default function PackModel({
  cityId,
  lang,
  t,
  motion = "still",
  flipped = false,
  torn = false,
  complete = false,
  delay = 0,
}: {
  cityId: string;
  lang: XhepLang;
  t: BackText;
  motion?: "wiggle" | "still";
  flipped?: boolean;
  torn?: boolean;
  /** Its painting is finished: the pack wears the city's gold seal. */
  complete?: boolean;
  /** Stagger for a row of packs, so they don't shake in unison, in seconds. */
  delay?: number;
}) {
  const art = PACK_ART[cityId as keyof typeof PACK_ART];
  return (
    <span
      className={styles.model}
      data-motion={motion}
      data-flipped={flipped || undefined}
      data-torn={torn || undefined}
      data-complete={complete || undefined}
      style={{ "--delay": `${delay}s`, "--crimp": art.crimp } as React.CSSProperties}
    >
      <span className={styles.turn}>
        <span className={styles.front}>
          {torn && (
            <span className={styles.peek} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={art.src} alt="" draggable={false} width={640} height={1000} style={torn ? { clipPath: BODY_CLIP } : undefined} />
          <i className={styles.sheen} aria-hidden="true" style={{ "--pack-mask": `url(${art.src})` } as React.CSSProperties} />
          {complete && <span className={styles.seal} aria-hidden="true">★</span>}
        </span>
        <span className={styles.backFace} aria-hidden={!flipped}>
          <PackBack cityId={cityId} lang={lang} t={t} />
        </span>
      </span>
    </span>
  );
}
