"use client";

// Share and travel together, on /visit:
//   - the trip card: a story-sized picture of the visitor's seven paintings
//     with a QR, shared through the phone's share sheet or saved;
//   - the trip room: start one or join with a code; once in, the room panel
//     (invite, race, moments).
// Whatever the visitor does in the packs is sent to their rooms as a progress
// summary (lib/xhep/rooms.mjs progressOf), which posts the pack-opened and
// painting-finished moments for everyone to see.

import { useEffect, useMemo, useState } from "react";
import { Download, Share2, Users } from "lucide-react";
import { progressOf } from "@/lib/xhep/rooms.mjs";
import { ROOMS_EVENT, createRoom, joinRoom, myRooms, roomUrl, syncProgress, type MyRoom, type Progress } from "@/lib/xhep/rooms-client";
import { tripUrl } from "@/lib/xhep/trip-link.mjs";
import { downloadBlob, shareBlob } from "@/lib/xhep/card-export";
import { track } from "@/lib/analytics";
import { useXhepProfile } from "../packs/use-profile";
import { shareCardPng } from "./share-card";
import RoomPanel from "./room-panel";
import { TOGETHER } from "./text";
import styles from "./rooms.module.css";

/** Rooms this device is in, live across components and tabs. */
export function useMyRooms() {
  const [rooms, setRooms] = useState<MyRoom[]>([]);
  useEffect(() => {
    const sync = () => setRooms(myRooms());
    sync();
    window.addEventListener(ROOMS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ROOMS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return rooms;
}

/** Send progress to the visitor's rooms whenever it changes (debounced). */
export function useRoomSync() {
  const { profile } = useXhepProfile();
  const progress = useMemo(() => progressOf(profile) as Progress, [profile]);
  const key = JSON.stringify(progress);
  useEffect(() => {
    const id = window.setTimeout(() => void syncProgress(JSON.parse(key)), 1200);
    return () => window.clearTimeout(id);
  }, [key]);
  return progress;
}

export default function Together({ lang }: { lang: "en" | "sq" }) {
  const t = TOGETHER[lang];
  const { profile } = useXhepProfile();
  const progress = useRoomSync();
  const rooms = useMyRooms();
  const [active, setActive] = useState<string | null>(null);
  const room = rooms.find((r) => r.code === active) ?? rooms[0] ?? null;

  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"" | "create" | "join" | "card">("");
  const [error, setError] = useState("");
  const displayName = name || profile?.name || "";

  const card = async (mode: "share" | "save") => {
    setBusy("card");
    try {
      const url = room ? roomUrl(room.code, lang) : profile ? tripUrl(profile, lang) : "https://383ks.com/visit";
      const blob = await shareCardPng({ name: displayName, progress, url, roomName: room?.name ?? null, t: t.share });
      const file = "383-kosova-ne-xhep.png";
      if (mode === "save" || !(await shareBlob(blob, file, `${t.shareMessage} ${url}`))) downloadBlob(blob, file);
      track("xhep_share_card", { mode, in_room: Boolean(room) });
    } finally {
      setBusy("");
    }
  };

  const create = async () => {
    setError("");
    setBusy("create");
    const r = await createRoom(roomName, displayName, progress);
    setBusy("");
    if (!r.ok) setError(t.errors[r.code ?? "failed"] ?? t.errors.failed);
    else {
      setActive(r.code);
      track("xhep_room_create");
    }
  };

  const join = async () => {
    setError("");
    const clean = code.trim().toLowerCase();
    if (!/^[a-z0-9]{6}$/.test(clean)) return setError(t.errors.not_found);
    setBusy("join");
    const r = await joinRoom(clean, clean, displayName, progress);
    setBusy("");
    if (!r.ok) setError(t.errors[r.code ?? "failed"] ?? t.errors.failed);
    else {
      setActive(clean);
      track("xhep_room_join", { from: "code" });
    }
  };

  return (
    <section className={styles.together} id="together" aria-labelledby="together-title">
      <div className={styles.head}>
        <p className={styles.kicker}>{t.kicker}</p>
        <h2 id="together-title">{t.title}</h2>
        <p>{t.intro}</p>
      </div>

      <div className={styles.grid}>
        <article className={styles.shareCard}>
          <div className={styles.cardPreview} aria-hidden="true">
            {["prizren", "peje", "prishtine", "gjakove"].map((c, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={c} src={`/visit/scenes/${c}.webp`} alt="" style={{ "--i": i } as React.CSSProperties} data-done={progress.painted.includes(c) || undefined} loading="lazy" />
            ))}
          </div>
          <h3>{t.shareTitle}</h3>
          <p>{t.shareBody}</p>
          <p className={styles.stats}>{t.share.stats(progress.opened.length, progress.stamps, progress.painted.length)}</p>
          <div className={styles.cardActions}>
            <button type="button" className={styles.primary} onClick={() => void card("share")} disabled={busy === "card"}>
              <Share2 size={18} aria-hidden="true" />
              {busy === "card" ? t.making : t.shareButton}
            </button>
            <button type="button" className={styles.ghost} onClick={() => void card("save")} disabled={busy === "card"}>
              <Download size={16} aria-hidden="true" />
              {t.saveButton}
            </button>
          </div>
        </article>

        <article className={styles.roomCard}>
          {room ? (
            <>
              {rooms.length > 1 && (
                <div className={styles.roomTabs} role="tablist">
                  {rooms.map((r) => (
                    <button key={r.code} type="button" role="tab" aria-selected={r.code === room.code} onClick={() => setActive(r.code)}>
                      {r.name}
                    </button>
                  ))}
                </div>
              )}
              <RoomPanel key={room.code} lang={lang} room={room} onLeft={() => setActive(null)} />
            </>
          ) : (
            <div className={styles.start}>
              <span className={styles.startIcon} aria-hidden="true"><Users size={26} /></span>
              <h3>{t.roomTitle}</h3>
              <p>{t.roomIntro}</p>
              <label className={styles.field}>
                {t.yourName}
                <input type="text" maxLength={18} value={name || profile?.name || ""} placeholder={t.yourNamePlaceholder} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
              </label>
              <label className={styles.field}>
                {t.roomName}
                <input type="text" maxLength={40} value={roomName} placeholder={t.roomNamePlaceholder} onChange={(e) => setRoomName(e.target.value)} />
              </label>
              <button type="button" className={styles.primary} onClick={() => void create()} disabled={busy !== "" || !displayName.trim()}>
                <Users size={18} aria-hidden="true" />
                {busy === "create" ? t.creating : t.create}
              </button>
              <div className={styles.joinRow}>
                <span>{t.orJoin}</span>
                <input type="text" inputMode="text" autoCapitalize="characters" maxLength={6} value={code} placeholder={t.codePlaceholder} onChange={(e) => setCode(e.target.value)} aria-label={t.codePlaceholder} />
                <button type="button" className={styles.ghost} onClick={() => void join()} disabled={busy !== "" || code.trim().length !== 6 || !displayName.trim()}>
                  {busy === "join" ? t.joining : t.join}
                </button>
              </div>
              {error && <p className={styles.error} role="status">{error}</p>}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
