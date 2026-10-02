"use client";

// "Shto 383 në ekranin kryesor": the guide an iPhone or iPad reader gets in
// place of "Po, ma dërgo". Apple lets a website send notifications only once it
// is on the home screen and opened from there (app/manifest.ts makes 383 open
// as its own app), so without this the 07:00 edition can never reach them.
//
// iPhones have no Albanian interface: Kosovo readers' phones are in English,
// and much of the diaspora's in German, so the menu item is named as it
// actually reads. The Share button's place depends on device and browser, and
// TikTok's and Instagram's in-app browsers cannot install anything — those
// readers are sent to Safari first. iOS before 16.4 cannot do web push at all.

import { useEffect, useRef, useState } from "react";
import { BellRing, X } from "lucide-react";
import { iosInstallContext, type IosInstallContext } from "@/lib/ios-install.mjs";

/** iOS's Share glyph: a square with an arrow out of the top. */
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M8 11H6.5A1.5 1.5 0 0 0 5 12.5v7A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H16" />
    </svg>
  );
}

/** iOS's "Add to Home Screen" glyph: a plus in a rounded square. */
function AddIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

export default function IosInstallGuide() {
  const [ctx, setCtx] = useState<IosInstallContext | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setCtx(iosInstallContext(navigator.userAgent, navigator.maxTouchPoints));
  }, []);

  if (!ctx) return null;

  if (!ctx.supported) {
    return (
      <p className="perty-end-push">
        <BellRing size={16} strokeWidth={2.4} aria-hidden="true" />
        <span>
          Edicioni i mëngjesit në iPhone kërkon iOS 16.4 ose më të ri. Përditësoje te Settings → General → Software
          Update.
        </span>
      </p>
    );
  }

  const inApp = ctx.browser === "other";
  const steps = [
    ...(inApp
      ? [
          {
            title: "Hape 383 në Safari",
            body: "Ky është shfletuesi i një aplikacioni (TikTok, Instagram…), dhe ai s’lejon ta shtosh. Prek «…» ose ikonën e shfletuesit dhe zgjidh «Open in Safari».",
            icon: null,
          },
        ]
      : []),
    {
      title: "Prek butonin Ndaj",
      body: `Gjendet ${ctx.sharePlace}.`,
      icon: <ShareIcon />,
    },
    {
      title: "Zgjidh «Add to Home Screen»",
      body: "Në gjermanisht: «Zum Home-Bildschirm». Nëse s’e sheh, lëviz pak poshtë në listë. Pastaj prek «Add».",
      icon: <AddIcon />,
    },
    {
      title: "Hape 383 nga ikona e re",
      body: "Prej aty, në fund të Për ty, prek «Po, ma dërgo» dhe lejo njoftimet.",
      icon: (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/icon-192.png" alt="" width={36} height={36} className="ios-guide-app" />
      ),
    },
  ];

  return (
    <>
      <p className="perty-end-push">
        <BellRing size={16} strokeWidth={2.4} aria-hidden="true" />
        <span>Do edicionin tënd çdo mëngjes në 07:00? Në {ctx.device === "ipad" ? "iPad" : "iPhone"} duhet ta shtosh 383 në ekranin kryesor.</span>
        <button type="button" className="perty-btn perty-btn--primary perty-end-push-btn" onClick={() => dialog.current?.showModal()}>
          Më trego si
        </button>
      </p>

      <dialog
        ref={dialog}
        className="ios-guide"
        aria-labelledby="ios-guide-title"
        onClick={(e) => {
          // A tap on the backdrop closes it.
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="ios-guide-panel">
          <header>
            <h2 id="ios-guide-title">Shto 383 në ekranin kryesor</h2>
            <button type="button" className="perty-icon-btn" onClick={() => dialog.current?.close()} aria-label="Mbyll">
              <X size={20} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </header>
          <p className="ios-guide-lede">
            {steps.length} hapa, një herë. Pastaj 383 hapet si aplikacion dhe edicioni yt vjen çdo mëngjes në 07:00.
          </p>
          <ol>
            {steps.map((step, i) => (
              <li key={step.title}>
                <span className="ios-guide-n" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="ios-guide-text">
                  <strong>{step.title}</strong>
                  <span>{step.body}</span>
                </span>
                {step.icon && <span className="ios-guide-icon">{step.icon}</span>}
              </li>
            ))}
          </ol>
          <button type="button" className="perty-btn perty-btn--primary ios-guide-done" onClick={() => dialog.current?.close()}>
            E kuptova
          </button>
        </div>
      </dialog>
    </>
  );
}
