/* 词听 offline cache */
const CACHE = "citing-v1.2.0";
const CORE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-64.png",
];
const DATA = [
  "./data/meta.json",
  "./data/dict.json",
  "./data/books/gaokao.json",
  "./data/books/ielts.json",
  "./data/books/cet4.json",
  "./data/books/kaoyan.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Precache atomically: if any required file fails, the install fails and
    // the browser retries next time instead of claiming a partial offline app.
    await Promise.all([...CORE, ...DATA].map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: "reload" }));
      } catch (error) {
        console.warn("Precache failed", url, error);
        throw error;
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      if (request.mode === "navigate") {
        return (await caches.match("./index.html")) || (await caches.match("./")) || Response.error();
      }
      return Response.error();
    }
  })());
});
