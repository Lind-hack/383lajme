import { createClient } from "@/lib/supabase/client";

/** Can this browser do push at all? (iPhone only from a home-screen app.) */
export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function keyBytes(base64url: string) {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

/**
 * Ask for permission, register the league-alert worker and save the
 * subscription for the signed-in user. Must run from a tap (browsers refuse
 * permission prompts that are not user-initiated).
 */
export async function enableLeaguePush(): Promise<"on" | "denied" | "unsupported" | "error"> {
  if (!pushSupported()) return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";
    const registration = await navigator.serviceWorker.register("/tregu-sw.js");
    await navigator.serviceWorker.ready;
    const { key } = await fetch("/api/tregu/push-key").then((response) => response.json());
    if (!key) return "error";
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
    const { error } = await createClient().rpc("tregu_save_push_subscription", { p_endpoint: subscription.endpoint });
    return error ? "error" : "on";
  } catch {
    return "error";
  }
}
