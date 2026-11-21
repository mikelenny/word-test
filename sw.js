/* 词听 offline cache */
// 外壳随版本换名（小文件，装新版本时重新拉一次没问题）。
const CACHE = "citing-v2.0.16";
// 词库数据单独放固定名字的缓存：升级外壳时不会删掉它，也就不必每次重新下载 dict.json。
// 只有数据文件本身的结构/内容改版时才手动把 v1 改成 v2。
const DATA_CACHE = "citing-data-v1";
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
  const cache = await caches.open(DATA_CACHE);
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
  const cache = await caches.open(DATA_CACHE);
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

// 老版本把词库也存在按版本命名的缓存里。升级时先搬进固定名的数据缓存，
// 这样老用户不用重新下载一遍 dict.json / books。
async function migrateLegacyData(keys) {
  const target = await caches.open(DATA_CACHE);
  for (const key of keys) {
    if (key === CACHE || key === DATA_CACHE) continue;
    const old = await caches.open(key);
    await Promise.all(DATA.map(async (url) => {
      if (await target.match(url)) return;
      try {
        const response = await old.match(url);
        if (response) await target.put(url, response.clone());
      } catch (error) { /* 单个文件搬不动就算了，后台会补 */ }
    }));
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // claim 之前先记下「原本就被旧版本控制的页面」：只有它们需要刷新。
    // 第一次安装时这里是空的，不会把用户刚打开的页面刷掉。
    const controlled = await self.clients.matchAll({ type: "window", includeUncontrolled: false });
    const keys = await caches.keys();
    await migrateLegacyData(keys);
    const keep = [CACHE, DATA_CACHE];
    await Promise.all(keys.filter((key) => !keep.includes(key)).map((key) => caches.delete(key)));
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

  // 只有应用外壳本身（根路径 / index.html）走缓存优先；别的页面照常走网络，
  // 否则任何同源导航都会被错误地替换成缓存里的 index.html。
  const scopePath = new URL("./", self.location.href).pathname;
  const isShell = url.pathname === scopePath || url.pathname === scopePath + "index.html";
  if (request.mode === "navigate" && isShell) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = (await cache.match(request))
        || (await cache.match("./index.html"))
        || (await cache.match("./"));
      if (cached) {
        // 不 await：把刷新放到后台，首屏立刻返回缓存。
        fetchWithTimeout(request, 6000).then((response) => {
          if (!response || !response.ok) return;
          const forRequest = response.clone();
          cache.put(request, forRequest).catch(() => {});
          cache.put("./index.html", response.clone()).catch(() => {});
        }).catch(() => {});
        return cached;
      }
      // 首次打开还没有缓存：只能等网络，但顺手把外壳存下来。
      try {
        const response = await fetchWithTimeout(request, 8000);
        if (response && response.ok) {
          const forRequest = response.clone();
          cache.put(request, forRequest).catch(() => {});
          cache.put("./index.html", response.clone()).catch(() => {});
          return response;
        }
      } catch (error) { /* 落到下面尝试旧缓存 */ }
      return Response.error();
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
        // 按需抓到的词库写进固定数据缓存；外壳写进版本缓存。
        const isData = DATA.some((path) => new URL(path, self.location.href).pathname === url.pathname);
        const target = await caches.open(isData ? DATA_CACHE : CACHE);
        target.put(request, response.clone()).catch(() => {});
        return response;
      }
      return response;
    } catch (error) {
      return Response.error();
    }
  })());
});
