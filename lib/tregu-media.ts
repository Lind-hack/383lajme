// Media registry for event markets — same no-schema philosophy as
// lib/tregu-groups.ts: events exist only as question-text conventions, so
// photos, brand colours, and event logos map from outcome labels and event
// titles here instead of database columns.

export interface OutcomeMedia {
  /** Headshot/avatar URL, rendered as a rounded tile. */
  photo?: string;
  /** Brand colour — becomes the outcome's chart line + row accent. */
  color?: string;
}

export interface EventLogo {
  src: string;
  alt: string;
  /** Rendered height in px; width follows the image's aspect ratio. */
  height: number;
}

const F1_CDN =
  "https://media.formula1.com/image/upload/c_lfill,w_256/q_auto/v1740000001/common/f1/2026";

// 2026 Belgian GP top-10 grid. Colours follow team identity, teammates split
// into a dark/light pair so all ten lines stay tellable on the cream panel.
const DRIVERS: Record<string, OutcomeMedia> = {
  antonelli: {
    photo: "https://img2.51gt3.com/rac/racer/202503/bcca7f61b6684e26bb28aedaf8d97c53.png",
    color: "#00A19C",
  },
  russell: {
    photo: `${F1_CDN}/mercedes/georus01/2026mercedesgeorus01right.webp`,
    color: "#00615C",
  },
  verstappen: {
    photo: `${F1_CDN}/redbullracing/maxver01/2026redbullracingmaxver01right.webp`,
    color: "#2452C4",
  },
  hadjar: {
    photo: `${F1_CDN}/redbullracing/isahad01/2026redbullracingisahad01right.webp`,
    color: "#6E8FD8",
  },
  norris: {
    photo: `${F1_CDN}/mclaren/lannor01/2026mclarenlannor01right.webp`,
    color: "#E67300",
  },
  piastri: {
    photo: `${F1_CDN}/mclaren/oscpia01/2026mclarenoscpia01right.webp`,
    color: "#A4520A",
  },
  leclerc: {
    photo: `${F1_CDN}/ferrari/chalec01/2026ferrarichalec01right.webp`,
    color: "#E10600",
  },
  hamilton: {
    photo: `${F1_CDN}/ferrari/lewham01/2026ferrarilewham01right.webp`,
    color: "#8F1D2C",
  },
  lindblad: {
    photo: `${F1_CDN}/racingbulls/arvlin01/2026racingbullsarvlin01right.webp`,
    color: "#101A66",
  },
  bortoleto: {
    photo: `${F1_CDN}/audi/gabbor01/2026audigabbor01right.webp`,
    color: "#0E8A44",
  },
};

function normalize(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

/** Photo + colour for an outcome label ("Fiton Verstappen" → Verstappen's). */
export function outcomeMediaFor(label: string): OutcomeMedia | null {
  const l = normalize(label);
  for (const key of Object.keys(DRIVERS)) {
    if (l.includes(key)) return DRIVERS[key];
  }
  return null;
}

/** Brand logo for an event title — F1 events wear the F1 mark. */
export function eventLogoFor(title: string): EventLogo | null {
  const t = normalize(title);
  if (/(^|[^a-z0-9])f1([^a-z0-9]|$)|formula ?1/.test(t)) {
    return {
      src: "https://upload.wikimedia.org/wikipedia/commons/3/33/F1.svg",
      alt: "Formula 1",
      height: 16,
    };
  }
  return null;
}
