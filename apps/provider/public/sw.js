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
  // Online requests (and their redirects) go straight to the network untouched; only an offline
  // page load is answered, with the cached offline page.
  if (event.request.mode !== "navigate" || event.request.method !== "GET") return;
  if (self.navigator.onLine) return;
  event.respondWith(caches.match(OFFLINE));
});
