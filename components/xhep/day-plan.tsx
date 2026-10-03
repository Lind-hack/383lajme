"use client";

import { BadgeCheck, Clock3, MapPinCheck, Navigation } from "lucide-react";
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

export type StampResult = { ok: true } | { ok: false; code: string; distanceM?: number };

export default function DayPlan({
  lang,
  profile,
  onStamp,
}: {
  lang: XhepLang;
  profile: Profile;
  /** Present on the visitor's own plan; absent on a shared trip page. */
  onStamp?: (placeId: string) => Promise<StampResult>;
}) {
  const t = xhepDict(lang).plan;
  const stampedIds = useMemo(() => new Set((profile.stamps ?? []).map((st: string) => st.split(".")[0])), [profile.stamps]);
  const [stampState, setStampState] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const stamp = async (placeId: string) => {
    if (!onStamp) return;
    setBusyId(placeId);
    setStampState((s) => ({ ...s, [placeId]: t.checking }));
    const res = await onStamp(placeId);
    const e = t.stampErrors;
    const message = res.ok
      ? t.stamped
      : res.code === "too_far" ? e.too_far(res.distanceM ?? null)
      : res.code === "low_accuracy" ? e.low_accuracy
      : res.code === "denied" ? e.denied
      : e.generic;
    setStampState((s) => ({ ...s, [placeId]: message }));
    setBusyId(null);
  };
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
                        <div className={styles.planActions}>
                          <a href={`${MAPS}${encodeURIComponent(place.mapsQuery)}`} target="_blank" rel="noreferrer">
                            <Navigation aria-hidden="true" size={13} />
                            {t.directions}
                          </a>
                          {onStamp && place.coords && (stampedIds.has(place.id) ? (
                            <span className={styles.stampDone}>
                              <BadgeCheck aria-hidden="true" size={14} />
                              {t.stamped}
                            </span>
                          ) : (
                            <button type="button" className={styles.stampButton} disabled={busyId !== null} onClick={() => void stamp(place.id)}>
                              <MapPinCheck aria-hidden="true" size={14} />
                              {t.imHere}
                            </button>
                          ))}
                        </div>
                        {stampState[place.id] && !stampedIds.has(place.id) && <p className={styles.stampMessage} role="status">{stampState[place.id]}</p>}
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
      <p className={styles.planNote}>
        {t.printNote}
        {onStamp ? ` ${t.stampPrivacy}` : ""}
      </p>
    </section>
  );
}
