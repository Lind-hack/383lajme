"use client";

// The page a room invite opens. A member of the room sees it straight away;
// anyone else picks a name and joins, then sees it.

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Users } from "lucide-react";
import { joinRoom } from "@/lib/xhep/rooms-client";
import { track } from "@/lib/analytics";
import { useXhepProfile } from "../packs/use-profile";
import RoomPanel from "./room-panel";
import { useMyRooms, useRoomSync } from "./together";
import { TOGETHER } from "./text";
import styles from "./rooms.module.css";

export default function RoomJoin({ lang, code, name }: { lang: "en" | "sq"; code: string; name: string | null }) {
  const t = TOGETHER[lang];
  const { profile } = useXhepProfile();
  const progress = useRoomSync();
  const rooms = useMyRooms();
  const mine = rooms.find((r) => r.code === code);
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shown = displayName || profile?.name || "";
  const packsHref = `/visit?lang=${lang}#packs`;

  if (!name) {
    return (
      <section className={styles.together} data-page>
        <div className={styles.head}>
          <h2>{t.notFound}</h2>
          <p>
            <Link className={styles.primary} href={packsHref}>{t.backToPacks}</Link>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.together} data-page aria-labelledby="room-title">
      <div className={styles.head}>
        <p className={styles.kicker}>Kosova në xhep · {t.roomTitle}</p>
        <h2 id="room-title">{mine ? name : t.joinTitle(name)}</h2>
        {!mine && <p>{t.joinIntro}</p>}
      </div>
      <div className={styles.roomPage}>
        {mine ? (
          <article className={styles.roomCard}>
            <RoomPanel lang={lang} room={mine} />
          </article>
        ) : (
          <article className={styles.roomCard}>
            <div className={styles.start}>
              <span className={styles.startIcon} aria-hidden="true"><Users size={26} /></span>
              <label className={styles.field}>
                {t.yourName}
                <input type="text" maxLength={18} value={shown} placeholder={t.yourNamePlaceholder} onChange={(e) => setDisplayName(e.target.value)} autoComplete="given-name" />
              </label>
              <button
                type="button"
                className={styles.primary}
                disabled={busy || !shown.trim()}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  const r = await joinRoom(code, name, shown, progress);
                  setBusy(false);
                  if (!r.ok) setError(t.errors[r.code ?? "failed"] ?? t.errors.failed);
                  else track("xhep_room_join", { from: "link" });
                }}
              >
                <Users size={18} aria-hidden="true" />
                {busy ? t.joining : t.join}
              </button>
              {error && <p className={styles.error} role="status">{error}</p>}
            </div>
          </article>
        )}
        <Link className={styles.toPacks} href={packsHref}>
          {t.backToPacks}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
