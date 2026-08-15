// Invoice Studio Pro — Service Worker
// Bump this version string whenever index.html (or any cached asset) changes,
// so returning users automatically pick up the new version.
const VERSION = "v3.8.0";
const SHELL_CACHE = `invoice-studio-shell-${VERSION}`;
const RUNTIME_CACHE = `invoice-studio-runtime-${VERSION}`;

// Everything needed to run the app with zero network connection.
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/base.css",
  "./css/invoice.css",
  "./css/templates.css",
  "./css/responsive.css",
  "./css/print.css",
  "./js/dom.js",
  "./js/state.js",
  "./js/format.js",
  "./js/calc.js",
  "./js/toast.js",
  "./js/accent.js",
  "./js/preview.js",
  "./js/columns.js",
  "./js/items.js",
  "./js/toggles.js",
  "./js/persistence.js",
  "./js/invoiceData.js",
  "./js/library.js",
  "./js/layout.js",
  "./js/importSheet.js",
  "./js/print.js",
  "./js/install.js",
  "./js/main.js",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-128.png",
  "./icons/icon-144.png",
  "./icons/icon-152.png",
  "./icons/icon-192.png",
  "./icons/icon-384.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // App shell (same-origin): network-first, so a returning visitor always
  // gets the latest files whenever there's a connection — falling back to
  // the cached copy only when actually offline. (Previously this was
  // cache-first, which is faster but meant updates only took effect after a
  // person reloaded twice in a row for the new service worker to take over;
  // in practice that was a repeated source of "I'm still seeing the old
  // version" confusion, so trading a little bit of load speed for always
  // being current is the right call here.)
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // Third-party assets (e.g. the xlsx library, loaded only when importing a
  // spreadsheet): stale-while-revalidate, so it still works offline after
  // the first successful use, but stays fresh whenever online.
  event.respondWith(
    caches.open(RUNTIME_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
