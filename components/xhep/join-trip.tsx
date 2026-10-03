"use client";

import { Users } from "lucide-react";
import { useState } from "react";
import { newSeed, readProfile, writeProfile } from "@/lib/xhep/profile.mjs";
import { decodeTrip, joinTrip } from "@/lib/xhep/trip-link.mjs";
import { xhepDict, type XhepLang } from "@/lib/xhep/i18n";
import { track } from "@/lib/analytics";
import styles from "./xhep.module.css";

/** "Travel together": weave the friend's own card from the shared trip. */
export default function JoinTrip({ lang, payload }: { lang: XhepLang; payload: string }) {
  const t = xhepDict(lang).trip;
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const join = () => {
    const trip = decodeTrip(payload);
    if (!trip) return;
    const existing = readProfile();
    if (existing?.completed && !window.confirm(t.replaceConfirm)) return;
    setBusy(true);
    writeProfile(joinTrip(trip, { name, seed: newSeed() }));
    track("xhep_trip_join");
    window.location.assign(`/visit${lang === "sq" ? "?lang=sq" : ""}#your-card`);
  };

  return (
    <div className={styles.joinBox}>
      <h3>{t.joinTitle}</h3>
      <p>{t.joinIntro}</p>
      <label className={styles.field}>
        {t.nameLabel}
        <input type="text" maxLength={18} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button type="button" className={styles.primaryButton} disabled={busy} onClick={join}>
        <Users aria-hidden="true" size={16} />
        {busy ? t.joining : t.join}
      </button>
    </div>
  );
}
