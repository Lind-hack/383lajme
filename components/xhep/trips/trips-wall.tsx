"use client";

// Trips from visitors: approved murals and stories (lib/xhep/showcase.ts).
// A trip placed as the page's lead is the big featured card; the rest fill the
// wall. A tap opens the whole trip: every photo, swipeable, and the story.
// No names are shown: the visitor agreed to showing the photos and words.

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { CITY_NAMES } from "@/lib/xhep/card-art.mjs";
import type { ShowcaseTrip } from "@/lib/xhep/showcase";
import styles from "./trips.module.css";

const TEXT = {
  en: {
    kicker: "From visitors",
    title: "Trips made with the guide",
    intro: "Photos and stories visitors chose to share, checked by the 383 team before they appear here.",
    featured: "Trip of the moment",
    tripIn: (city: string) => `A trip to ${city}`,
    photos: (n: number) => `${n} ${n === 1 ? "photo" : "photos"}`,
    open: (city: string) => `Open the trip to ${city}`,
    close: "Close",
    prev: "Previous photo",
    next: "Next photo",
    share: "Share yours: open a pack, add photos to its mural card and send it to 383.",
  },
  sq: {
    kicker: "Nga vizitorët",
    title: "Udhëtime të bëra me udhërrëfyesin",
    intro: "Foto dhe histori që vizitorët zgjodhën t'i ndajnë, të kontrolluara nga ekipi i 383 para se të shfaqen këtu.",
    featured: "Udhëtimi në fokus",
    tripIn: (city: string) => `Një udhëtim në ${city}`,
    photos: (n: number) => `${n} ${n === 1 ? "foto" : "foto"}`,
    open: (city: string) => `Hap udhëtimin në ${city}`,
    close: "Mbyll",
    prev: "Fotoja e mëparshme",
    next: "Fotoja tjetër",
    share: "Ndaje tëndin: hap një paketë, shto foto te karta e muralit dhe dërgoja 383-shit.",
  },
};

const cityName = (id: string) => CITY_NAMES[id as keyof typeof CITY_NAMES] ?? id;
// Month names written out: the server's Intl data has no Albanian months.
const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  sq: ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"],
};
const when = (iso: string | null, lang: "en" | "sq") => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${MONTHS[lang][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

function TripViewer({ trip, lang, onClose }: { trip: ShowcaseTrip; lang: "en" | "sq"; onClose: () => void }) {
  const t = TEXT[lang];
  const ref = useRef<HTMLDialogElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const go = (dir: number) => strip.current?.scrollBy({ left: dir * strip.current.clientWidth, behavior: "smooth" });
  return (
    <dialog ref={ref} className={styles.viewer} aria-label={t.tripIn(cityName(trip.cityId))} onClose={onClose} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.viewerInner}>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>
          <X size={22} aria-hidden="true" />
        </button>
        {trip.photos.length > 0 && (
          <div className={styles.stripWrap}>
            <div ref={strip} className={styles.strip}>
              {trip.photos.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt={`${t.tripIn(cityName(trip.cityId))} · ${i + 1}/${trip.photos.length}`} loading={i < 2 ? "eager" : "lazy"} />
              ))}
            </div>
            {trip.photos.length > 1 && (
              <>
                <button type="button" className={styles.prev} onClick={() => go(-1)} aria-label={t.prev}><ChevronLeft size={22} aria-hidden="true" /></button>
                <button type="button" className={styles.next} onClick={() => go(1)} aria-label={t.next}><ChevronRight size={22} aria-hidden="true" /></button>
              </>
            )}
          </div>
        )}
        <div className={styles.viewerText}>
          <span className={styles.cityTag}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/visit/scenes/${trip.cityId}.webp`} alt="" />
            {cityName(trip.cityId)}
          </span>
          <h3>{t.tripIn(cityName(trip.cityId))}</h3>
          <small>{when(trip.approvedAt, lang)} · {t.photos(trip.photos.length)}</small>
          {trip.story && <p>{trip.story}</p>}
        </div>
      </div>
    </dialog>
  );
}

function TripCard({ trip, lang, featured, onOpen }: { trip: ShowcaseTrip; lang: "en" | "sq"; featured?: boolean; onOpen: () => void }) {
  const t = TEXT[lang];
  const shown = trip.photos.slice(0, featured ? 5 : 4);
  return (
    <button type="button" className={styles.card} data-featured={featured || undefined} onClick={onOpen} aria-label={t.open(cityName(trip.cityId))}>
      {shown.length > 0 && (
        <span className={styles.collage} data-count={shown.length}>
          {shown.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" loading={featured ? "eager" : "lazy"} style={{ "--i": i } as React.CSSProperties} />
          ))}
          {trip.photos.length > shown.length && <span className={styles.more}><Images size={14} aria-hidden="true" />+{trip.photos.length - shown.length}</span>}
        </span>
      )}
      <span className={styles.cardText}>
        {featured && <span className={styles.featuredTag}>★ {t.featured}</span>}
        <span className={styles.cityTag}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/visit/scenes/${trip.cityId}.webp`} alt="" />
          {cityName(trip.cityId)}
        </span>
        {trip.story && <span className={styles.story}>{trip.story}</span>}
        <small>{when(trip.approvedAt, lang)} · {t.photos(trip.photos.length)}</small>
      </span>
    </button>
  );
}

export default function TripsWall({ lang, trips }: { lang: "en" | "sq"; trips: ShowcaseTrip[] }) {
  const t = TEXT[lang];
  const [open, setOpen] = useState<ShowcaseTrip | null>(null);
  if (trips.length === 0) return null;
  const lead = trips.find((x) => x.placement === "hero") ?? null;
  const rest = trips.filter((x) => x !== lead);
  return (
    <section className={styles.wall} id="trips" aria-labelledby="trips-title">
      <div className={styles.head}>
        <p className={styles.kicker}>{t.kicker}</p>
        <h2 id="trips-title">{t.title}</h2>
        <p>{t.intro}</p>
      </div>
      {lead && <TripCard trip={lead} lang={lang} featured onOpen={() => setOpen(lead)} />}
      {rest.length > 0 && (
        <div className={styles.grid}>
          {rest.map((trip) => (
            <TripCard key={trip.id} trip={trip} lang={lang} onOpen={() => setOpen(trip)} />
          ))}
        </div>
      )}
      <p className={styles.yours}>{t.share}</p>
      {open && <TripViewer trip={open} lang={lang} onClose={() => setOpen(null)} />}
    </section>
  );
}
