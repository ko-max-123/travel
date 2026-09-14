const CACHE_NAME = "collection-notebooks-v7";
const APP_SHELL = [
  "./",
  "./index.html",
  "./archive.html",
  "./pokefuta.html",
  "./map.html",
  "./list.html",
  "./region.html",
  "./prefecture.html",
  "./spot.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./assets/css/contents.css",
  "./assets/css/collection.css",
  "./assets/css/style.css",
  "./assets/js/pwa.js",
  "./assets/js/library-data.js",
  "./assets/js/library-db.js",
  "./assets/js/library-app.js",
  "./assets/js/app.js",
  "./assets/js/data.js",
  "./assets/js/official-spots.js",
  "./assets/js/my-collection.js",
  "./assets/images/japan-regions-blank.svg",
  "./assets/icons/app-icon-192.png",
  "./assets/icons/app-icon-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./ichinomiya/index.html",
  "./ichinomiya/map.html",
  "./ichinomiya/list.html",
  "./ichinomiya/region.html",
  "./ichinomiya/province.html",
  "./ichinomiya/assets/css/style.css",
  "./ichinomiya/assets/js/app.js",
  "./ichinomiya/assets/js/data.js",
  "./ichinomiya/assets/js/my-collection.js",
  "./ichinomiya/assets/images/japan-regions-blank.svg",
  "./todofuken/index.html",
  "./todofuken/map.html",
  "./todofuken/region.html",
  "./todofuken/prefecture.html",
  "./todofuken/place.html",
  "./todofuken/assets/css/style.css",
  "./todofuken/assets/js/app.js",
  "./todofuken/assets/js/data.js",
  "./todofuken/assets/js/my-places.js"
].map((path) => new URL(path, self.registration.scope).toString());

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(
        APP_SHELL.map((url) => new Request(url, { cache: "reload" }))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => ["tabi-no-mokuji-", "collection-notebooks-"].some((prefix) => key.startsWith(prefix)) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, useOfflinePage = false) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
    if (cached) return cached;
    if (useOfflinePage) {
      return cache.match(new URL("./offline.html", self.registration.scope).toString());
    }
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;

  event.respondWith(networkFirst(request, request.mode === "navigate"));
});
