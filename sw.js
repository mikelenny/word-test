/* 词听 offline cache */
const CACHE = "citing-v2.0.15";
const CORE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/morph.js",
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
    // claim 之前先记下「原本就被旧版本控制的页面」：只有它们需要刷新。
    // 第一次安装时这里是空的，不会把用户刚打开的页面刷掉。
    const controlled = await self.clients.matchAll({ type: "window", includeUncontrolled: false });
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
    for (const client of controlled) {
      try {
        client.postMessage({ type: "APP_UPDATED" });
        // Safari 没有 navigate()，不支持就只发消息，让页面自己处理。
        if (typeof client.navigate === "function") await client.navigate(client.url);
      } catch (error) {
        // 页面已经关掉或不允许导航，忽略即可。
      }
    }
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

  // 页面导航走「网络优先」：在线时总能拿到最新 HTML，弱网 2.5 秒拿不到就用缓存里的外壳。
  // 静态资源仍是缓存优先，版本由 CACHE 名字控制。
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetchWithTimeout(request, 2500);
        if (response && response.ok) {
          cache.put("./index.html", response.clone()).catch(() => {});
          return response;
        }
      } catch (error) {
        // 离线或网络太慢：落到下面的缓存里。
      }
      return (await cache.match(request))
        || (await cache.match("./index.html"))
        || (await cache.match("./"))
        || Response.error();
    })());
    return;
  }

  event.respondWith((async () => {
    let cached = await caches.match(request);
    if (!cached) {
      // 页面里的资源带 ?v= 版本串，预缓存的是不带串的地址，
      // 离线时忽略查询串再找一次，别让首屏加载失败。
      cached = await caches.match(new URL(url.pathname, url.origin).href);
    }
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone()).catch(() => {});
        return response;
      }
      return response;
    } catch (error) {
      return Response.error();
    }
  })());
});
