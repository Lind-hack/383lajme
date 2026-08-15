import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CarFront,
  FileText,
  HeartPulse,
  Map,
  MapPin,
  Phone,
  Plane,
  Route,
  ShieldCheck,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import styles from "./visit.module.css";

const previewRoutes: readonly { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Udhëtimi", href: "/visit#travel", icon: Route },
  { label: "Dokumentet", href: "/visit#documents", icon: FileText },
  { label: "Paratë", href: "/visit#money", icon: WalletCards },
  { label: "Shëndeti", href: "/visit#health", icon: HeartPulse },
  { label: "Çfarë të bëj", href: "/visit#things-to-do", icon: Map },
  { label: "Blej ose investoj", href: "/visit#buy-invest", icon: BriefcaseBusiness },
];

export default function HomeVisitPreview() {
  return (
    <section className={styles.homePreview} id="diaspora-visit-preview" aria-labelledby="home-visit-title">
      <div className={styles.homePreviewFold} aria-hidden="true" />
      <div className={styles.homePreviewCopy}>
        <span className={styles.homeEyebrow}><MapPin aria-hidden="true" size={15} />383 / DIASPORA & VIZITORËT</span>
        <h2 id="home-visit-title">Një udhëtim më i sigurt fillon para kufirit.</h2>
        <p>
          Për Kosovë ose Shqipëri: krijo kartën e udhëtimit, kontrollo burimet zyrtare dhe mbaji numrat e urgjencës afër. Pa llogari.
        </p>
        <div className={styles.homeModeLinks} aria-label="Zgjidh mënyrën e mbërritjes">
          <Link href="/visit?arrival=car#travel-setup"><CarFront aria-hidden="true" size={18} /><span>Me veturë<small>Sigurimi dhe kufiri</small></span><ArrowUpRight aria-hidden="true" size={16} /></Link>
          <Link href="/visit?arrival=plane#travel-setup"><Plane aria-hidden="true" size={18} /><span>Me aeroplan<small>Dokumentet dhe ardhja</small></span><ArrowUpRight aria-hidden="true" size={16} /></Link>
        </div>
        <Link className={styles.homePrimaryLink} href="/visit">
          Krijo kartën e udhëtimit <ArrowUpRight aria-hidden="true" size={18} />
        </Link>
      </div>

      <div className={styles.homePreviewArtifact}>
        <div className={styles.homeMiniCard}>
          <div className={styles.homeMiniTop}>
            <span>383 / VISIT</span>
            <strong>XK</strong>
          </div>
          <div className={styles.homeMiniRoute}>
            <span>GJERMANI</span>
            <i aria-hidden="true" />
            <CarFront aria-hidden="true" size={18} />
            <span>KOSOVË / SHQIPËRI</span>
          </div>
          <div className={styles.homeMiniChecks}>
            <span><ShieldCheck aria-hidden="true" size={15} />Burimet zyrtare</span>
            <span><ShieldCheck aria-hidden="true" size={15} />Ruhet në pajisje</span>
          </div>
          <a className={styles.homeEmergencyLink} href="tel:112">
            <Phone aria-hidden="true" size={17} /><span>Ndihmë urgjente</span><strong>112</strong>
          </a>
        </div>

        <nav className={styles.homeRouteList} aria-label="Gjashtë rrugët e udhëzuesit">
          {previewRoutes.map(({ label, href, icon: Icon }, index) => (
            <Link href={href} key={href}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <Icon aria-hidden="true" size={16} />
              <strong>{label}</strong>
              <ArrowUpRight aria-hidden="true" size={14} />
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
