"use client";

// The shelf of city packs on /visit. Pick a city, rip its pack open, keep its
// cards. Opened packs show how many of the city's places are stamped.

import { useEffect, useRef, useState } from "react";
import { PACK_ART, PACK_CITIES, packCards, stampState } from "@/lib/xhep/packs.mjs";
import { xhepDict, type XhepLang } from "@/lib/xhep/i18n";
import { track } from "@/lib/analytics";
import { cityName, type PackCard } from "./cards";
import PackOpener from "./pack-opener";
import CardDetail from "./card-detail";
import { useXhepProfile } from "./use-profile";
import styles from "./packs.module.css";

export default function PackShelf({ lang, focusCity = null }: { lang: XhepLang; focusCity?: string | null }) {
  const t = xhepDict(lang).packs;
  const { profile, update } = useXhepProfile();
  const [open, setOpen] = useState<string | null>(null);
  const [card, setCard] = useState<PackCard | null>(null);

  const cards = open ? (packCards(open) as PackCard[]) : [];
  const row = useRef<HTMLUListElement>(null);

  // Arriving from search with a city chosen: bring its pack into view.
  useEffect(() => {
    if (!focusCity) return;
    const el = row.current?.querySelector<HTMLElement>(`[data-city="${focusCity}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [focusCity]);

  return (
    <section className={styles.shelf} id="packs" aria-labelledby="packs-title">
      <div className={styles.shelfHead}>
        <h2 id="packs-title">{t.title}</h2>
        <p>{t.intro}</p>
      </div>
      <ul className={styles.shelfRow} ref={row}>
        {PACK_CITIES.map((cityId) => {
          const opened = Boolean(profile?.packs?.[cityId]);
          const state = stampState(profile, cityId);
          return (
            <li key={cityId}>
              <button
                type="button"
                className={styles.shelfPack}
                data-open={opened || undefined}
                data-city={cityId}
                data-focus={focusCity === cityId || undefined}
                onClick={() => {
                  setOpen(cityId);
                  track("xhep_pack_open", { city: cityId, first: !opened });
                }}
                aria-label={opened ? t.openedLabel(cityName(cityId), state.done, state.total) : t.sealedLabel(cityName(cityId))}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={PACK_ART[cityId as keyof typeof PACK_ART].src} alt="" loading="lazy" draggable={false} width={640} height={1000} />
                {opened && <span className={styles.shelfBadge}>{state.done}/{state.total}</span>}
                <span className={styles.shelfMeta}>
                  {cityName(cityId)}
                  <small>{opened ? t.stampsShort(state.done, state.total) : t.sealed}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {open && (
        <PackOpener
          key={open}
          cityId={open}
          lang={lang}
          profile={profile}
          alreadyOpen={Boolean(profile?.packs?.[open])}
          onOpened={() => update((p) => ({ packs: { ...(p.packs ?? {}), [open]: p.packs?.[open] ?? new Date().toISOString() } }))}
          onClose={() => {
            setOpen(null);
            setCard(null);
          }}
          onOpenCard={setCard}
          t={t.opener}
        />
      )}
      {open && card && (
        <CardDetail
          key={card.id}
          card={card}
          cityId={open}
          lang={lang}
          profile={profile}
          index={cards.findIndex((c) => c.id === card.id) + 1}
          total={cards.length}
          onClose={() => setCard(null)}
          t={t.detail}
        />
      )}
    </section>
  );
}
