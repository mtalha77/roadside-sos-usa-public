// Provider portal service worker (RSOS-051): keeps an offline page, and lets the app show an
// update prompt when a new version is waiting. Requests are always fetched fresh (live data).
const CACHE = "rsos-portal-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
});
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
