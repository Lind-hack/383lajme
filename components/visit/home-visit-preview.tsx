import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, CircleGauge, MapPinned, Phone } from "lucide-react";
import { BORDER_CROSSINGS } from "@/lib/visit-v2-data";
import { fetchOfficialBorderWaits } from "@/lib/visit-border-server";
import KosovoFieldMap from "./kosovo-field-map";
import styles from "./visit-v2.module.css";

function levelClass(minutes: number) {
  if (minutes >= 30) return styles.waitRed;
  if (minutes >= 15) return styles.waitAmber;
  return styles.waitGreen;
}

export default async function HomeVisitPreview() {
  const waits = await fetchOfficialBorderWaits().catch(() => []);

  return (
    <section className={styles.homeV2} id="diaspora-visit-preview" aria-labelledby="home-visit-title">
      <div className={styles.homeV2Copy}>
        <h2 id="home-visit-title">Kosova në xhep, para kufirit.</h2>
        <p>Kontrollo pritjet zyrtare, gjej ndihmën pranë teje dhe krijo karta qytetesh që ruhen offline. Pa llogari.</p>
        <div className={styles.homeV2Actions}>
          <Link href="/visit#border-card"><CircleGauge aria-hidden="true" size={20} /><span><b>Karta e kufirit</b><small>Pritjet, ndihma dhe karburanti</small></span><ArrowRight aria-hidden="true" size={16} /></Link>
          <Link href="/visit#city-card"><MapPinned aria-hidden="true" size={20} /><span><b>Karta e qytetit</b><small>Prishtinë, Prizren, Pejë dhe më shumë</small></span><ArrowRight aria-hidden="true" size={16} /></Link>
        </div>
        <Link className={styles.homeV2Primary} href="/visit">Hap udhërrëfyesin <ArrowRight aria-hidden="true" size={17} /></Link>
        <a className={styles.heroEmergency} href="tel:112"><Phone aria-hidden="true" size={18} />Ndihmë tani - 112</a>
      </div>
      <div className={styles.homeV2Map}>
        <KosovoFieldMap />
        <div className={styles.homeV2Mini}>
          <header><span>Pritjet në kufi</span><b>Përditësim çdo 10 min</b></header>
          {BORDER_CROSSINGS.map((crossing) => {
            const wait = waits.find((item) => item.crossingId === crossing.id);
            const minutes = wait ? Math.max(wait.entry.max, wait.exit.max) : 0;
            return <div key={crossing.id}><strong>{crossing.name}</strong><span className={styles.waitTrack}><i className={levelClass(minutes)} style={{ "--wait-scale": wait ? Math.max(.08, Math.min(1, minutes / 45)) : 0 } as CSSProperties} /></span><em>{wait ? `${minutes}m` : "-"}</em></div>;
          })}
        </div>
      </div>
    </section>
  );
}
