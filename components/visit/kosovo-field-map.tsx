import { MapPin } from "lucide-react";
import { BORDER_CROSSINGS } from "@/lib/visit-v2-data";
import styles from "./visit-v2.module.css";

const cityMarks = [
  { name: "Prishtinë", x: 356, y: 282, left: "61%", top: "45%" },
  { name: "Prizren", x: 229, y: 461, left: "50%", top: "79%" },
  { name: "Pejë", x: 133, y: 272, left: "31%", top: "44%" },
  { name: "Gjakovë", x: 151, y: 394, left: "32%", top: "62%" },
  { name: "Mitrovicë", x: 287, y: 165, left: "51%", top: "28%" },
  { name: "Gjilan", x: 438, y: 327, left: "76%", top: "52%" },
  { name: "Ferizaj", x: 357, y: 390, left: "62%", top: "63%" },
] as const;

const pinPositions = {
  kulle: { left: "13%", top: "38%" },
  merdare: { left: "82%", top: "23%" },
  "hani-i-elezit": { left: "70%", top: "80%" },
  "vermice-morine": { left: "18%", top: "78%" },
} as const;

export default function KosovoFieldMap({ compact = false }: { compact?: boolean }) {
  if (!compact) {
    return (
      <div className={styles.kosovoMap}>
        <div className={styles.foldedMapSheet} aria-hidden="true">
          <svg className={styles.fieldMapDrawing} viewBox="0 0 560 600">
            <path className={styles.fieldMapLand} d="M208 23 278 42 334 31 374 58 430 50 454 87 498 112 487 164 516 207 487 252 500 301 472 334 482 384 445 414 432 463 389 481 366 526 311 521 275 563 231 539 184 548 157 505 110 488 99 442 62 414 78 365 48 326 78 283 62 236 98 204 104 154 147 135 153 86 195 68Z" />
            <path className={styles.fieldRoadPrimary} d="M93 280C157 285 194 327 254 318S334 270 389 284 455 335 492 330M151 466C204 418 240 381 292 360S388 349 443 400M290 74C274 151 296 216 347 283S355 407 321 516" />
            <path className={styles.fieldRoadSecondary} d="M116 159C190 178 230 212 287 199s110-54 180-21M90 408c74-45 133-64 197-42s103 64 158 57M189 75c-8 102-12 178 18 236s39 147 24 226" />
            <path className={styles.fieldRiver} d="M290 65c31 79 18 145-14 198s-43 117-15 175 70 72 94 81" />
          </svg>
          <i className={styles.foldOne} />
          <i className={styles.foldTwo} />
        </div>
        <div className={styles.mapLiveLabels} aria-label="Hartë e stilizuar e Kosovës me qytetet kryesore">
          {cityMarks.map((city) => <span className={styles.cityLiveLabel} key={city.name} style={{ left: city.left, top: city.top }}><i />{city.name}</span>)}
          <strong>KOSOVË</strong>
        </div>
        {BORDER_CROSSINGS.map((crossing) => (
          <a className={styles.borderPin} href={`#border-${crossing.id}`} key={crossing.id} style={pinPositions[crossing.id]}>
            <MapPin aria-hidden="true" size={14} /><span>{crossing.name}</span>
          </a>
        ))}
        <small>Hartë e stilizuar - jo për navigim</small>
      </div>
    );
  }

  return (
    <div className={`${styles.kosovoMap} ${styles.kosovoMapCompact}`}>
      <svg viewBox="0 0 560 600" role="img" aria-label="Hartë e stilizuar e Kosovës me qytetet kryesore">
        <defs>
          <pattern id={compact ? "visit-grid-compact" : "visit-grid"} width="18" height="18" patternUnits="userSpaceOnUse">
            <path d="M18 0H0V18" fill="none" stroke="currentColor" strokeOpacity=".08" strokeWidth=".8" />
          </pattern>
          <clipPath id={compact ? "kosovo-shape-compact" : "kosovo-shape"}>
            <path d="M208 23 278 42 334 31 374 58 430 50 454 87 498 112 487 164 516 207 487 252 500 301 472 334 482 384 445 414 432 463 389 481 366 526 311 521 275 563 231 539 184 548 157 505 110 488 99 442 62 414 78 365 48 326 78 283 62 236 98 204 104 154 147 135 153 86 195 68Z" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${compact ? "kosovo-shape-compact" : "kosovo-shape"})`}>
          <rect width="560" height="600" className={styles.mapPaper} />
          <rect width="560" height="600" fill={`url(#${compact ? "visit-grid-compact" : "visit-grid"})`} />
          <path className={styles.mapRoadPrimary} d="M93 280C157 285 194 327 254 318S334 270 389 284 455 335 492 330M151 466C204 418 240 381 292 360S388 349 443 400M290 74C274 151 296 216 347 283S355 407 321 516" />
          <path className={styles.mapRoadSecondary} d="M116 159C190 178 230 212 287 199s110-54 180-21M90 408c74-45 133-64 197-42s103 64 158 57M189 75c-8 102-12 178 18 236s39 147 24 226" />
          <path className={styles.mapRiver} d="M290 65c31 79 18 145-14 198s-43 117-15 175 70 72 94 81" />
          <path className={styles.mapFold} d="M184 0l25 600M373 0l-19 600" />
        </g>
        <path className={styles.mapOutline} d="M208 23 278 42 334 31 374 58 430 50 454 87 498 112 487 164 516 207 487 252 500 301 472 334 482 384 445 414 432 463 389 481 366 526 311 521 275 563 231 539 184 548 157 505 110 488 99 442 62 414 78 365 48 326 78 283 62 236 98 204 104 154 147 135 153 86 195 68Z" />
        <text className={styles.mapCountryLabel} x="244" y="335">KOSOVË</text>
      </svg>
      <small>Hartë e stilizuar - jo për navigim</small>
    </div>
  );
}
