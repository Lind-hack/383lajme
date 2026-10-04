"use client";

// The city packs, start to finish, in one place:
//
//   What they are — three points: seven places with a guide, two cards for
//                   your own photos and story, one painting you complete by
//                   visiting.
//   Pick yours    — before the questions: example packs and a start button;
//                   the six questions run right here; after them, three packs
//                   picked from the answers (chosen cities first, then the
//                   cities the interests suggest).
//   All of Kosovo — the box with all seven packs.
//   Collection    — every card the visitor has unboxed, kept together.
//
// A tap on a pack opens it (pack-opener); a card opens in card-detail.

import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Images, MapPinned, Palette, Pencil, RotateCw, Sparkles } from "lucide-react";
import { PACK_ART, PACK_CITIES, packCards, stampState } from "@/lib/xhep/packs.mjs";
import { newSeed, suggestCities } from "@/lib/xhep/profile.mjs";
import { xhepDict, type XhepLang } from "@/lib/xhep/i18n";
import { track } from "@/lib/analytics";
import Quiz, { type QuizAnswers } from "../quiz";
import { cityName, type PackCard } from "./cards";
import PackOpener from "./pack-opener";
import CardDetail from "./card-detail";
import Collection from "./collection";
import PackModel from "./pack-model";
import { useXhepProfile } from "./use-profile";
import styles from "./packs.module.css";

/** Shown as examples before the questions: one from each corner of Kosovo. */
const EXAMPLES = ["prizren", "peje", "prishtine"];

