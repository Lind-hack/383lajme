// Turning Për ty's 07:00 morning push on and off, in the browser.
//
// It shares the site's one service worker (public/tregu-sw.js) and its push
// subscription with Tregu's league alerts, so turning the morning off removes
// only this browser's address from the morning list — it never unsubscribes
// the browser, which would silence the league alerts too.

import { keyBytes, pushSupported } from "@/lib/tregu-push-client";

const FLAG = "383:morning-push";

export type MorningPushState = "on" | "off" | "unsupported" | "ios-install" | "blocked";

/** An iPhone or iPad running 383 in the browser rather than from the home screen. */
function iosOutsideHomeScreen() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export function morningPushState(): MorningPushState {
  if (typeof window === "undefined") return "unsupported";
  if (!pushSupported()) return iosOutsideHomeScreen() ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  try {
    return localStorage.getItem(FLAG) === "1" && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "off";
  }
}

/** Must run from a tap: browsers refuse permission prompts that are not. */
export async function enableMorningPush(): Promise<MorningPushState | "error"> {
  if (!pushSupported()) return morningPushState();
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
    const registration = await navigator.serviceWorker.register("/tregu-sw.js");
    await navigator.serviceWorker.ready;
    const { key } = await fetch("/api/tregu/push-key").then((response) => response.json());
    if (!key) return "error";
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
    const response = await fetch("/api/per-ty/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    if (!response.ok) return "error";
    try {
      localStorage.setItem(FLAG, "1");
    } catch {
      // The push still comes; the button just forgets it is on.
    }
    return "on";
  } catch {
    return "error";
  }
}

export async function disableMorningPush(): Promise<MorningPushState | "error"> {
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      const response = await fetch("/api/per-ty/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      if (!response.ok) return "error";
    }
    try {
      localStorage.removeItem(FLAG);
    } catch {
      // Nothing to forget where storage is blocked.
    }
    return "off";
  } catch {
    return "error";
  }
}
