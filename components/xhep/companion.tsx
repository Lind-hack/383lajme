"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { clearProfile, newSeed, readProfile, writeProfile } from "@/lib/xhep/profile.mjs";
import { xhepDict, type XhepLang } from "@/lib/xhep/i18n";
import { tripUrl } from "@/lib/xhep/trip-link.mjs";
import { track } from "@/lib/analytics";
import Quiz, { type QuizAnswers } from "./quiz";
import MyCard from "./my-card";
import XhepHelp from "./help";
import DayPlan, { type StampResult } from "./day-plan";
import Memories from "./memories";
import styles from "./xhep.module.css";

type Profile = ReturnType<typeof readProfile>;

/**
 * The personal heart of Kosova në xhep: a six-step quiz that weaves the
 * visitor's own card. Everything stays on the device. The profile is read
 * after mount so the server render and the first client render agree.
 */
export default function XhepCompanion({ lang, children }: { lang: XhepLang; children?: (profile: NonNullable<Profile>) => React.ReactNode }) {
  const t = xhepDict(lang).companion;
  const [profile, setProfile] = useState<Profile>(null);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<"intro" | "quiz" | "card">("intro");

  useEffect(() => {
    const stored = readProfile();
    setProfile(stored);
    setView(stored?.completed ? "card" : "intro");
    setLoaded(true);
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
    let position: GeolocationPosition;
    try {
      position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("unsupported"));
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 });
      });
    } catch {
      return { ok: false, code: "denied" };
    }
    try {
      const response = await fetch("/api/xhep/stamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, seed: profile.seed, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
      });
      const payload = (await response.json()) as { ok?: boolean; stamp?: string; code?: string; distanceM?: number };
      if (!response.ok || !payload.ok || !payload.stamp) return { ok: false, code: payload.code ?? "generic", distanceM: payload.distanceM };
      writeProfile({ ...profile, stamps: [...(profile.stamps ?? []), payload.stamp] });
      setProfile(readProfile());
      track("xhep_stamp", { city: placeId.split("-")[0] });
      return { ok: true };
    } catch {
      return { ok: false, code: "generic" };
    }
  };

  const reset = () => {
    clearProfile();
    setProfile(null);
    setView("intro");
  };

  const qrUrl = profile ? tripUrl(profile, lang) : `https://383ks.com/visit${lang === "sq" ? "?lang=sq" : ""}`;

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
          <MyCard lang={lang} profile={profile} qrUrl={qrUrl} onEdit={() => setView("quiz")} onReset={reset} />
          <DayPlan lang={lang} profile={profile} onStamp={addStamp} />
          <Memories lang={lang} profile={profile} />
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

      {loaded && view !== "quiz" && <XhepHelp key={profile?.updatedAt ?? "none"} lang={lang} profile={profile} />}
    </section>
  );
}
