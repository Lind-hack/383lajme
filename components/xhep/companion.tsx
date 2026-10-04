"use client";

import { ArrowRight, Pencil, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { clearProfile, newSeed, PROFILE_EVENT, readProfile, writeProfile } from "@/lib/xhep/profile.mjs";
import { xhepDict, type XhepLang } from "@/lib/xhep/i18n";
import { requestGpsStamp } from "@/lib/xhep/gps-stamp";
import { track } from "@/lib/analytics";
import Quiz, { type QuizAnswers } from "./quiz";
import XhepHelp, { type LiveFuel } from "./help";
import DayPlan, { type StampResult } from "./day-plan";
import styles from "./xhep.module.css";

type Profile = ReturnType<typeof readProfile>;

/**
 * The personal heart of Kosova në xhep: a six-step quiz that weaves the
 * visitor's own card. Everything stays on the device. The profile is read
 * after mount so the server render and the first client render agree.
 */
export default function XhepCompanion({ lang, fuel = null, children }: { lang: XhepLang; fuel?: LiveFuel | null; children?: (profile: NonNullable<Profile>) => React.ReactNode }) {
  const t = xhepDict(lang).companion;
  const cardText = xhepDict(lang).card;
  const [profile, setProfile] = useState<Profile>(null);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<"intro" | "quiz" | "card">("intro");

  useEffect(() => {
    const stored = readProfile();
    setProfile(stored);
    setView(stored?.completed ? "card" : "intro");
    setLoaded(true);
    // Stamps and packs written elsewhere on the page (the pack shelf) show here too.
    const sync = () => setProfile(readProfile());
    window.addEventListener(PROFILE_EVENT, sync);
    return () => window.removeEventListener(PROFILE_EVENT, sync);
  }, []);

  const startQuiz = () => {
    track("xhep_quiz_start");
    setView("quiz");
  };

  const finish = (answers: QuizAnswers) => {
    const next = { ...(profile ?? {}), ...answers, seed: profile?.seed ?? newSeed(), completed: true };
    writeProfile(next);
    const saved = readProfile();
    setProfile(saved);
    setView("card");
    track("xhep_quiz_complete", {
      traveller_type: answers.travellerType,
      arrival: answers.arrival,
      interest_count: answers.interests.length,
      city_count: answers.cities.length,
    });
    document.getElementById("your-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /** One fresh position → the server's verdict → a signed stamp on the card. */
  const addStamp = async (placeId: string): Promise<StampResult> => {
    if (!profile?.seed) return { ok: false, code: "generic" };
    const result = await requestGpsStamp(placeId, profile.seed);
    if (!result.ok) return { ok: false, code: result.code === "unknown_place" ? "generic" : result.code, distanceM: result.distanceM };
    const current = readProfile() ?? profile;
    writeProfile({ ...current, stamps: [...(current.stamps ?? []), result.stamp] });
    setProfile(readProfile());
    track("xhep_stamp", { city: placeId.split("-")[0] });
    return { ok: true };
  };

  const reset = () => {
    clearProfile();
    setProfile(null);
    setView("intro");
  };


  return (
    <section className={styles.companion} id="your-card" aria-labelledby="xhep-companion-title">
      <div className={styles.companionHead}>
        <h2 id="xhep-companion-title">{t.title}</h2>
        {view !== "card" && <p>{t.intro}</p>}
      </div>

      {!loaded ? (
        <div className={styles.companionSkeleton} aria-hidden="true" />
      ) : view === "quiz" ? (
        <Quiz lang={lang} initial={profile} onDone={finish} />
      ) : view === "card" && profile ? (
        <>
          {/* The woven qilim card and keepsake gave way to the city packs below
              (stamp scene, mural, trip QR); the plan and the answers stay. */}
          <div className={styles.cardMeta}>
            <button type="button" className={styles.linkButton} onClick={() => setView("quiz")}>
              <Pencil aria-hidden="true" size={14} />
              {cardText.edit}
            </button>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                if (window.confirm(cardText.resetConfirm)) reset();
              }}
            >
              <RotateCcw aria-hidden="true" size={14} />
              {cardText.reset}
            </button>
          </div>
          <DayPlan lang={lang} profile={profile} onStamp={addStamp} />
          {children?.(profile)}
        </>
      ) : (
        <button type="button" className={styles.startCard} onClick={startQuiz}>
          <Sparkles aria-hidden="true" size={22} />
          <span>
            <b>{profile ? t.resume : t.start}</b>
            <small>{t.startHint}</small>
          </span>
          <ArrowRight aria-hidden="true" size={20} />
        </button>
      )}

      {loaded && view !== "quiz" && <XhepHelp key={profile?.updatedAt ?? "none"} lang={lang} profile={profile} fuel={fuel} />}
    </section>
  );
}
