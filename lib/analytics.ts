/**
 * GA4 event tracking. Every call is a safe no-op until the reader has accepted
 * analytics cookies (the consent banner in components/analytics/ga.tsx is what
 * actually defines window.gtag), so callers never need to check consent.
 */
type Gtag = (command: string, eventName: string, params?: Record<string, unknown>) => void;

export function track(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag === "function") gtag("event", event, params ?? {});
}
