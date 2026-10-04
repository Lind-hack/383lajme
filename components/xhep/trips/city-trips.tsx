"use client";

// On a city's mural card: what other visitors shared from this city, once
// approved (trips placed "city" first). Tapping one goes to the full trip on
// the page's wall.

import { useEffect, useState } from "react";
import { CITY_NAMES } from "@/lib/xhep/card-art.mjs";
import type { ShowcaseTrip } from "@/lib/xhep/showcase";
import styles from "./trips.module.css";

export default function CityTrips({ cityId, lang }: { cityId: string; lang: "en" | "sq" }) {
  const [trips, setTrips] = useState<ShowcaseTrip[]>([]);
  useEffect(() => {
    let alive = true;
    fetch(`/api/xhep/showcase?city=${cityId}`)
      .then((r) => r.json())
      .then((j) => alive && setTrips(Array.isArray(j?.trips) ? j.trips.filter((t: ShowcaseTrip) => t?.photos?.length) : []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [cityId]);
  if (trips.length === 0) return null;
  const sorted = [...trips].sort((a, b) => Number(b.placement === "city") - Number(a.placement === "city"));
  const city = CITY_NAMES[cityId as keyof typeof CITY_NAMES] ?? cityId;
  return (
    <section className={styles.cityTrips} aria-label={lang === "en" ? `Visitors' photos from ${city}` : `Fotot e vizitorëve nga ${city}`}>
      <b>{lang === "en" ? `From visitors in ${city}` : `Nga vizitorët në ${city}`}</b>
      <div className={styles.cityStrip}>
        {sorted.flatMap((trip) =>
          trip.photos.slice(0, 4).map((src) => (
            <a key={src} href={`/visit?lang=${lang}#trips`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" />
            </a>
          )),
        )}
      </div>
    </section>
  );
}
