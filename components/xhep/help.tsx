"use client";

import { AlertTriangle, CalendarDays, Coins, ExternalLink, Languages, Maximize2, Plane, Route, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CHECKED_AT, PHRASES, PRICES, ROUTE_PLACES, arrivalItems, entryFromCrossing, eventsFor, pricesAreStale, routeWarnings } from "@/lib/xhep/help.mjs";
import type { readProfile } from "@/lib/xhep/profile.mjs";
import { xhepDict, type XhepLang } from "@/lib/xhep/i18n";
import styles from "./xhep.module.css";

type Profile = ReturnType<typeof readProfile>;
type Tab = "route" | "arrival" | "prices" | "phrases" | "events";
type Source = { name: string; url: string };

/** Curated items may carry a second source; the JS data has no static type for it. */
const extraOf = (item: object): Source | undefined => (item as { extraSource?: Source }).extraSource;

function SourceLine({ source, extra, lang }: { source: Source; extra?: Source; lang: XhepLang }) {
  const t = xhepDict(lang).help;
  return (
    <p className={styles.sourceLine}>
      {t.source}:{" "}
      <a href={source.url} target="_blank" rel="noreferrer">
        {source.name}
        <ExternalLink aria-hidden="true" size={11} />
      </a>
      {extra && (
        <>
          {" · "}
          <a href={extra.url} target="_blank" rel="noreferrer">
            {extra.name}
            <ExternalLink aria-hidden="true" size={11} />
          </a>
        </>
      )}
      {" · "}
      {t.checked(CHECKED_AT)}
    </p>
  );
}

function PhraseSheet({ big, small, onClose, closeLabel }: { big: string; small: string; onClose: () => void; closeLabel: string }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className={styles.phraseSheet} role="dialog" aria-modal="true" aria-label={small}>
      <button ref={closeRef} type="button" className={styles.phraseClose} onClick={onClose}>
        <X aria-hidden="true" size={22} />
        {closeLabel}
      </button>
      <p lang="sq" className={styles.phraseBig}>{big}</p>
      {small && <p className={styles.phraseSmall}>{small}</p>}
    </div>
  );
}

