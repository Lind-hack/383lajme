"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Consent-gated Google Analytics.
 *
 * - Nothing loads until the reader explicitly accepts (Kosovo's data protection
 *   law, 06/L-082, is GDPR-aligned; the privacy policy promises opt-in stats).
 * - The choice lives in localStorage and survives across sessions; denying
 *   means no Google script ever touches the browser.
 * - App Router navigations are client-side, so page views after the first load
 *   are sent manually — gtag("config") only covers the initial HTML request.
 */

const CONSENT_KEY = "383_consent";
const CONSENT_EVENT = "383:consent";
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

type Consent = "granted" | "denied" | null;

function readConsent(): Consent {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    // Storage blocked: stay silent rather than nag with a banner we can't persist.
    return "denied";
  }
}

export default function Ga() {
  const [consent, setConsent] = useState<Consent>("denied");
  const pathname = usePathname();
  const firstPath = useRef(true);

  useEffect(() => {
    setConsent(readConsent());
    const sync = () => setConsent(readConsent());
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  useEffect(() => {
    // Skip the first path: gtag("config") already reported this page view.
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === "function") {
      gtag("event", "page_view", {
        page_path: window.location.pathname + window.location.search,
        page_title: document.title,
      });
    }
  }, [pathname]);

  const decide = (value: "granted" | "denied") => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      /* Storage blocked: the banner simply reappears next visit. */
    }
    window.dispatchEvent(new Event(CONSENT_EVENT));
  };

  // The admin panel is an internal tool, not a page with readers. Measuring it
  // pollutes the site's analytics with the operator's own traffic, and asking
  // them to consent to that sits a dismissable card over the article list they
  // came to work through. Placed after every hook so the order never varies.
  if (pathname?.startsWith("/admin")) return null;

  return (
    <>
      {consent === "granted" && GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","${GA_ID}",{anonymize_ip:true});`}
          </Script>
        </>
      )}

      {consent === null && (
        <div
          role="region"
          aria-label="Cilësimet e cookies"
          className="fixed inset-x-0 bottom-0 z-[90] px-4 pb-4"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-border bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.12)] sm:flex-row sm:items-center sm:gap-5">
            <p className="flex-1 text-[0.85rem] leading-[1.6] text-[#565656]">
              <span className="font-bold text-ink">Cookies për statistika.</span> Përdorim Google
              Analytics për të kuptuar çfarë lexohet — pa reklama dhe pa të ndjekur nëpër faqe të
              tjera; adresa IP anonimizohet. Zgjedhja jote ruhet vetëm në shfletuesin tënd.{" "}
              <a
                href="/privatesia#cookies"
                className="font-semibold text-orange underline underline-offset-2"
              >
                Mëso më shumë
              </a>
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => decide("denied")}
                className="rounded-full border border-border bg-white px-4 py-2 text-[0.8rem] font-bold text-ink transition-colors hover:bg-cream"
              >
                Vetëm thelbësore
              </button>
              <button
                type="button"
                onClick={() => decide("granted")}
                className="rounded-full bg-orange px-5 py-2 text-[0.8rem] font-bold text-white transition-opacity hover:opacity-90"
              >
                Pranoj
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
