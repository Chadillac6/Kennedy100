// Bump VERSION on every release so iPads pick up the new files on their next launch.
// The speech model has its own cache so app updates don't re-download 40 MB.
const CACHE_PREFIX = "kennedy100-";
const VERSION = `${CACHE_PREFIX}v2`;
const MODEL_CACHE = `${CACHE_PREFIX}model-small-en-us-0.15`;
const MODEL_URL = "model/vosk-model-small-en-us-0.15.tar.gz";
const ASSETS = [
  "./",
  "index.html",
  "style.css",
  "game.js",
  "speech.js",
  "monkey.js",
  "vendor/vosk.js",
  "favicon.svg",
  "manifest.webmanifest",
  "fonts/baloo2-latin.woff2",
  "fonts/andika-bold-latin.woff2",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith(CACHE_PREFIX) && k !== VERSION && k !== MODEL_CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.endsWith(MODEL_URL)) {
    event.respondWith(caches.open(MODEL_CACHE).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) event.waitUntil(c.put(req, res.clone()));
      return res;
    }));
    return;
  }

  // Pages: network first so updates land, cached copy when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put("./", copy)); return res; })
        .catch(() => caches.match("./", { cacheName: VERSION }).then((r) => r || caches.match(req))),
    );
    return;
  }

  event.respondWith(
    caches.match(req, { cacheName: VERSION, ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && url.pathname.startsWith(new URL("./", self.registration.scope).pathname)) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
