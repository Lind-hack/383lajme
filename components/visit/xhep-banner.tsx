import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./xhep-banner.module.css";

// Kosova në xhep on the phone homepage: a tappable strip of city packs, right
// after the lead story, so visitors find it without the menu. Desktop has the
// top-nav link and the full preview further down.
const PACKS = ["prizren", "peje", "prishtine"];

export default function XhepBanner() {
  return (
    <Link href="/visit#packs" className={styles.banner} aria-label="Kosova në xhep: hap paketat e qyteteve">
      <span className={styles.packs} aria-hidden="true">
        {PACKS.map((city, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={city} src={`/visit/packs/${city}.webp`} alt="" style={{ "--i": i } as React.CSSProperties} loading="lazy" />
        ))}
      </span>
      <span className={styles.copy}>
        <small>Po vjen në Kosovë?</small>
        <b>
          <em>Kosova</em> në xhep
        </b>
        <span>Paketat e qyteteve, pritjet në kufi dhe ndihma pranë teje.</span>
      </span>
      <span className={styles.go} aria-hidden="true">
        <ArrowRight size={20} />
      </span>
    </Link>
  );
}
