/* 词听 offline cache */
const CACHE = "citing-v1.5.6";
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
  "./data/word-index.json",
  "./data/dict.json",
  "./data/books/gaokao.json",
  "./data/books/ielts.json",
  "./data/books/cet4.json",
  "./data/books/kaoyan.json",
  "./vendor/pdf/pdf.min.mjs",
  "./vendor/pdf/pdf.worker.min.mjs",
];

let dataPromise = null;

async function fetchWithTimeout(url, timeoutMs) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await fetch(new Request(url, {
      cache: "reload",
      signal: controller ? controller.signal : undefined,
    }));
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function cacheCore() {
  const cache = await caches.open(CACHE);
  // Core files are small. Cache them independently so one missing icon can
  // never leave Safari retrying the whole service-worker install forever.
  await Promise.all(CORE.map(async (url) => {
    try {
      const response = await fetchWithTimeout(url, 15000);
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      await cache.put(url, response);
    } catch (error) {
      console.warn("Core precache failed", url, error);
    }
  }));
}

function notifyClients(message) {
  return self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
    for (const client of clients) {
      try { client.postMessage(message); } catch (error) { /* ignore */ }
    }
  });
}

async function cacheData() {
  const cache = await caches.open(CACHE);
  let done = 0;
  for (const url of DATA) {
    const cached = await cache.match(url);
    if (!cached) {
      const response = await fetchWithTimeout(url, 30000);
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      await cache.put(url, response);
    }
    done += 1;
    await notifyClients({ type: "OFFLINE_PROGRESS", done, total: DATA.length });
  }
  await notifyClients({ type: "OFFLINE_READY", total: DATA.length });
  return done;
}

function ensureDataCached() {
  if (!dataPromise) {
    dataPromise = cacheData().catch((error) => {
      console.warn("Data precache failed", error);
      notifyClients({ type: "OFFLINE_ERROR", message: String(error && error.message || error) });
      throw error;
    }).finally(() => {
      dataPromise = null;
    });
  }
  return dataPromise;
}

async function offlineStatus() {
  const cache = await caches.open(CACHE);
  let done = 0;
  for (const url of DATA) {
    if (await cache.match(url)) done += 1;
  }
  return { type: "OFFLINE_STATUS", done, total: DATA.length, ready: done === DATA.length };
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await cacheCore();
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
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (data.type === "CACHE_DATA") {
    event.waitUntil(ensureDataCached().catch(() => {}));
    return;
  }
  if (data.type === "CACHE_STATUS") {
    const reply = event.source || null;
    event.waitUntil(offlineStatus().then((status) => {
      if (reply) reply.postMessage(status);
    }));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone()).catch(() => {});
        return response;
      }
      // Some offline proxies / captive portals return 5xx instead of throwing.
      // For page navigations, prefer the cached app shell over an error page.
      if (request.mode === "navigate") {
        const fallback = (await caches.match("./index.html")) || (await caches.match("./"));
        if (fallback) return fallback;
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
