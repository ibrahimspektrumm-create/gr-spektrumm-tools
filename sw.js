// ============================================================
// GR Spektrumm Tools — Service Worker (App Shell cache)
// Network-first for the shell so users always get the latest
// deployed version instantly; falls back to cache only when
// offline. Firestore/Storage/Auth calls always go to network.
// ============================================================
const CACHE_VERSION = "v2"; // bump this on every deploy that changes shell files
const CACHE_NAME = `gr-spektrumm-shell-${CACHE_VERSION}`;
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/src/styles/theme.css",
  "/src/main.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never touch Firebase / external API calls — always fresh from network.
  if (
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("aladhan.com") ||
    event.request.method !== "GET"
  ) {
    return;
  }

  // Network-first: always try to fetch the latest file first so a new
  // deploy is visible immediately. Only fall back to the cached copy
  // when the network request fails (offline).
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match("/index.html"))
      )
  );
});
