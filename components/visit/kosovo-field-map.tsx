import { MapPin } from "lucide-react";
import { BORDER_CROSSINGS } from "@/lib/visit-v2-data";
import styles from "./visit-v2.module.css";

const cityMarks = [
  { name: "Prishtinë", left: "60%", top: "34.5%" },
  { name: "Prizren", left: "43.9%", top: "55.4%" },
  { name: "Pejë", left: "26.8%", top: "34.6%" },
  { name: "Gjakovë", left: "32.2%", top: "47.6%" },
  { name: "Mitrovicë", left: "48.7%", top: "24.2%" },
  { name: "Gjilan", left: "71.5%", top: "43.9%" },
  { name: "Ferizaj", left: "59.6%", top: "48.1%" },
] as const;

const pinPositions = {
  kulle: { left: "17%", top: "33.5%" },
  merdare: { left: "63.6%", top: "21.2%" },
  "hani-i-elezit": { left: "63%", top: "61%" },
  "vermice-morine": { left: "35%", top: "61%" },
} as const;

// ADM0 boundary projected from geoBoundaries XKX data (OpenStreetMap, CC BY-SA 2.0).
const KOSOVO_BORDER_PATH = "M70.1 270.2L61.3 280.1L64.6 296.2L61.4 303.5L84.9 321.1L92.3 340.6L99.6 347.4L101.1 354.3L96.3 358.9L106.1 370.2L105.4 385.7L122.1 390L131 385.5L148.3 400.9L162 405.4L177.3 422.6L191.6 459.7L188.9 476.2L198.6 487.8L206.5 512.4L205.2 525L193.6 532.9L198.5 547.3L205.1 554.3L216.8 548L222.5 554.4L233.9 552L246.8 532.5L241 522.3L244.3 516.6L239.4 509.5L239.2 494L250.5 473.3L277.2 468.2L284.7 457L312.9 448.5L337.4 428.9L350.4 434.6L362.7 455.5L364.8 469.5L376.9 469.2L383.9 463L391 464.4L385.9 452.4L394.6 428.7L407.8 414.6L423.5 418.8L420.4 410L423.7 403.3L441.2 406L443.9 416.4L460.4 410L455.7 391.9L449.3 392.2L444.8 386.3L446.7 371.5L457.1 372.9L463.2 365.3L470.2 367.4L477 354.7L470.7 340.4L489.1 317.9L494 317.6L489.4 309.4L503.8 302.4L500.2 287.2L506.9 274L515 269.2L505.1 251.2L484.4 256.3L480.7 264.1L474.9 252.3L461.3 250.4L462.7 242.3L454 238.1L449 243.4L432.8 234.5L429.6 238.6L424.8 233.6L409.9 235.4L421.1 189.7L402.6 190.2L393.5 178.9L377.7 180.8L368.3 161.7L370.5 150.7L365.5 136.5L358.1 135.5L351.2 143.7L342.2 103.1L335.9 103.9L329.4 95.1L319.2 105.2L304.7 94.1L294.5 98.6L274.6 83.9L263.2 81.7L262 77.9L267.5 75.9L264.5 69.4L276.6 70.6L266.7 53.6L256.1 45.6L242.7 56.2L234 54.5L219 68.9L198.7 69.6L203 82.9L215.5 88.5L215.3 94.3L222.6 99.7L224.6 111.3L214.9 117.4L218.9 129.8L210.9 135.8L210.8 141.4L197.6 137.7L185.9 157.8L181.5 152.8L172.6 161L169.9 169.3L183.7 185.8L169.8 191.4L157.2 203.8L149.4 198.8L125.9 206.3L124.7 202.8L115.6 204.7L108 211.9L111.6 223.5L97.6 235L82.2 227.1L79.2 231.8L67.2 224.1L47.7 228.3L45.1 241.1L49.7 244.4L45.4 248.2L63.3 258.8L70.1 270.2Z";

export default function KosovoFieldMap({ compact = false }: { compact?: boolean }) {
  if (!compact) {
    return (
      <div className={styles.kosovoMap}>
        <div className={styles.foldedMapSheet} aria-hidden="true">
          <svg className={styles.fieldMapDrawing} viewBox="0 0 560 600">
            <defs>
              <clipPath id="kosovo-field-shape">
                <path d={KOSOVO_BORDER_PATH} />
              </clipPath>
            </defs>
            <g clipPath="url(#kosovo-field-shape)">
              <path className={styles.fieldMapLand} d={KOSOVO_BORDER_PATH} />
              <g className={styles.fieldMapColor}>
              <path className={styles.fieldMapSun} d="M38 56h266v172H38z" />
              <path className={styles.fieldMapMeadow} d="M20 336c93-47 172-35 247 15s162 70 290 24v249H20z" />
              <path className={styles.fieldMapOrchard} d="M339 0h221v252c-73 24-142 1-221-50z" />
              <circle className={styles.fieldMapLake} cx="105" cy="438" r="74" />
              </g>
              <path className={styles.fieldRoadPrimary} d="M93 280C157 285 194 327 254 318S334 270 389 284 455 335 492 330M151 466C204 418 240 381 292 360S388 349 443 400M290 74C274 151 296 216 347 283S355 407 321 516" />
              <path className={styles.fieldRoadSecondary} d="M116 159C190 178 230 212 287 199s110-54 180-21M90 408c74-45 133-64 197-42s103 64 158 57M189 75c-8 102-12 178 18 236s39 147 24 226" />
              <path className={styles.fieldRiver} d="M290 65c31 79 18 145-14 198s-43 117-15 175 70 72 94 81" />
            </g>
            <path className={styles.fieldMapOutline} d={KOSOVO_BORDER_PATH} />
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
        <div className={styles.mapWelcome} aria-hidden="true"><strong>MIRË SE VJEN</strong><span>Në Kosovë</span></div>
        <small>Kufi i stilizuar · © OpenStreetMap contributors · Jo për navigim</small>
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
            <path d={KOSOVO_BORDER_PATH} />
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
        <path className={styles.mapOutline} d={KOSOVO_BORDER_PATH} />
        <text className={styles.mapCountryLabel} x="244" y="335">KOSOVË</text>
      </svg>
      <small>Hartë e stilizuar - jo për navigim</small>
    </div>
  );
}
