"use client";

// The front of Kosova në xhep: the city packs.
//
//   For you   — the packs the visitor's answers point to (their chosen cities,
//               else the cities their interests suggest), at most three; before
//               they answer, three favourites and an invitation to the
//               questions. The first one turns slowly like a showcase piece,
//               the others float. Each can be turned over to read its back.
//   The box   — "Kosova e plotë": all seven packs. Opening it lifts the lid
//               and lays the packs out; opened ones show their torn top.
//
// A tap on a pack opens it (pack-opener); a card from its binder opens in
// card-detail.

import { useEffect, useRef, useState } from "react";
import { RotateCw, Sparkles } from "lucide-react";
import { PACK_ART, PACK_CITIES, packCards, stampState } from "@/lib/xhep/packs.mjs";
import { suggestCities } from "@/lib/xhep/profile.mjs";
import { xhepDict, type XhepLang } from "@/lib/xhep/i18n";
import { track } from "@/lib/analytics";
import { cityName, type PackCard } from "./cards";
import PackOpener from "./pack-opener";
import CardDetail from "./card-detail";
import PackModel from "./pack-model";
import { useXhepProfile } from "./use-profile";
import styles from "./packs.module.css";


export default function PackShelf({ lang, focusCity = null, lead = null }: { lang: XhepLang; focusCity?: string | null; lead?: React.ReactNode }) {
  const t = xhepDict(lang).packs;
  const { profile, update } = useXhepProfile();
  const [open, setOpen] = useState<string | null>(null);
  const [card, setCard] = useState<PackCard | null>(null);
  const [boxOpen, setBoxOpen] = useState(false);
  const [flipped, setFlipped] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);

  const cards = open ? (packCards(open) as PackCard[]) : [];
  const answered = Boolean(profile?.completed);
  const chosen = (profile?.cities ?? []).filter((c: string) => PACK_CITIES.includes(c));
  // Only the answers choose packs; before that nothing is picked at random.
  const forYou: string[] = answered ? [...new Set([...chosen, ...suggestCities(profile?.interests ?? [])])].slice(0, 3) : [];

  // Arriving from search with a city chosen: open the box at that pack.
  useEffect(() => {
    if (!focusCity || !PACK_CITIES.includes(focusCity)) return;
    setBoxOpen(true);
    window.setTimeout(() => grid.current?.querySelector<HTMLElement>(`[data-city="${focusCity}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 450);
  }, [focusCity]);

  const openPack = (cityId: string) => {
    setOpen(cityId);
    track("xhep_pack_open", { city: cityId, first: !profile?.packs?.[cityId] });
  };

  /** One pack on the shelf: the object, its name and state, and a turn-over button. */
  // A render function, not a component: a component defined here would be a new
  // type every render and restart each pack's animation on every profile write.
  const pack = ({ cityId, motion, delay = 0, big = false }: { cityId: string; motion: "wiggle" | "still"; delay?: number; big?: boolean }) => {
    const opened = Boolean(profile?.packs?.[cityId]);
    const state = stampState(profile, cityId);
    const isFlipped = flipped === cityId;
    return (
      <div className={styles.shelfItem} data-big={big || undefined} data-city={cityId} data-focus={focusCity === cityId || undefined}>
        <button
          type="button"
          className={styles.shelfPack}
          onClick={() => openPack(cityId)}
          aria-label={opened ? t.openedLabel(cityName(cityId), state.done, state.total) : t.sealedLabel(cityName(cityId))}
        >
          <PackModel cityId={cityId} lang={lang} t={t.back} motion={isFlipped ? "still" : motion} flipped={isFlipped} torn={opened} delay={delay} />
        </button>
        <span className={styles.shelfMeta}>
          <b>{cityName(cityId)}</b>
          <small data-open={opened || undefined}>{opened ? t.stampsShort(state.done, state.total) : t.sealed}</small>
        </span>
        <button
          type="button"
          className={styles.flipButton}
          onClick={() => setFlipped(isFlipped ? null : cityId)}
          aria-pressed={isFlipped}
          aria-label={t.flipLabel(cityName(cityId))}
        >
          <RotateCw aria-hidden="true" size={15} />
          {isFlipped ? t.flipFront : t.flipBack}
        </button>
      </div>
    );
  };

  return (
    <section className={styles.shelf} id="packs" aria-labelledby="packs-title">
      <div className={styles.shelfHead}>
        <p className={styles.kicker}>{answered ? t.forYou : t.featured}</p>
        <h2 id="packs-title">{t.title}</h2>
        <p>{t.intro}</p>
      </div>

      <div className={styles.showcase} data-answered={answered || undefined}>
        {lead && <div className={styles.lead}>{lead}</div>}
        <div className={styles.forYou}>
          {answered ? (
            <div className={styles.forYouPacks}>
              {forYou.map((cityId, i) => (
                <div key={cityId} className={styles.showcaseSlot}>{pack({ cityId, motion: "wiggle", delay: i * 0.45 })}</div>
              ))}
            </div>
          ) : (
            <a className={styles.quizCta} href="#your-card">
              <Sparkles aria-hidden="true" size={18} />
              {t.quizCta}
            </a>
          )}
      <div className={styles.shelfActions}>
        <button type="button" className={styles.box} data-open={boxOpen || undefined} onClick={() => setBoxOpen((o) => !o)} aria-expanded={boxOpen} aria-controls="pack-box">
          <span className={styles.boxModel} aria-hidden="true">
            <span className={styles.boxLid}>
              <b>383</b>
            </span>
            <span className={styles.boxFront}>
              {["prizren", "peje", "gjakove"].map((c, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={c} src={PACK_ART[c as keyof typeof PACK_ART].src} alt="" style={{ "--i": i } as React.CSSProperties} draggable={false} />
              ))}
              <span className={styles.boxTitle}>
                <small>Travel to</small>
                KOSOVA
              </span>
            </span>
            <span className={styles.boxSide} />
          </span>
          <span className={styles.boxText}>
            <b>{t.box.title}</b>
            <small>{boxOpen ? t.box.close : t.box.sub}</small>
          </span>
        </button>
      </div>
        </div>
      </div>

      {boxOpen && (
        <div className={styles.boxGrid} id="pack-box" ref={grid}>
          {PACK_CITIES.map((cityId, i) => (
            <div key={cityId} className={styles.boxGridItem} style={{ "--i": i } as React.CSSProperties}>
              {pack({ cityId, motion: "wiggle", delay: i * 0.3 })}
            </div>
          ))}
        </div>
      )}

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
          back={t.back}
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