export default function PackShelf({ lang, focusCity = null }: { lang: XhepLang; focusCity?: string | null }) {
  const t = xhepDict(lang).packs;
  const { profile, update } = useXhepProfile();
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ cityId: string; card: PackCard } | null>(null);
  const [boxOpen, setBoxOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [quiz, setQuiz] = useState(false);
  const [flipped, setFlipped] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);

  const answered = Boolean(profile?.completed);
  const chosen = (profile?.cities ?? []).filter((c: string) => PACK_CITIES.includes(c));
  const forYou: string[] = answered ? [...new Set([...chosen, ...suggestCities(profile?.interests ?? [])])].slice(0, 3) : EXAMPLES;
  const opened = PACK_CITIES.filter((c) => profile?.packs?.[c]);

  // Arriving from search or the map with a city chosen: open the box at that pack.
  useEffect(() => {
    if (!focusCity || !PACK_CITIES.includes(focusCity)) return;
    setBoxOpen(true);
    window.setTimeout(() => grid.current?.querySelector<HTMLElement>(`[data-city="${focusCity}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 450);
  }, [focusCity]);

  const openPack = (cityId: string) => {
    setOpen(cityId);
    track("xhep_pack_open", { city: cityId, first: !profile?.packs?.[cityId] });
  };

  const finishQuiz = (answers: QuizAnswers) => {
    update((p) => ({ ...answers, seed: p.seed ?? newSeed(), completed: true }));
    setQuiz(false);
    track("xhep_quiz_complete", { traveller_type: answers.travellerType, arrival: answers.arrival, interest_count: answers.interests.length, city_count: answers.cities.length });
    window.setTimeout(() => section.current?.querySelector("[data-for-you]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
  };

  // A render function, not a component: a component defined here would be a new
  // type every render and restart each pack's animation on every profile write.
  const pack = (cityId: string, delay = 0, example = false) => {
    const isOpen = Boolean(profile?.packs?.[cityId]);
    const state = stampState(profile, cityId);
    const isFlipped = flipped === cityId;
    return (
      <div className={styles.shelfItem} data-city={cityId} data-focus={focusCity === cityId || undefined}>
        {example && <span className={styles.exampleTag}>{t.example}</span>}
        <button
          type="button"
          className={styles.shelfPack}
          onClick={() => openPack(cityId)}
          aria-label={isOpen ? t.openedLabel(cityName(cityId), state.done, state.total) : t.sealedLabel(cityName(cityId))}
        >
          <PackModel cityId={cityId} lang={lang} t={t.back} motion={isFlipped ? "still" : "wiggle"} flipped={isFlipped} torn={isOpen} complete={state.complete} delay={delay} />
        </button>
        <span className={styles.shelfMeta}>
          <b>{cityName(cityId)}</b>
          <small data-open={isOpen || undefined} data-complete={state.complete || undefined}>
            {state.complete ? t.completeShort : isOpen ? t.stampsShort(state.done, state.total) : t.sealed}
          </small>
        </span>
        <button type="button" className={styles.flipButton} onClick={() => setFlipped(isFlipped ? null : cityId)} aria-pressed={isFlipped} aria-label={t.flipLabel(cityName(cityId))}>
          <RotateCw aria-hidden="true" size={14} />
          {isFlipped ? t.flipFront : t.flipBack}
        </button>
      </div>
    );
  };

  return (
    <section className={styles.shelf} id="packs" ref={section} aria-labelledby="packs-title">
      <div className={styles.shelfHead}>
        <p className={styles.kicker}>{t.kicker}</p>
        <h2 id="packs-title">{t.title}</h2>
        <p>{t.intro}</p>
      </div>

      {/* What a pack holds, at a glance. */}
      <ul className={styles.explain}>
        <li>
          <span className={styles.explainIcon} aria-hidden="true"><MapPinned size={20} /></span>
          <b>{t.what.places}</b>
          <small>{t.what.placesHint}</small>
        </li>
        <li>
          <span className={styles.explainIcon} aria-hidden="true"><Images size={20} /></span>
          <b>{t.what.memories}</b>
          <small>{t.what.memoriesHint}</small>
        </li>
        <li>
          <span className={styles.explainIcon} aria-hidden="true"><Palette size={20} /></span>
          <b>{t.what.puzzle}</b>
          <small>{t.what.puzzleHint}</small>
        </li>
      </ul>

      {quiz ? (
        <div className={styles.quizWrap} id="your-card">
          <Quiz lang={lang} initial={profile} onDone={finishQuiz} />
          <button type="button" className={styles.textButton} onClick={() => setQuiz(false)}>{t.quizCancel}</button>
        </div>
      ) : (
        <div className={styles.pick} id="your-card" data-for-you={answered || undefined}>
          <div className={styles.pickCopy}>
            <p className={styles.kicker}>{answered ? t.forYou : t.featured}</p>
            <h3>{answered ? t.forYouTitle : t.pickTitle}</h3>
            <p>{answered ? t.forYouIntro : t.pickIntro}</p>
            {answered ? (
              <button type="button" className={styles.textButton} onClick={() => setQuiz(true)}>
                <Pencil aria-hidden="true" size={14} />
                {t.changeAnswers}
              </button>
            ) : (
              <button
                type="button"
                className={styles.quizCta}
                onClick={() => {
                  setQuiz(true);
                  track("xhep_quiz_start");
                }}
              >
                <Sparkles aria-hidden="true" size={18} />
                {t.quizStart}
                <ArrowRight aria-hidden="true" size={18} />
              </button>
            )}
          </div>
          <div className={styles.forYouPacks}>
            {forYou.map((cityId, i) => (
              <div key={cityId} className={styles.showcaseSlot}>{pack(cityId, i * 0.45, !answered)}</div>
            ))}
          </div>
        </div>
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
          </span>
          <span className={styles.boxText}>
            <b>{t.box.title}</b>
            <small>{boxOpen ? t.box.close : t.box.sub}</small>
          </span>
        </button>
        <button type="button" className={styles.collectionButton} onClick={() => setCollectionOpen(true)}>
          <span className={styles.collectionIcon} aria-hidden="true"><BookOpen size={22} /></span>
          <span className={styles.boxText}>
            <b>{t.collection.title}</b>
            <small>{t.collection.count(opened.length * 10, PACK_CITIES.length * 10)}</small>
          </span>
        </button>
      </div>

      {boxOpen && (
        <div className={styles.boxGrid} id="pack-box" ref={grid}>
          {PACK_CITIES.map((cityId, i) => (
            <div key={cityId} className={styles.boxGridItem} style={{ "--i": i } as React.CSSProperties}>
              {pack(cityId, i * 0.3)}
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
            setDetail(null);
          }}
          onOpenCard={(card) => setDetail({ cityId: open, card })}
          t={t.opener}
          back={t.back}
        />
      )}
      {collectionOpen && (
        <Collection
          lang={lang}
          profile={profile}
          onClose={() => {
            setCollectionOpen(false);
            setDetail(null);
          }}
          onOpenCard={(cityId, card) => setDetail({ cityId, card })}
          onOpenPack={(cityId) => {
            setCollectionOpen(false);
            openPack(cityId);
          }}
        />
      )}
      {detail && (
        <CardDetail
          key={detail.card.id}
          card={detail.card}
          cityId={detail.cityId}
          lang={lang}
          profile={profile}
          index={(packCards(detail.cityId) as PackCard[]).findIndex((c) => c.id === detail.card.id) + 1}
          total={10}
          onClose={() => setDetail(null)}
          t={t.detail}
        />
      )}
    </section>
  );
}
