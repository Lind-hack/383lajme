"use client";

// "Po, ma dërgo": the line in "Kaq për sot" that turns the 07:00 edition push on.
// It speaks of the edition arriving, not of waking anyone: nobody wants an alarm.
// It sits at the end of the edition on purpose — the moment a reader has just
// finished is the moment "and tomorrow at seven" makes sense.

import { useEffect, useState } from "react";
import { BellRing, Check } from "lucide-react";
import {
  disableMorningPush,
  enableMorningPush,
  morningPushState,
  type MorningPushState,
} from "@/lib/perty-push-client";
import IosInstallGuide from "./ios-install-guide";

export default function MorningPush() {
  const [state, setState] = useState<MorningPushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setState(morningPushState());
  }, []);

  async function change(turnOn: boolean) {
    setBusy(true);
    setFailed(false);
    const next = turnOn ? await enableMorningPush() : await disableMorningPush();
    if (next === "error") setFailed(true);
    else setState(next);
    setBusy(false);
  }

  if (state === null || state === "unsupported") return null;

  // An iPhone or iPad outside the home screen: Apple allows no push there, so
  // the reader gets the steps to install 383 instead of a button that cannot work.
  if (state === "ios-install") return <IosInstallGuide />;

  if (state === "blocked") {
    return (
      <p className="perty-end-push">
        <BellRing size={16} strokeWidth={2.4} aria-hidden="true" />
        <span>Njoftimet për 383 janë të bllokuara në këtë shfletues; lejoji te cilësimet që ta marrësh edicionin në 07:00.</span>
      </p>
    );
  }

  return (
    <p className="perty-end-push" aria-live="polite">
      {state === "on" ? (
        <>
          <Check size={16} strokeWidth={2.8} aria-hidden="true" />
          <span>Edicioni yt vjen çdo mëngjes në 07:00.</span>
          <button type="button" className="perty-text-btn" onClick={() => change(false)} disabled={busy}>
            Ndalo
          </button>
        </>
      ) : (
        <>
          <BellRing size={16} strokeWidth={2.4} aria-hidden="true" />
          <span>Do edicionin tënd çdo mëngjes në 07:00?</span>
          <button type="button" className="perty-btn perty-btn--primary perty-end-push-btn" onClick={() => change(true)} disabled={busy}>
            {busy ? "Po e aktivizoj…" : "Po, ma dërgo"}
          </button>
        </>
      )}
      {failed && <span className="perty-end-push-error">Nuk u arrit. Provo sërish pas pak.</span>}
    </p>
  );
}
