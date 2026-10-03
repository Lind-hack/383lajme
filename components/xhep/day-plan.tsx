"use client";

import { Clock3, Navigation } from "lucide-react";
import { useMemo, useState } from "react";
import { CITY_NAMES } from "@/lib/xhep/card-art.mjs";
import { CITY_TEXT, PLACES } from "@/lib/xhep/places.mjs";
import { planTrip } from "@/lib/xhep/planner.mjs";
import type { readProfile } from "@/lib/xhep/profile.mjs";
import { xhepDict, type XhepLang } from "@/lib/xhep/i18n";
import styles from "./xhep.module.css";

type Profile = NonNullable<ReturnType<typeof readProfile>>;
const MAPS = "https://www.google.com/maps/search/?api=1&query=";
const PLACE_BY_ID = new Map(PLACES.map((p) => [p.id, p]));
const PREVIEW_DAYS = 3;

export default function DayPlan({ lang, profile }: { lang: XhepLang; profile: Profile }) {
  const t = xhepDict(lang).plan;
  const plan = useMemo(() => planTrip(profile), [profile]);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? plan : plan.slice(0, PREVIEW_DAYS);

  return (
    <section className={styles.plan} aria-labelledby="xhep-plan-title">
      <div className={styles.helpHead}>
        <h3 id="xhep-plan-title">{t.title}</h3>
        <p>{t.intro}</p>
      </div>
      <ol className={styles.planDays}>
        {visible.map((day) => {
          const city = CITY_TEXT[day.cityId as keyof typeof CITY_TEXT];
          return (
            <li key={day.day} className={styles.planDay}>
              <header>
                <span className={styles.planDayNo}>{t.day(day.day)}</span>
                <h4>{CITY_NAMES[day.cityId as keyof typeof CITY_NAMES]}</h4>
                {city && <p>{city.tagline[lang]}</p>}
              </header>
              <ul>
                {day.stops.map((stop) => {
                  const place = PLACE_BY_ID.get(stop.placeId);
                  if (!place) return null;
                  return (
                    <li key={stop.placeId}>
                      <span className={styles.planSlot}>{t.slots[stop.slot as keyof typeof t.slots]}</span>
                      <div>
                        <b>{place.name}</b>
                        <small>
                          {place.category[lang]} · <Clock3 aria-hidden="true" size={11} /> {t.duration(stop.minutes)}
                        </small>
                        <p>{place.description[lang]}</p>
                        <a href={`${MAPS}${encodeURIComponent(place.mapsQuery)}`} target="_blank" rel="noreferrer">
                          <Navigation aria-hidden="true" size={13} />
                          {t.directions}
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
      {plan.length > PREVIEW_DAYS && (
        <button type="button" className={styles.secondaryButton} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? t.showLess : t.showAll(plan.length)}
        </button>
      )}
      <p className={styles.planNote}>{t.printNote}</p>
    </section>
  );
}
