"use client";

// One trip room as its members see it: the invite (a big QR, copy, WhatsApp),
// the race (members ranked by what they've painted, each with their seven
// cities as dots), and the moments feed with a box to post one. Refreshes
// every 20 seconds while it is on screen.

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, LogOut, MessageCircle, Send, Share2, Trophy } from "lucide-react";
import { PACK_CITIES } from "@/lib/xhep/packs.mjs";
import { CITY_NAMES } from "@/lib/xhep/card-art.mjs";
import { MOMENT_MAX } from "@/lib/xhep/rooms.mjs";
import { fetchRoom, leaveRoom, postMoment, roomUrl, type MyRoom, type RoomView } from "@/lib/xhep/rooms-client";
import Qr from "./qr";
import { TOGETHER } from "./text";
import styles from "./rooms.module.css";

const cityName = (id: string | null) => (id ? (CITY_NAMES[id as keyof typeof CITY_NAMES] ?? id) : "");

export default function RoomPanel({ lang, room, onLeft }: { lang: "en" | "sq"; room: MyRoom; onLeft?: () => void }) {
  const t = TOGETHER[lang];
  const [view, setView] = useState<RoomView | null>(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [city, setCity] = useState("");
  const [posting, setPosting] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = roomUrl(room.code, lang);

  const load = useCallback(async () => {
    const r = await fetchRoom(room.code);
    if (r.ok) {
      setView(r);
      setError("");
    } else setError(r.code === "not_found" ? t.notFound : (t.errors[r.code ?? "failed"] ?? t.errors.failed));
  }, [room.code, t]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 20_000);
    return () => window.clearInterval(id);
  }, [load]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  const share = async () => {
    const message = t.inviteMessage(view?.room.name ?? room.name, url);
    try {
      if (navigator.share) await navigator.share({ text: message });
      else await copy();
    } catch {}
  };
  const post = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    const r = await postMoment(room, text, city || null);
    setPosting(false);
    if (r.ok) {
      setText("");
      void load();
    } else setError(t.errors[r.code ?? "failed"] ?? t.errors.failed);
  };

  const names = new Map(view?.members.map((m) => [m.id, m]) ?? []);
  const now = Date.now();
  const leader = view?.members[0];

  return (
    <div className={styles.room}>
      <header className={styles.roomHead}>
        <span>
          <small>{t.roomTitle} · {room.code.toUpperCase()}</small>
          <b>{view?.room.name ?? room.name}</b>
        </span>
        <button
          type="button"
          className={styles.leave}
          onClick={async () => {
            await leaveRoom(room);
            onLeft?.();
          }}
        >
          <LogOut size={14} aria-hidden="true" />
          {t.leave}
        </button>
      </header>

      <section className={styles.invite} aria-label={t.invite}>
        <Qr text={url} className={styles.inviteQr} />
        <div>
          <b>{t.invite}</b>
          <small>{t.inviteHint}</small>
          <span className={styles.code}>{room.code.toUpperCase()}</span>
          <span className={styles.inviteActions}>
            <button type="button" onClick={() => void copy()}>
              {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
              {copied ? t.copied : t.copyLink}
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(t.inviteMessage(view?.room.name ?? room.name, url))}`} target="_blank" rel="noreferrer" data-wa>
              <MessageCircle size={15} aria-hidden="true" />
              {t.whatsapp}
            </a>
            <button type="button" onClick={() => void share()}>
              <Share2 size={15} aria-hidden="true" />
            </button>
          </span>
        </div>
      </section>

      {error && <p className={styles.error} role="status">{error}</p>}

      <section aria-label={t.race}>
        <h4 className={styles.subhead}>
          <Trophy size={16} aria-hidden="true" />
          {t.race}
        </h4>
        <ol className={styles.race}>
          {view?.members.map((m, i) => (
            <li key={m.id} data-me={m.id === room.memberId || undefined} style={{ "--c": m.colour } as React.CSSProperties}>
              <span className={styles.rank}>{i + 1}</span>
              <span className={styles.avatar} aria-hidden="true">{m.name.slice(0, 1).toUpperCase()}</span>
              <span className={styles.who}>
                <b>
                  {m.name}
                  {m.id === room.memberId && <em> · {t.you}</em>}
                </b>
                <span className={styles.dots} aria-label={t.places(m.progress.stamps)}>
                  {PACK_CITIES.map((c) => (
                    <i key={c} title={cityName(c)} data-state={m.progress.painted.includes(c) ? "done" : m.progress.cities[c] ? "started" : m.progress.opened.includes(c) ? "open" : undefined} style={{ "--p": (m.progress.cities[c] ?? 0) / 7 } as React.CSSProperties} />
                  ))}
                </span>
              </span>
              <span className={styles.points}>
                <b>{t.places(m.progress.stamps)}</b>
                <small>{t.paintings(m.progress.painted.length)}</small>
              </span>
              {leader && m.id === leader.id && m.score > 0 && <span className={styles.crown} aria-hidden="true">👑</span>}
            </li>
          ))}
        </ol>
      </section>

      <section aria-label={t.moments}>
        <h4 className={styles.subhead}>{t.moments}</h4>
        <form
          className={styles.composer}
          onSubmit={(e) => {
            e.preventDefault();
            void post();
          }}
        >
          <input type="text" value={text} maxLength={MOMENT_MAX} placeholder={t.momentPlaceholder} onChange={(e) => setText(e.target.value)} aria-label={t.momentPlaceholder} />
          <select value={city} onChange={(e) => setCity(e.target.value)} aria-label={t.momentCity}>
            <option value="">{t.momentAny}</option>
            {PACK_CITIES.map((c) => <option key={c} value={c}>{cityName(c)}</option>)}
          </select>
          <button type="submit" disabled={posting || !text.trim()}>
            <Send size={15} aria-hidden="true" />
            {posting ? t.posting : t.post}
          </button>
        </form>
        <ul className={styles.feed}>
          {view && view.moments.length === 0 && <li className={styles.feedEmpty}>{t.empty}</li>}
          {view?.moments.map((m) => {
            const member = names.get(m.memberId);
            const who = member?.name ?? "…";
            const minutes = Math.max(0, Math.round((now - new Date(m.createdAt).getTime()) / 60_000));
            return (
              <li key={m.id} data-kind={m.kind} style={{ "--c": member?.colour ?? "#999" } as React.CSSProperties}>
                {m.cityId && m.kind !== "join" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/visit/scenes/${m.cityId}.webp`} alt="" className={styles.feedThumb} loading="lazy" />
                ) : (
                  <span className={styles.avatar} aria-hidden="true">{who.slice(0, 1).toUpperCase()}</span>
                )}
                <span>
                  {m.kind === "moment" ? (
                    <>
                      <b>{who}</b>
                      {m.cityId && <small> · {cityName(m.cityId)}</small>}
                      <p>{m.body}</p>
                    </>
                  ) : (
                    <p>{m.kind === "join" ? t.feed.join(who) : m.kind === "pack" ? t.feed.pack(who, cityName(m.cityId)) : t.feed.complete(who, cityName(m.cityId))}</p>
                  )}
                </span>
                <time dateTime={m.createdAt}>{t.ago(minutes)}</time>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
