/* 383 Tregu service worker: league alerts only.
   Pushes arrive empty (no payload to encrypt); on each one this asks the site
   for the newest unseen league event, with the user's own cookies, and shows
   it. Tapping the notification opens that league. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil(
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
