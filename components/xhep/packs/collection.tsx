"use client";

// My collection: every card the visitor has unboxed, city by city, with what
// is still to collect. An opened pack's ten cards live here for good; a
// sealed city shows its pack and an invitation to open it. A finished puzzle
// earns the city its gold seal.

import { useEffect, useRef } from "react";
import { Lock, X } from "lucide-react";
import { PACK_ART, PACK_CITIES, packCards, stampState } from "@/lib/xhep/packs.mjs";
import { xhepDict, type XhepLang } from "@/lib/xhep/i18n";
import { CardFace, cityName, type PackCard } from "./cards";
import type { XhepProfile } from "./use-profile";
import styles from "./packs.module.css";

export default function Collection({
  lang,
  profile,
  onClose,
  onOpenCard,
  onOpenPack,
}: {
  lang: XhepLang;
  profile: XhepProfile | null;
  onClose: () => void;
  onOpenCard: (cityId: string, card: PackCard) => void;
  onOpenPack: (cityId: string) => void;
}) {
  const t = xhepDict(lang).packs;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const opened = PACK_CITIES.filter((c) => profile?.packs?.[c]);
  const finished = PACK_CITIES.filter((c) => stampState(profile, c).complete);

  return (
    <dialog
      ref={dialog}
      className={styles.opener}
      aria-labelledby="collection-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className={styles.openerGlow} aria-hidden="true" />
      <header className={styles.openerHead}>
        <h2 id="collection-title" className={styles.openerTitle} tabIndex={-1} autoFocus>
          {t.collection.title}
        </h2>
        <span className={styles.openerActions}>
          <button type="button" className={styles.openerIcon} onClick={onClose} aria-label={t.opener.close}>
            <X aria-hidden="true" size={20} />
          </button>
        </span>
      </header>

      <div className={styles.collection}>
        <p className={styles.collectionSummary}>
          <b>{t.collection.count(opened.length * 10, PACK_CITIES.length * 10)}</b>
          <span>{t.collection.puzzles(finished.length, PACK_CITIES.length)}</span>
        </p>
        <div className={styles.collectionBar} aria-hidden="true">
          <i style={{ width: `${(opened.length / PACK_CITIES.length) * 100}%` }} />
        </div>

        {PACK_CITIES.map((cityId) => {
          const art = PACK_ART[cityId as keyof typeof PACK_ART];
          const isOpen = Boolean(profile?.packs?.[cityId]);
          const state = stampState(profile, cityId);
          const cards = packCards(cityId) as PackCard[];
          return (
            <section key={cityId} className={styles.collectionCity} style={{ "--accent": art.accent, "--crimp": art.crimp } as React.CSSProperties} data-complete={state.complete || undefined}>
              <header>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={art.src} alt="" />
                <span>
                  <b>{cityName(cityId)}</b>
                  <small>{isOpen ? t.collection.cityProgress(state.done, state.total) : t.sealed}</small>
                </span>
                {state.complete && <span className={styles.goldSeal}>{t.completeShort}</span>}
              </header>
              {isOpen ? (
                <ul className={styles.collectionCards}>
                  {cards.map((card, i) => (
                    <li key={card.id}>
                      <button type="button" className={styles.binderCard} onClick={() => onOpenCard(cityId, card)} style={{ "--i": i } as React.CSSProperties}>
                        <CardFace card={card} cityId={cityId} lang={lang} profile={profile} index={i + 1} total={cards.length} t={t.opener.faces} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <button type="button" className={styles.collectionLocked} onClick={() => onOpenPack(cityId)}>
                  <Lock aria-hidden="true" size={18} />
                  {t.collection.openToCollect}
                </button>
              )}
            </section>
          );
        })}
      </div>
    </dialog>
  );
}
