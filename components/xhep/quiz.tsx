"use client";

import { ArrowLeft, ArrowRight, Check, Plane, CarFront } from "lucide-react";
import { useMemo, useState } from "react";
import { CITY_NAMES } from "@/lib/xhep/card-art.mjs";
import { suggestCities } from "@/lib/xhep/profile.mjs";
import { xhepDict, type XhepLang } from "@/lib/xhep/i18n";
import styles from "./xhep.module.css";

type Interest = "nature" | "history" | "food" | "coffee" | "nightlife" | "skiing";
type CityId = keyof typeof CITY_NAMES;

export type QuizAnswers = {
  name: string;
  travellerType: "first" | "diaspora" | "family";
  startDate: string | null;
  days: number;
  arrival: "fly" | "drive";
  crossing: string | null;
  interests: Interest[];
  cities: CityId[];
  budget: "easy" | "mid" | "treat";
};

const CROSSINGS = [
  ["vermice-morine", "Vërmicë / Morinë"],
  ["merdare", "Merdarë"],
  ["hani-i-elezit", "Hani i Elezit"],
  ["kulle", "Kullë"],
] as const;

const INTERESTS: Interest[] = ["nature", "history", "food", "coffee", "nightlife", "skiing"];
const STEPS = 5;

export default function Quiz({
  lang,
  initial,
  onDone,
}: {
  lang: XhepLang;
  initial: Partial<QuizAnswers> | null;
  onDone: (answers: QuizAnswers) => void;
}) {
  const t = xhepDict(lang).quiz;
  const [step, setStep] = useState(1);
  const [a, setA] = useState<QuizAnswers>({
    name: initial?.name ?? "",
    travellerType: initial?.travellerType ?? "first",
    startDate: initial?.startDate ?? null,
    days: initial?.days ?? 5,
    arrival: initial?.arrival ?? "fly",
    crossing: initial?.crossing ?? null,
    interests: (initial?.interests as Interest[] | undefined) ?? [],
    cities: (initial?.cities as CityId[] | undefined) ?? [],
    budget: initial?.budget ?? "mid",
  });
  const set = <K extends keyof QuizAnswers>(key: K, value: QuizAnswers[K]) => setA((prev) => ({ ...prev, [key]: value }));
  const suggestions = useMemo(() => suggestCities(a.interests) as CityId[], [a.interests]);

  const next = () => {
    if (step < STEPS) setStep(step + 1);
    // No city question: the three packs are recommended from the interests.
    else onDone({ ...a, cities: suggestions.slice(0, 3) });
  };
  const toggle = <T extends string>(list: T[], value: T, max: number) =>
    list.includes(value) ? list.filter((v) => v !== value) : list.length < max ? [...list, value] : list;

  return (
    <div className={styles.quiz}>
      <div className={styles.quizTop}>
        <span>{t.progress(step, STEPS)}</span>
        <div className={styles.quizBar} role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step} aria-label={t.progress(step, STEPS)}>
          <i style={{ width: `${(step / STEPS) * 100}%` }} />
        </div>
      </div>

      {step === 1 && (
        <fieldset className={styles.quizStep}>
          <legend>{t.whoTitle}</legend>
          <div className={styles.choiceGrid}>
            {(["first", "diaspora", "family"] as const).map((type) => (
              <button type="button" key={type} className={a.travellerType === type ? styles.choiceOn : styles.choice} aria-pressed={a.travellerType === type} onClick={() => set("travellerType", type)}>
                <b>{t.types[type].label}</b>
                <small>{t.types[type].hint}</small>
              </button>
            ))}
          </div>
          <label className={styles.field}>
            {t.nameLabel}
            <input type="text" maxLength={18} autoComplete="given-name" placeholder={t.namePlaceholder} value={a.name} onChange={(e) => set("name", e.target.value)} />
          </label>
        </fieldset>
      )}

      {step === 2 && (
        <fieldset className={styles.quizStep}>
          <legend>{t.whenTitle}</legend>
          <label className={styles.field}>
            {t.startLabel}
            <input type="date" value={a.startDate ?? ""} onChange={(e) => set("startDate", e.target.value || null)} />
          </label>
          <label className={styles.field}>
            <span className={styles.daysValue}>{t.daysLabel(a.days)}</span>
            <input type="range" min={1} max={30} value={a.days} onChange={(e) => set("days", Number(e.target.value))} aria-valuetext={t.daysLabel(a.days)} />
          </label>
        </fieldset>
      )}

      {step === 3 && (
        <fieldset className={styles.quizStep}>
          <legend>{t.arriveTitle}</legend>
          <div className={styles.choiceGrid}>
            <button type="button" className={a.arrival === "fly" ? styles.choiceOn : styles.choice} aria-pressed={a.arrival === "fly"} onClick={() => set("arrival", "fly")}>
              <Plane aria-hidden="true" size={20} />
              <b>{t.fly}</b>
              <small>{t.flyHint}</small>
            </button>
            <button type="button" className={a.arrival === "drive" ? styles.choiceOn : styles.choice} aria-pressed={a.arrival === "drive"} onClick={() => set("arrival", "drive")}>
              <CarFront aria-hidden="true" size={20} />
              <b>{t.drive}</b>
              <small>{t.driveHint}</small>
            </button>
          </div>
          {a.arrival === "drive" && (
            <label className={styles.field}>
              {t.crossingLabel}
              <select value={a.crossing ?? ""} onChange={(e) => set("crossing", e.target.value || null)}>
                <option value="">{t.crossingAny}</option>
                {CROSSINGS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
          )}
        </fieldset>
      )}

      {step === 4 && (
        <fieldset className={styles.quizStep}>
          <legend>{t.interestsTitle}</legend>
          <p className={styles.quizHint}>{t.interestsHint}</p>
          <div className={styles.chips}>
            {INTERESTS.map((key) => (
              <button type="button" key={key} className={a.interests.includes(key) ? styles.chipOn : styles.chip} aria-pressed={a.interests.includes(key)} onClick={() => set("interests", toggle(a.interests, key, 4))}>
                {a.interests.includes(key) && <Check aria-hidden="true" size={14} />}
                {t.interests[key]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {step === 5 && (
        <fieldset className={styles.quizStep}>
          <legend>{t.budgetTitle}</legend>
          <div className={styles.choiceGrid}>
            {(["easy", "mid", "treat"] as const).map((key) => (
              <button type="button" key={key} className={a.budget === key ? styles.choiceOn : styles.choice} aria-pressed={a.budget === key} onClick={() => set("budget", key)}>
                <b>{t.budgets[key].label}</b>
                <small>{t.budgets[key].hint}</small>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className={styles.quizNav}>
        {step > 1 ? (
          <button type="button" className={styles.ghostButton} onClick={() => setStep(step - 1)}>
            <ArrowLeft aria-hidden="true" size={16} />
            {t.back}
          </button>
        ) : <span />}
        <div className={styles.quizNavRight}>
          {step < STEPS && (
            <button type="button" className={styles.linkButton} onClick={next}>
              {t.skip}
            </button>
          )}
          <button type="button" className={styles.primaryButton} onClick={next}>
            {step < STEPS ? t.next : t.finish}
            <ArrowRight aria-hidden="true" size={16} />
          </button>
        </div>
      </div>
      <p className={styles.quizFoot}>{t.storageNote}</p>
    </div>
  );
}
