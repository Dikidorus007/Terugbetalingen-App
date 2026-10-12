const CACHE_NAME = "terugbetalingen-shell-v1";
const APP_SHELL = ["./", "./index.html", "./manifest.webmanifest", "./favicon.ico"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// A foreground app can display a local notification after Supabase Realtime detects
// a new row. For background push, a server must send a Web Push message to this handler.
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { payload = { body: event.data ? event.data.text() : "" }; }

  const title = payload.title || "Nieuwe kost ontvangen";
  const options = {
    body: payload.body || "Er is een nieuwe kost toegevoegd.",
    icon: "./favicon.ico",
    badge: "./favicon.ico",
    data: { url: payload.url || "./", expenseId: payload.expenseId || null },
    tag: payload.tag || (payload.expenseId ? "expense-" + payload.expenseId : "new-expense")
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const destination = new URL((event.notification.data && event.notification.data.url) || "./", self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) return client.focus();
      }
      return clients.openWindow(destination);
    })
  );
});
