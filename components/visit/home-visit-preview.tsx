import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, LocateFixed, Palette, Phone, Trophy } from "lucide-react";
import { BORDER_CROSSINGS } from "@/lib/visit-v2-data";
import { fetchOfficialBorderWaits } from "@/lib/visit-border-server";
import HomeXhepMap from "./home-xhep-map";
import styles from "./home-xhep.module.css";

// Kosova në xhep on the homepage, in the guide's own style: the illustrated
// map with the painted cities, a fan of city packs, the four things the
// guide does (packs, the painting card, trip rooms, help near you) and
// today's official border waits.

const PACKS = ["prizren", "peje", "prishtine", "gjakove"];

function level(minutes: number) {
  return minutes >= 30 ? "high" : minutes >= 15 ? "mid" : "low";
}

export default async function HomeVisitPreview() {
  const waits = await fetchOfficialBorderWaits().catch(() => []);
  const maxWait = Object.fromEntries(
    BORDER_CROSSINGS.map((c) => {
      const w = waits.find((x) => x.crossingId === c.id);
      return [c.id, w ? Math.max(w.entry.max, w.exit.max) : null];
    }),
  );

  return (
    <section className={styles.card} id="diaspora-visit-preview" aria-labelledby="home-visit-title">
      <div className={styles.copy}>
        <p className={styles.kicker}>Udhërrëfyesi i 383</p>
        <h2 id="home-visit-title">
          <span>Kosova</span> në xhep
        </h2>
        <p className={styles.lead}>Çdo qytet është një paketë me 10 karta: vendet që ia vlejnë, kujtimet e tua dhe një pikturë që e përfundon duke i vizituar. Plus pritjet në kufi dhe ndihma pranë teje.</p>

        <Link href="/visit?lang=sq#packs" className={styles.packs} aria-label="Hap paketat e qyteteve">
          {PACKS.map((city, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={city} src={`/visit/packs/${city}.webp`} alt="" loading="lazy" style={{ "--i": i } as CSSProperties} />
          ))}
          <span className={styles.packsTag}>7 qytete · 70 karta</span>
        </Link>

        <ul className={styles.features}>
          <li>
            <span className={styles.medal} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/visit/scenes/prizren.webp" alt="" loading="lazy" />
            </span>
            <span>
              <b><Palette size={14} aria-hidden="true" /> Piktura e qytetit</b>
              <small>Çdo vend që viziton pikturon një pjesë. Përfundoje për vulën e artë.</small>
            </span>
          </li>
          <li>
            <span className={styles.icon} data-tone="navy" aria-hidden="true"><Trophy size={20} /></span>
            <span>
              <b>Dhoma e udhëtimit</b>
              <small>Fto shokët me QR dhe garoni kush e pikturon Kosovën i pari.</small>
            </span>
          </li>
          <li>
            <span className={styles.icon} data-tone="red" aria-hidden="true"><LocateFixed size={20} /></span>
            <span>
              <b>Ndihma pranë teje</b>
              <small>Policia, spitali, karburanti dhe kufiri më i afërt, me një prekje.</small>
            </span>
          </li>
        </ul>

        <div className={styles.actions}>
          <Link className={styles.primary} href="/visit?lang=sq#packs">
            Hap paketat
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
          <a className={styles.sos} href="tel:112">
            <Phone aria-hidden="true" size={16} />
            112
          </a>
        </div>
      </div>

      <div className={styles.mapSide}>
        <HomeXhepMap waits={maxWait} />
        <Link href="/visit?lang=sq#visit-tools" className={styles.waits} aria-label="Pritjet në kufi sot">
          <header>
            <b>Pritjet në kufi sot</b>
            <small>Zyrtare · çdo 10 min</small>
          </header>
          <ul>
            {BORDER_CROSSINGS.map((c) => {
              const m = maxWait[c.id];
              return (
                <li key={c.id} data-level={m == null ? undefined : level(m)}>
                  <span>{c.name}</span>
                  <i style={{ "--w": m == null ? 0 : Math.max(0.08, Math.min(1, m / 45)) } as CSSProperties} />
                  <em>{m == null ? "–" : `${m} min`}</em>
                </li>
              );
            })}
          </ul>
        </Link>
      </div>
    </section>
  );
}
