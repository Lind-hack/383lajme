"use client";

// "Dërgoje te 383": a visitor offers their mural and story for the public
// Kosova në xhep page. Nothing leaves the device before this. It takes an
// account (so a takedown request can be honoured and spam answered) and an
// explicit consent tick; the submission waits, private, until an admin
// approves it and decides where it goes (app/admin/xhep).

import { useEffect, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import type { MuralPhoto } from "@/lib/xhep/journal";
import styles from "./detail.module.css";

export type SendText = {
  title: string;
  intro: string;
  signIn: string;
  consent: string;
  send: string;
  sending: string;
  sent: string;
  nothing: string;
  failed: string;
};

const SENT_KEY = "xhep.sent.v1";

function sentAt(cityId: string): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(SENT_KEY) ?? "{}")?.[cityId];
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

function markSent(cityId: string) {
  try {
    const all = JSON.parse(localStorage.getItem(SENT_KEY) ?? "{}") ?? {};
    all[cityId] = new Date().toISOString();
    localStorage.setItem(SENT_KEY, JSON.stringify(all));
  } catch {
    // The server has it; only the "sent" note is lost.
  }
}

export default function SendTo383({ cityId, photos, story, t }: { cityId: string; photos: MuralPhoto[]; story: string; t: SendText }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  useEffect(() => {
    if (sentAt(cityId)) setState("sent");
    let alive = true;
    Promise.resolve()
      .then(() => createClient().auth.getUser())
      .then(({ data }) => alive && setSignedIn(Boolean(data?.user)))
      .catch(() => alive && setSignedIn(false));
    return () => {
      alive = false;
    };
  }, [cityId]);

  const empty = photos.length === 0 && story.trim().length === 0;

  async function send() {
    setState("sending");
    const body = new FormData();
    body.set("cityId", cityId);
    body.set("story", story.slice(0, 2000));
    body.set("consent", consent ? "yes" : "no");
    photos.forEach((p, i) => body.append("photos", p.blob, `${cityId}-${i + 1}.jpg`));
    try {
      const res = await fetch("/api/xhep/submissions", { method: "POST", body });
      if (!res.ok) throw new Error(String(res.status));
      markSent(cityId);
      setState("sent");
      track("xhep_submission", { city: cityId, photos: photos.length, has_story: story.trim().length > 0 });
    } catch {
      setState("failed");
    }
  }

  return (
    <section className={styles.send} aria-label={t.title}>
      <h3>{t.title}</h3>
      {state === "sent" ? (
        <p className={styles.sent}>{t.sent}</p>
      ) : signedIn === false ? (
        <>
          <p>{t.intro}</p>
          <Link className={styles.primary} href="/hyr?next=/visit%23packs">
            {t.signIn}
          </Link>
        </>
      ) : (
        <>
          <p>{t.intro}</p>
          <label className={styles.consent}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.currentTarget.checked)} />
            <span>{t.consent}</span>
          </label>
          <button type="button" className={styles.primary} onClick={send} disabled={!consent || empty || state === "sending" || signedIn !== true}>
            <Send aria-hidden="true" size={16} />
            {state === "sending" ? t.sending : t.send}
          </button>
          {empty && <p className={styles.note}>{t.nothing}</p>}
          {state === "failed" && (
            <p className={styles.note} role="status">
              {t.failed}
            </p>
          )}
        </>
      )}
    </section>
  );
}