export default function XhepHelp({ lang, profile }: { lang: XhepLang; profile: Profile }) {
  const t = xhepDict(lang).help;
  const tabsId = useId();
  const [tab, setTab] = useState<Tab>("route");
  const [entry, setEntry] = useState<string>(() => entryFromCrossing(profile?.crossing ?? null, profile?.arrival ?? "fly"));
  const [exit, setExit] = useState<string>(() => entryFromCrossing(profile?.crossing ?? null, profile?.arrival ?? "fly"));
  const [sheet, setSheet] = useState<{ big: string; small: string } | null>(null);
  const [custom, setCustom] = useState("");
  const closeSheet = useCallback(() => setSheet(null), []);

  const tabs: { id: Tab; icon: typeof Route }[] = [
    { id: "route", icon: Route },
    { id: "arrival", icon: Plane },
    { id: "prices", icon: Coins },
    { id: "phrases", icon: Languages },
    { id: "events", icon: CalendarDays },
  ];
  const arrival = profile?.arrival === "drive" ? "drive" : "fly";
  const events = eventsFor({ startDate: profile?.startDate ?? null, month: profile?.month ?? null, days: profile?.days ?? 1 });
  const hasDates = Boolean(profile?.startDate || profile?.month);
  const prices = PRICES.filter((price) => !price.interest || profile?.interests?.includes(price.interest as never));

  return (
    <section className={styles.help} aria-labelledby={`${tabsId}-title`}>
      <div className={styles.helpHead}>
        <h3 id={`${tabsId}-title`}>{t.title}</h3>
        <p>
          {t.intro} {profile ? t.personal : ""}
        </p>
      </div>
      <div className={styles.helpTabs} role="tablist" aria-label={t.tabsLabel}>
        {tabs.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`${tabsId}-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`${tabsId}-panel`}
            className={tab === id ? styles.helpTabOn : styles.helpTab}
            onClick={() => setTab(id)}
          >
            <Icon aria-hidden="true" size={16} />
            {t.tabs[id]}
          </button>
        ))}
      </div>

      <div className={styles.helpPanel} role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-tab-${tab}`}>
        {tab === "route" && (
          <>
            <div className={styles.routePickers}>
              <label className={styles.field}>
                {t.entryLabel}
                <select value={entry} onChange={(e) => setEntry(e.target.value)}>
                  {ROUTE_PLACES.map((place) => <option key={place} value={place}>{t.places[place as keyof typeof t.places]}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                {t.exitLabel}
                <select value={exit} onChange={(e) => setExit(e.target.value)}>
                  {ROUTE_PLACES.map((place) => <option key={place} value={place}>{t.places[place as keyof typeof t.places]}</option>)}
                </select>
              </label>
            </div>
            <ul className={styles.helpList}>
              {routeWarnings({ entry, exit }).map((rule) => (
                <li key={rule.id} className={styles[`level_${rule.level}`]}>
                  <span className={styles.levelTag}>
                    {rule.level === "stop" && <AlertTriangle aria-hidden="true" size={13} />}
                    {t.levels[rule.level as keyof typeof t.levels]}
                  </span>
                  <h4>{rule.title[lang]}</h4>
                  <p>{rule.body[lang]}</p>
                  <SourceLine source={rule.source} extra={extraOf(rule)} lang={lang} />
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === "arrival" && (
          <>
            <p className={styles.helpLead}>{arrival === "drive" ? t.arrivalDrive : t.arrivalFly}</p>
            <ul className={styles.helpList}>
              {arrivalItems(arrival).map((item) => (
                <li key={item.id}>
                  <h4>{item.title[lang]}</h4>
                  <p>{item.body[lang]}</p>
                  <SourceLine source={item.source} extra={extraOf(item)} lang={lang} />
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === "prices" && (
          <>
            <p className={styles.helpLead}>{t.pricesIntro}</p>
            {pricesAreStale() && <p className={styles.staleNote}>{t.pricesStale}</p>}
            <table className={styles.priceTable}>
              <tbody>
                {prices.map((price) => (
                  <tr key={price.id}>
                    <th scope="row">{price.label[lang]}</th>
                    <td>
                      €{price.eur.toFixed(2)}
                      {"perKm" in price && price.perKm ? <small> {t.perKm(price.perKm.toFixed(2))}</small> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <SourceLine source={PRICES[0].source} extra={prices.find((p) => p.id === "skiPass")?.source} lang={lang} />
          </>
        )}

        {tab === "phrases" && (
          <>
            <p className={styles.helpLead}>{t.phrasesIntro}</p>
            <div className={styles.phraseGrid}>
              {PHRASES.map((phrase) => (
                <button type="button" key={phrase.id} className={styles.phraseCard} onClick={() => setSheet({ big: phrase.sq, small: phrase.en })} aria-label={`${t.phraseOpen}: ${phrase.en}`}>
                  <b lang="sq">{phrase.sq}</b>
                  <small>{phrase.en}</small>
                  <Maximize2 aria-hidden="true" size={14} />
                </button>
              ))}
            </div>
            <form
              className={styles.customPhrase}
              onSubmit={(e) => {
                e.preventDefault();
                if (custom.trim()) setSheet({ big: custom.trim(), small: "" });
              }}
            >
              <label className={styles.field}>
                {t.customLabel}
                <input type="text" maxLength={120} value={custom} placeholder={t.customPlaceholder} onChange={(e) => setCustom(e.target.value)} />
              </label>
              <button type="submit" className={styles.secondaryButton} disabled={!custom.trim()}>
                <Maximize2 aria-hidden="true" size={15} />
                {t.customShow}
              </button>
            </form>
          </>
        )}

        {tab === "events" && (
          <>
            <p className={styles.helpLead}>{hasDates ? t.eventsIntro : t.eventsNoDates}</p>
            {hasDates && events.length === 0 && <p className={styles.helpEmpty}>{t.eventsNone}</p>}
            <ul className={styles.helpList}>
              {events.map((event) => (
                <li key={event.id}>
                  <h4>{event.title[lang]}</h4>
                  <p>{event.body[lang]}</p>
                  <SourceLine source={event.source} extra={extraOf(event)} lang={lang} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {sheet && <PhraseSheet big={sheet.big} small={sheet.small} closeLabel={t.phraseClose} onClose={closeSheet} />}
    </section>
  );
}
