/* 383's service worker: Tregu league alerts and Për ty's morning edition.
   There can be only one worker for the site, so both live here.
   Pushes arrive empty (no payload to encrypt). On each one this first asks
   whether this browser was just sent its 07:00 morning edition (by its own
   push address, nothing else); if so it shows that. Otherwise it asks for the
   newest unseen league event, with the user's own cookies, and shows it, as
   before. Tapping the notification opens Për ty or that league. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function morningEdition() {
  return self.registration.pushManager
    .getSubscription()
    .then((sub) =>
      sub
        ? fetch("/api/per-ty/push/latest?endpoint=" + encodeURIComponent(sub.endpoint), { cache: "no-store" })
        : null
    )
    .then((response) => (response && response.status === 200 ? response.json() : null))
    .catch(() => null);
}

function leagueAlert() {
  return (
    fetch("/api/tregu/league-events/latest", { credentials: "include", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((note) =>
        self.registration.showNotification((note && note.title) || "383 Ligat", {
          body: (note && note.body) || "Diçka ndryshoi në ligat e tua.",
          icon: "/logo-512.png",
          badge: "/logo-512.png",
          tag: "383-ligat",
          renotify: true,
          data: { url: (note && note.url) || "/tregu" },
        })
      )
  );
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    morningEdition().then((note) =>
      note
        ? self.registration.showNotification(note.title, {
            body: note.body,
            icon: "/logo-512.png",
            badge: "/logo-512.png",
            tag: "383-edicioni",
            data: { url: note.url || "/per-ty" },
          })
        : leagueAlert()
    )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/tregu", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
