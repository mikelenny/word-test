/* 词听 · offline vocabulary dictation */
(() => {
  "use strict";

  const APP_VERSION = "1.2.0";
  const STORAGE_KEY = "citing.state.v1";
  const DAY = 24 * 60 * 60 * 1000;
  const REVIEW_DAYS = [0, 1, 2, 4, 7, 15, 30];
  const GENERIC_MEANING_TOKENS = new Set([
    "一个", "一种", "一些", "一样", "一起", "一直", "一定", "一般",
    "这个", "那个", "这些", "那些", "自己", "我们", "他们", "你们",
    "东西", "事情", "地方", "时候", "表示", "进行", "使得", "关于",
  ]);

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const ICONS = {
    gear: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21h-4v-.05A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.05A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.05A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21v4h-.05a1.7 1.7 0 0 0-1.55 1Z"/></svg>`,
    flame: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.4 2.4c.4 3.3-1.8 4.5-3.2 6.4-1 1.4-1.6 2.8-1.6 4.4A4.4 4.4 0 0 0 12 17.6a4.4 4.4 0 0 0 4.4-4.4c0-1.8-.8-3.4-2.2-4.9.1 1.5-.5 2.6-1.5 3.2.3-3.5-.6-6.5-.3-9.1Z"/><path d="M12 21.6a7.6 7.6 0 0 0 7.6-7.6c0-2.7-1.2-5.2-3.1-7.3.2 2.1-.3 3.6-1.6 4.8.4-2.5-.1-4.8-.9-6.7" opacity=".35"/></svg>`,
    speaker: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.4l4.3 3.4V6.1L7.4 9.5H4Z"/><path d="M15.2 8.6a5 5 0 0 1 0 6.8M17.8 6a8.4 8.4 0 0 1 0 12"/></svg>`,
    pencil: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.4-10.4a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z"/><path d="m13.8 7.4 3 3M4.8 16.2l3 3"/></svg>`,
    list: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.2 5.8 5 6.6l1.4-1.6M4.2 11.8l.8.8 1.4-1.6M4.2 17.8l.8.8 1.4-1.6"/></svg>`,
    arrow: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>`,
    check: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.4 4.4L19 7.3"/></svg>`,
    close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M6.5 7l.8 13h9.4l.8-13M10 11v5M14 11v5"/></svg>`,
    download: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/></svg>`,
    upload: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 20h14"/></svg>`,
    spark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4L4.5 10.8 10.2 9 12 3.5Z"/><path d="m18.5 16 .7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z"/></svg>`,
    book: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h9a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3V4.5Z"/><path d="M8 20a3 3 0 0 1 3-3h6M9 8h5"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 8.5A8 8 0 1 0 20 14"/><path d="M19.5 4v4.5H15"/></svg>`,
    phone: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2.2"/><path d="M10.5 18h3"/></svg>`,
    eye: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 12s3.3-6 9.2-6 9.2 6 9.2 6-3.3 6-9.2 6-9.2-6-9.2-6Z"/><circle cx="12" cy="12" r="2.6"/></svg>`,
  };

  const MODE_LABEL = {
    zh2en: "看中文写英文",
    en2zh: "看英文选中文",
  };

  const SPELLING_PAIRS = [
    ["colour", "color"], ["favourite", "favorite"], ["honour", "honor"],
    ["labour", "labor"], ["neighbour", "neighbor"], ["behaviour", "behavior"],
    ["centre", "center"], ["metre", "meter"], ["theatre", "theater"],
    ["realise", "realize"], ["organise", "organize"], ["recognise", "recognize"],
    ["apologise", "apologize"], ["analyse", "analyze"], ["practise", "practice"],
    ["licence", "license"], ["defence", "defense"], ["offence", "offense"],
    ["travelling", "traveling"], ["cancelled", "canceled"], ["programme", "program"],
    ["catalogue", "catalog"], ["dialogue", "dialog"], ["grey", "gray"],
    ["jewellery", "jewelry"], ["aluminium", "aluminum"], ["mum", "mom"],
  ];

  const IRREGULAR = {
    am: "be", is: "be", are: "be", was: "be", were: "be", been: "be", being: "be",
    has: "have", had: "have", having: "have", does: "do", did: "do", done: "do",
    went: "go", gone: "go", goes: "go", saw: "see", seen: "see", made: "make",
    took: "take", taken: "take", came: "come", got: "get", gotten: "get",
    gave: "give", given: "give", found: "find", thought: "think", taught: "teach",
    learnt: "learn", learned: "learn", bought: "buy", brought: "bring",
    began: "begin", begun: "begin", ran: "run", said: "say", told: "tell",
    knew: "know", known: "know", grew: "grow", grown: "grow", felt: "feel",
    left: "leave", met: "meet", read: "read", wrote: "write", written: "write",
    spoke: "speak", spoken: "speak", drank: "drink", drunk: "drink",
    ate: "eat", eaten: "eat", fell: "fall", fallen: "fall", flew: "fly",
    flown: "fly", forgot: "forget", forgotten: "forget", chose: "choose",
    chosen: "choose", drove: "drive", driven: "drive", rode: "ride",
    ridden: "ride", swam: "swim", swum: "swim", sang: "sing", sung: "sing",
    sat: "sit", stood: "stand", understood: "understand", wore: "wear",
    worn: "wear", won: "win", lost: "lose", paid: "pay", sold: "sell",
    sent: "send", spent: "spend", built: "build", caught: "catch",
    fought: "fight", heard: "hear", held: "hold", kept: "keep", led: "lead",
    lay: "lie", lain: "lie", meant: "mean", put: "put", shot: "shoot",
    showed: "show", shown: "show", shut: "shut", slept: "sleep",
    threw: "throw", thrown: "throw", woke: "wake", woken: "wake",
    children: "child", men: "man", women: "woman", feet: "foot",
    teeth: "tooth", mice: "mouse", geese: "goose", people: "person",
    better: "good", best: "good", worse: "bad", worst: "bad",
    more: "many", most: "many", less: "little", least: "little",
  };

  const VARIANTS = new Map();
  for (const [a, b] of SPELLING_PAIRS) {
    VARIANTS.set(a, b);
    VARIANTS.set(b, a);
  }

  const state = {
    meta: null,
    books: {},
    dict: null,
    dictPromise: null,
  };

  const ui = {
    tab: "home",
    session: null,
    sheetOpen: false,
    sheetTimer: 0,
    lookupToken: 0,
    deferredPrompt: null,
    swReady: false,
    sentenceSeed: 0,
    lastFocus: null,
  };

  let store = loadStore();

  /* ---------------- utilities ---------------- */
  function esc(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escAttr(value) {
    return esc(value).replaceAll("`", "&#96;");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function dateKey(offset = 0) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function todayKey() {
    return dateKey(0);
  }

  function weekdayCN(date = new Date()) {
    return "日一二三四五六"[date.getDay()];
  }

  function dateLabel(date = new Date()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 周${weekdayCN(date)}`;
  }

  function formatWhen(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((today - target) / DAY);
    const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    if (diff === 0) return `今天 ${time}`;
    if (diff === 1) return `昨天 ${time}`;
    if (diff > 1 && diff < 7) return `${diff} 天前`;
    return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`;
  }

  function formatDuration(seconds) {
    const s = Math.max(0, Math.round(seconds));
    if (s < 60) return `${s} 秒`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (r === 0) return `${m} 分钟`;
    return `${m} 分 ${r} 秒`;
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function meaningTokens(meaning) {
    const text = String(meaning || "")
      .replace(/\[[^\]]*\]/g, "")
      .replace(/^(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|int|aux|abbr)\.\s*/i, "");
    const tokens = [];
    for (let part of text.split(/[；;，,、/|（）()\s]+/)) {
      part = part.replace(/[^\u4e00-\u9fff]/g, "");
      for (const suffix of ["某人", "某物", "某地", "某时", "的", "地", "得", "了", "着", "过", "等"]) {
        if (part.length > suffix.length + 1 && part.endsWith(suffix)) {
          part = part.slice(0, -suffix.length);
          break;
        }
      }
      if (part.length >= 2 && !GENERIC_MEANING_TOKENS.has(part)) tokens.push(part);
    }
    return tokens;
  }

  // 有上限的编辑距离：超过 max 时提前结束，避免为几千个词做完整矩阵。
  function editDistanceAtMost(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        const value = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
        current.push(value);
        if (value < rowMin) rowMin = value;
      }
      if (rowMin > max) return max + 1;
      previous = current;
    }
    return previous[b.length];
  }

  function sharesChunk(a, b, size = 3) {
    if (a.length < size || b.length < size) return false;
    for (let i = 0; i <= a.length - size; i += 1) {
      if (b.includes(a.slice(i, i + size))) return true;
    }
    return false;
  }

  function prewarmRelations(book) {
    if (!book || book._relations || store.settings.order !== "random") return;
    const run = () => {
      if (book === currentBook() && store.settings.order === "random") relationMapFor(book);
    };
    if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 2500 });
    else window.setTimeout(run, 1200);
  }

  // 相近词关系图：中文释义重合 + 拼写只差 1–2 个字母。
  // 只保留每个词最强的几个伙伴，避免同义词连成一大团。
  function relationMapFor(book) {
    if (book._relations) return book._relations;
    const scores = new Map();
    const addPair = (a, b, points) => {
      if (!a || !b || a === b) return;
      const key = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
      scores.set(key, (scores.get(key) || 0) + points);
    };

    const tokenIndex = new Map();
    for (const entry of book.words) {
      for (const token of meaningTokens(entry.m)) {
        if (!tokenIndex.has(token)) tokenIndex.set(token, []);
        const bucket = tokenIndex.get(token);
        if (bucket.length < 80) bucket.push(entry.w);
      }
    }
    for (const [token, bucket] of tokenIndex) {
      if (bucket.length < 2) continue;
      const weight = token.length >= 4 ? 7 : token.length === 3 ? 6 : bucket.length <= 15 ? 5 : 4;
      for (let i = 0; i < bucket.length; i += 1) {
        for (let j = i + 1; j < bucket.length; j += 1) addPair(bucket[i], bucket[j], weight);
      }
    }

    const spelling = book.words
      .map((entry) => ({ word: entry.w, plain: entry.w.toLowerCase().replace(/[^a-z]/g, "") }))
      .filter((item) => item.plain.length >= 4);
    const buckets = new Map();
    for (const item of spelling) {
      const keys = [`^${item.plain[0]}`];
      if (item.plain.length >= 5) keys.push(`$${item.plain.slice(-4)}`);
      for (const key of keys) {
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(item);
      }
    }
    const checked = new Set();
    for (const bucket of buckets.values()) {
      for (let i = 0; i < bucket.length; i += 1) {
        for (let j = i + 1; j < bucket.length; j += 1) {
          const a = bucket[i];
          const b = bucket[j];
          if (Math.abs(a.plain.length - b.plain.length) > 2) continue;
          const pairKey = a.word < b.word ? `${a.word}\u0000${b.word}` : `${b.word}\u0000${a.word}`;
          if (checked.has(pairKey)) continue;
          checked.add(pairKey);
          const distance = editDistanceAtMost(a.plain, b.plain, 2);
          if (distance === 2 && !sharesChunk(a.plain, b.plain, 3)) continue;
          if (distance >= 1 && distance <= 2) addPair(a.word, b.word, distance === 1 ? 9 : 6);
        }
      }
    }

    const partners = new Map();
    for (const [key, score] of scores) {
      if (score < 4) continue;
      const split = key.indexOf("\u0000");
      const a = key.slice(0, split);
      const b = key.slice(split + 1);
      if (!partners.has(a)) partners.set(a, []);
      if (!partners.has(b)) partners.set(b, []);
      partners.get(a).push({ word: b, score });
      partners.get(b).push({ word: a, score });
    }
    const relation = new Map();
    for (const [word, list] of partners) {
      list.sort((a, b) => b.score - a.score);
      relation.set(word, list.slice(0, 5).map((item) => item.word));
    }
    book._relations = relation;
    return relation;
  }

  // 随机选题时以 2–3 个相近词为一组，整组相邻出现。
  function selectRelatedGroups(candidates, limit, book) {
    if (limit <= 0 || !candidates.length) return [];
    if (candidates.length === 1 || limit === 1) return candidates.slice(0, limit).map((entry) => [entry]);
    const relation = relationMapFor(book);
    const byWord = new Map(candidates.map((entry) => [entry.w, entry]));
    const used = new Set();
    const groups = [];
    let picked = 0;
    for (const entry of shuffle(candidates)) {
      if (picked >= limit) break;
      if (used.has(entry.w)) continue;
      const group = [entry];
      used.add(entry.w);
      picked += 1;
      for (const partnerWord of relation.get(entry.w) || []) {
        if (group.length >= 3 || picked >= limit) break;
        if (used.has(partnerWord) || !byWord.has(partnerWord)) continue;
        group.push(byWord.get(partnerWord));
        used.add(partnerWord);
        picked += 1;
      }
      groups.push(group);
    }
    return groups;
  }

  function arrangeRelated(entries, book) {
    if (store.settings.order !== "random" || entries.length < 2) return entries;
    return selectRelatedGroups(entries, entries.length, book).reduce((out, group) => out.concat(group), []);
  }

  function weaveGroups(freshGroups, dueGroups) {
    const queue = [];
    const max = Math.max(freshGroups.length, dueGroups.length);
    for (let i = 0; i < max; i += 1) {
      if (freshGroups[i]) {
        for (const entry of freshGroups[i]) queue.push({ word: entry, isNew: true });
      }
      if (dueGroups[i]) {
        for (const entry of dueGroups[i]) queue.push({ word: entry, isNew: false });
      }
    }
    return queue;
  }

  function normalizeAnswer(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[’‘`´]/g, "'")
      .replace(/[^a-z0-9]/g, "");
  }

  function isCorrectAnswer(input, target) {
    const a = normalizeAnswer(input);
    const b = normalizeAnswer(target);
    if (!a || !b) return false;
    if (a === b) return true;
    const variant = VARIANTS.get(String(target).toLowerCase());
    return Boolean(variant && normalizeAnswer(variant) === a);
  }

  function renderTappable(text) {
    if (!text) return "";
    return String(text)
      .split(/([A-Za-z][A-Za-z'’\-]*)/g)
      .map((part, index) => {
        if (index % 2 === 1) {
          return `<button type="button" class="tapword" data-word="${escAttr(part)}">${esc(part)}</button>`;
        }
        return esc(part);
      })
      .join("");
  }

  function posMeaning(meaning) {
    const safe = esc(meaning || "");
    return safe.replace(
      /^((?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|int|aux|abbr)\.)\s*/i,
      '<span class="pos">$1</span> '
    );
  }

  function shortMeaning(meaning) {
    let text = String(meaning || "")
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 78) text = `${text.slice(0, 76).replace(/[；;，,、\s]+$/g, "")}…`;
    return text;
  }

  function loadStore() {
    const fresh = defaultStore();
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!raw || typeof raw !== "object") return fresh;
      const settings = { ...fresh.settings, ...(raw.settings || {}) };
      settings.dailyNew = clamp(Number.isFinite(parseInt(settings.dailyNew, 10)) ? parseInt(settings.dailyNew, 10) : 20, 5, 100);
      settings.dailyReview = clamp(Number.isFinite(parseInt(settings.dailyReview, 10)) ? parseInt(settings.dailyReview, 10) : 20, 0, 100);
      settings.accent = settings.accent === "uk" ? "uk" : "us";
      settings.order = settings.order === "sequence" ? "sequence" : "random";
      settings.sound = settings.sound !== false;
      settings.ranges = settings.ranges && typeof settings.ranges === "object" ? settings.ranges : {};
      return {
        version: 1,
        settings,
        progress: raw.progress && typeof raw.progress === "object" ? raw.progress : {},
        history: Array.isArray(raw.history) ? raw.history : [],
        daily: raw.daily && typeof raw.daily === "object" ? raw.daily : {},
        totals: { ...fresh.totals, ...(raw.totals || {}) },
        createdAt: raw.createdAt || Date.now(),
      };
    } catch (error) {
      console.warn("Failed to load local data", error);
      return fresh;
    }
  }

  function defaultStore() {
    return {
      version: 1,
      settings: {
        bookId: "gaokao",
        dailyNew: 20,
        dailyReview: 20,
        accent: "us",
        autoSpeak: false,
        order: "random",
        sound: true,
        ranges: {},
        installHintDismissed: false,
      },
      progress: {},
      history: [],
      daily: {},
      totals: { attempts: 0, correct: 0, sessions: 0, seconds: 0 },
      createdAt: Date.now(),
    };
  }

  function saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
      console.warn("Failed to save local data", error);
      toast("记录保存失败：设备存储空间可能已满", true);
    }
  }

  function getToday() {
    const key = todayKey();
    if (!store.daily[key] || typeof store.daily[key] !== "object") {
      store.daily[key] = { attempts: 0, correct: 0, seconds: 0, sessions: 0, newByBook: {} };
    }
    const day = store.daily[key];
    if (!day.newByBook || typeof day.newByBook !== "object") day.newByBook = {};
    day.attempts = Number(day.attempts) || 0;
    day.correct = Number(day.correct) || 0;
    day.seconds = Number(day.seconds) || 0;
    day.sessions = Number(day.sessions) || 0;
    return day;
  }

  function todayNew(bookId) {
    return getToday().newByBook[bookId] || 0;
  }

  function progressFor(bookId) {
    if (!store.progress[bookId] || typeof store.progress[bookId] !== "object") {
      store.progress[bookId] = {};
    }
    return store.progress[bookId];
  }

  function currentBook() {
    return state.books[store.settings.bookId] || null;
  }

  function bookById(id) {
    return state.books[id] || null;
  }

  function rangeFor(book) {
    const raw = store.settings.ranges[book.id];
    if (Array.isArray(raw) && raw.length === 2) {
      const start = clamp(parseInt(raw[0], 10) || 0, 0, Math.max(0, book.words.length - 1));
      const end = clamp(parseInt(raw[1], 10) || 0, start, Math.max(0, book.words.length - 1));
      return [start, end];
    }
    return [0, Math.max(0, book.words.length - 1)];
  }

  function rangeWords(book) {
    const [start, end] = rangeFor(book);
    return book.words.slice(start, end + 1);
  }

  function rangeLabel(book) {
    const [start, end] = rangeFor(book);
    if (start === 0 && end === book.words.length - 1) return `全部 ${book.words.length} 词`;
    return `${start + 1}–${end + 1} 词`;
  }

  function inRange(book, word) {
    const index = book._index ? book._index.get(word) : -1;
    if (index == null || index < 0) return false;
    const [start, end] = rangeFor(book);
    return index >= start && index <= end;
  }

  function bookStats(book) {
    const progress = progressFor(book.id);
    let seen = 0;
    let mastered = 0;
    let wrong = 0;
    for (const entry of book.words) {
      const item = progress[entry.w];
      if (!item) continue;
      seen += 1;
      if (item.mastered) mastered += 1;
      if ((item.wrongCount || 0) > 0 && !item.mastered) wrong += 1;
    }
    return {
      total: book.words.length,
      seen,
      mastered,
      wrong,
      pct: book.words.length ? Math.round((seen / book.words.length) * 100) : 0,
    };
  }

  // 未加载的词库没有词条数组可用，用已保存的进度条数估算展示进度。
  function progressStats(meta) {
    const book = state.books[meta.id];
    if (book) return bookStats(book);
    const total = Number(meta.count) || 0;
    const seen = Object.keys(store.progress[meta.id] || {}).length;
    return {
      total,
      seen,
      mastered: 0,
      wrong: 0,
      pct: total ? Math.min(100, Math.round((seen / total) * 100)) : 0,
    };
  }

  function dueWords(book) {
    const progress = progressFor(book.id);
    const now = Date.now();
    const [start, end] = rangeFor(book);
    const out = [];
    for (let i = start; i <= end; i += 1) {
      const entry = book.words[i];
      const item = progress[entry.w];
      if (item && !item.mastered && Number(item.due) <= now) {
        out.push({ entry, item });
      }
    }
    out.sort((a, b) => (a.item.due || 0) - (b.item.due || 0) || (b.item.wrongCount || 0) - (a.item.wrongCount || 0));
    return out;
  }

  function wrongEntries(book) {
    const progress = progressFor(book.id);
    const out = [];
    for (const entry of book.words) {
      const item = progress[entry.w];
      if (item && (item.wrongCount || 0) > 0 && !item.mastered) {
        out.push({ entry, item });
      }
    }
    out.sort((a, b) => {
      const dueDiff = (a.item.due || 0) - (b.item.due || 0);
      if (dueDiff) return dueDiff;
      const wrongDiff = (b.item.wrongCount || 0) - (a.item.wrongCount || 0);
      if (wrongDiff) return wrongDiff;
      return (b.item.last || 0) - (a.item.last || 0);
    });
    return out;
  }

  function calcStreak() {
    let offset = getToday().attempts > 0 ? 0 : -1;
    let count = 0;
    while (count < 9999) {
      const day = store.daily[dateKey(offset)];
      if (!day || !(Number(day.attempts) > 0)) break;
      count += 1;
      offset -= 1;
    }
    return count;
  }

  function globalStats() {
    let seen = 0;
    let mastered = 0;
    let wrong = 0;
    for (const map of Object.values(store.progress)) {
      if (!map || typeof map !== "object") continue;
      for (const item of Object.values(map)) {
        if (!item) continue;
        seen += 1;
        if (item.mastered) mastered += 1;
        if ((item.wrongCount || 0) > 0 && !item.mastered) wrong += 1;
      }
    }
    const attempts = store.totals.attempts || 0;
    const correct = store.totals.correct || 0;
    return {
      seen,
      mastered,
      wrong,
      attempts,
      correct,
      accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
    };
  }

  function lemmaCandidates(raw) {
    const word = String(raw || "").toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "");
    if (!word) return [];
    const out = [word];
    const add = (value) => {
      if (value && value.length > 1 && !out.includes(value)) out.push(value);
    };
    if (IRREGULAR[word]) add(IRREGULAR[word]);
    if (word.endsWith("'s")) add(word.slice(0, -2));
    if (word.endsWith("s'")) add(word.slice(0, -2));
    if (word.endsWith("ies")) add(`${word.slice(0, -3)}y`);
    if (word.endsWith("ied")) add(`${word.slice(0, -3)}y`);
    if (word.endsWith("ing")) {
      const stem = word.slice(0, -3);
      add(stem);
      add(`${stem}e`);
      if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) add(stem.slice(0, -1));
    }
    if (word.endsWith("ed")) {
      const stem = word.slice(0, -2);
      add(stem);
      add(`${stem}e`);
      if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) add(stem.slice(0, -1));
    }
    if (word.endsWith("es")) add(word.slice(0, -2));
    if (word.endsWith("s")) add(word.slice(0, -1));
    if (word.endsWith("ily")) add(`${word.slice(0, -3)}y`);
    if (word.endsWith("ly")) {
      add(word.slice(0, -2));
      add(`${word.slice(0, -2)}e`);
    }
    if (word.endsWith("er")) {
      add(word.slice(0, -2));
      add(`${word.slice(0, -1)}`);
      if (word.length > 4 && word[word.length - 3] === word[word.length - 4]) add(word.slice(0, -3));
    }
    if (word.endsWith("est")) {
      add(word.slice(0, -3));
      add(`${word.slice(0, -2)}`);
    }
    if (word.endsWith("ier")) add(`${word.slice(0, -3)}y`);
    if (word.endsWith("iest")) add(`${word.slice(0, -4)}y`);
    return out;
  }

  /* ---------------- data ---------------- */
  async function fetchJSON(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${response.status} ${path}`);
    return response.json();
  }

  async function loadMeta() {
    state.meta = await fetchJSON("data/meta.json");
    if (!state.meta || !Array.isArray(state.meta.books) || !state.meta.books.length) {
      throw new Error("词库元数据无效");
    }
  }

  async function loadBook(id) {
    if (state.books[id]) return state.books[id];
    const meta = state.meta.books.find((book) => book.id === id);
    if (!meta) throw new Error("没有找到这个词库");
    const data = await fetchJSON(`data/books/${id}.json`);
    if (!data || !Array.isArray(data.words) || !data.words.length) {
      throw new Error("词库内容为空");
    }
    data.id = id;
    data.name = meta.name;
    data.color = meta.color;
    data._index = new Map(data.words.map((entry, index) => [entry.w, index]));
    data._examples = data.words.filter((entry) => entry.e && entry.t);
    state.books[id] = data;
    return data;
  }

  async function loadDict() {
    if (state.dict) return state.dict;
    if (!state.dictPromise) {
      state.dictPromise = fetchJSON("data/dict.json")
        .then((data) => {
          state.dict = data || {};
          return state.dict;
        })
        .catch((error) => {
          state.dictPromise = null;
          throw error;
        });
    }
    return state.dictPromise;
  }

  async function lookupWord(raw) {
    const candidates = lemmaCandidates(raw);
    await loadDict();
    for (const candidate of candidates) {
      const hit = state.dict[candidate];
      if (hit) {
        return {
          query: String(raw).toLowerCase(),
          base: candidate,
          phonetic: hit[0] || "",
          meaning: hit[1] || "",
        };
      }
    }
    return null;
  }

  function findBookEntry(word) {
    const bases = lemmaCandidates(word);
    const ordered = [];
    const current = currentBook();
    if (current) ordered.push(current);
    for (const book of Object.values(state.books)) {
      if (!current || book.id !== current.id) ordered.push(book);
    }
    for (const book of ordered) {
      for (const base of bases) {
        const index = book._index ? book._index.get(base) : -1;
        if (index != null && index >= 0) return { book, entry: book.words[index], base };
      }
    }
    return null;
  }

  /* ---------------- audio ---------------- */
  let voices = [];
  let voicesLoaded = false;

  function loadVoices() {
    if (!("speechSynthesis" in window)) return;
    voices = window.speechSynthesis.getVoices() || [];
    if (voices.length) voicesLoaded = true;
  }

  if ("speechSynthesis" in window) {
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    setTimeout(loadVoices, 350);
    setTimeout(loadVoices, 1200);
  }

  function speak(text, options = {}) {
    if (!text) return;
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      toast("当前浏览器不支持语音朗读", true);
      return;
    }
    loadVoices();
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(String(text));
      const accent = store.settings.accent === "uk" ? "en-GB" : "en-US";
      utterance.lang = accent;
      utterance.rate = options.rate || 0.88;
      utterance.pitch = 1;
      const exact = voices.filter((voice) => voice.lang === accent);
      const english = voices.filter((voice) => /^en[-_]/i.test(voice.lang));
      const voice = exact.find((item) => item.localService) || exact[0] || english.find((item) => item.localService) || english[0];
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
      if (!voices.length) {
        setTimeout(() => {
          loadVoices();
          if (!voices.length) toast("没有检测到英语语音包，请在系统设置中安装英语语音", true);
        }, 700);
      }
    } catch (error) {
      console.warn("Speech failed", error);
      toast("语音播放失败，请检查系统语音设置", true);
    }
  }

  let feedbackAudio = null;

  // 用 Web Audio 现场合成短音效，不需要额外音频文件，断网也能响。
  function feedbackAudioContext() {
    if (feedbackAudio && feedbackAudio.state !== "closed") return feedbackAudio;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    try {
      feedbackAudio = new AudioCtor();
    } catch (error) {
      return null;
    }
    return feedbackAudio;
  }

  function scheduleCorrectCue(ctx, start) {
    [
      { freq: 1046.5, offset: 0, duration: 0.22, volume: 0.16 },
      { freq: 1568, offset: 0.075, duration: 0.3, volume: 0.13 },
    ].forEach(({ freq, offset, duration, volume }) => {
      const at = start + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + duration + 0.02);
    });
  }

  function scheduleWrongCue(ctx, start) {
    [
      { type: "sine", from: 190, to: 65, volume: 0.22, duration: 0.38 },
      { type: "triangle", from: 96, to: 48, volume: 0.07, duration: 0.32 },
    ].forEach(({ type, from, to, volume, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, start);
      osc.frequency.exponentialRampToValueAtTime(to, start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    });
  }

  function playFeedback(isCorrect, force = false) {
    if (!force && !store.settings.sound) return;
    const ctx = feedbackAudioContext();
    if (!ctx) return;
    const start = () => {
      try {
        if (isCorrect) scheduleCorrectCue(ctx, ctx.currentTime + 0.015);
        else scheduleWrongCue(ctx, ctx.currentTime + 0.015);
      } catch (error) {
        console.warn("Feedback sound failed", error);
      }
    };
    if (ctx.state === "suspended") {
      ctx.resume().then(start).catch(() => {});
    } else {
      start();
    }
  }

  function previewFeedbackSound() {
    playFeedback(true, true);
    setTimeout(() => playFeedback(false, true), 620);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch (error) { /* ignore */ }
    }
  }

  /* ---------------- toast ---------------- */
  let toastTimer = 0;
  function toast(message, isError = false) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("is-error", Boolean(isError));
    el.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.classList.remove("is-show"), 2600);
  }

  /* ---------------- sheets ---------------- */
  function openSheet(html, options = {}) {
    const sheet = $("#sheet");
    const backdrop = $("#backdrop");
    const content = $("#sheetContent");
    content.innerHTML = html;
    content.scrollTop = 0;
    clearTimeout(ui.sheetTimer);
    if (!ui.sheetOpen) {
      ui.lastFocus = document.activeElement;
      sheet.hidden = false;
      backdrop.hidden = false;
      document.body.classList.add("sheet-open");
      requestAnimationFrame(() => {
        sheet.classList.add("is-open");
        backdrop.classList.add("is-open");
      });
      ui.sheetOpen = true;
    }
    if (options.focus !== false) {
      window.setTimeout(() => {
        const focusable = content.querySelector("[data-autofocus], .sheet-close, button, input");
        if (focusable) focusable.focus({ preventScroll: true });
      }, 80);
    }
  }

  function closeSheet() {
    if (!ui.sheetOpen) return;
    const sheet = $("#sheet");
    const backdrop = $("#backdrop");
    sheet.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    ui.sheetOpen = false;
    document.body.classList.remove("sheet-open");
    ui.sheetTimer = window.setTimeout(() => {
      sheet.hidden = true;
      backdrop.hidden = true;
      $("#sheetContent").innerHTML = "";
    }, 290);
    ui.lookupToken += 1;
    if (ui.lastFocus && typeof ui.lastFocus.focus === "function") {
      try { ui.lastFocus.focus({ preventScroll: true }); } catch (error) { /* ignore */ }
    }
    stopSpeaking();
  }

  function sheetHead(title, subtitle = "", id = "sheetTitle") {
    return `
      <div class="sheet-head">
        <div>
          <h2 id="${id}">${esc(title)}</h2>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ""}
        </div>
        <button class="sheet-close" type="button" data-close-sheet aria-label="关闭">${ICONS.close}</button>
      </div>`;
  }

  /* ---------------- chrome ---------------- */
  function updateChrome() {
    const topbar = $("#topbar");
    const view = $("#view");
    const tabbar = $("#tabbar");
    const title = $("#pageTitle");
    const sub = $("#pageSub");
    const action = $("#topAction");

    topbar.hidden = false;
    view.hidden = false;
    tabbar.hidden = false;

    const book = currentBook();
    const streak = calcStreak();

    if (ui.tab === "home") {
      title.textContent = "词听";
      sub.textContent = `${dateLabel()} · ${streak > 0 ? `连续 ${streak} 天` : "从今天开始"}`;
      action.innerHTML = ICONS.gear;
      action.setAttribute("aria-label", "打开设置");
      action.hidden = false;
    } else if (ui.tab === "wrong") {
      title.textContent = "错词本";
      sub.textContent = book ? `${book.name} · 反复练，直到记住` : "反复练，直到记住";
      action.innerHTML = ICONS.gear;
      action.setAttribute("aria-label", "打开设置");
      action.hidden = false;
    } else if (ui.tab === "stats") {
      title.textContent = "学习记录";
      sub.textContent = "每天进步一点点";
      action.innerHTML = ICONS.gear;
      action.setAttribute("aria-label", "打开设置");
      action.hidden = false;
    } else {
      title.textContent = "我的";
      sub.textContent = "离线 · 免费 · 无账号";
      action.hidden = true;
    }

    $$(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === ui.tab));
    updateWrongDot();
  }

  function updateWrongDot() {
    const dot = $("#wrongDot");
    if (!dot) return;
    const book = currentBook();
    const count = book ? wrongEntries(book).length : 0;
    dot.hidden = count === 0;
  }

  function switchTab(tab) {
    if (!["home", "wrong", "stats", "settings"].includes(tab)) return;
    ui.tab = tab;
    renderCurrent();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderCurrent() {
    updateChrome();
    if (ui.tab === "home") renderHome();
    else if (ui.tab === "wrong") renderWrong();
    else if (ui.tab === "stats") renderStats();
    else renderSettings();
  }

  /* ---------------- home ---------------- */
  function renderHome() {
    const book = currentBook();
    if (!book) {
      renderFatal("词库还没有准备好。");
      return;
    }
    const today = getToday();
    const stats = bookStats(book);
    const wrong = wrongEntries(book);
    const due = dueWords(book);
    const streak = calcStreak();
    const newCount = todayNew(book.id);
    const target = store.settings.dailyNew;
    const pct = target > 0 ? clamp(Math.round((newCount / target) * 100), 0, 100) : 0;
    const accuracy = today.attempts ? Math.round((today.correct / today.attempts) * 100) : null;
    const targetDone = newCount >= target;
    const examples = book._examples.length ? book._examples : book.words;
    const sentenceEntry = examples[(Math.floor(Date.now() / DAY) + ui.sentenceSeed) % examples.length];
    const hasExample = Boolean(sentenceEntry && sentenceEntry.e && sentenceEntry.t);
    const showInstall = !isStandalone() && !store.settings.installHintDismissed;

    const bookCards = state.meta.books.map((meta) => {
      const bStats = progressStats(meta);
      const active = meta.id === book.id;
      return `
        <button class="book-card ${active ? "is-active" : ""}" type="button" data-book="${escAttr(meta.id)}" style="color:${escAttr(meta.color)}">
          <span class="book-card-top">
            <i class="book-dot" style="background:${escAttr(meta.color)}"></i>
            <strong style="color:var(--ink)">${esc(meta.name)}</strong>
          </span>
          <small>${bStats.total} 词 · 已学 ${bStats.pct}%</small>
          <span class="mini-progress"><i style="width:${bStats.pct}%;background:${escAttr(meta.color)}"></i></span>
        </button>`;
    }).join("");

    const heroSub = targetDone
      ? (due.length ? `今日新词已完成 · 还有 ${due.length} 个待复习` : "今日任务完成 · 可以自由复习")
      : `今天还差 ${Math.max(0, target - newCount)} 个新词`;
    const heroFoot = accuracy == null
      ? `<span>今天还没有开始</span><span>错词 ${wrong.length} 个</span>`
      : `<span>今日正确率 <strong>${accuracy}%</strong></span><span>待复习 <strong>${due.length}</strong> 个</span>`;

    $("#view").innerHTML = `
      <section class="hero">
        <div class="hero-top">
          <span class="hero-kicker">今日任务</span>
          <span class="streak-pill">${ICONS.flame}${streak > 0 ? `连续 ${streak} 天` : "今天开始"}</span>
        </div>
        <div class="hero-main">
          <div>
            <div class="hero-number"><strong>${newCount}</strong><span>/ ${target} 新词</span></div>
            <div class="hero-sub">${heroSub}</div>
          </div>
          <div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
        </div>
        <div class="hero-bar"><i style="width:${pct}%"></i></div>
        <div class="hero-foot">${heroFoot}</div>
      </section>

      ${showInstall ? `
        <div class="install-hint">
          <div class="install-hint-copy"><strong>装到主屏幕，断网也能用</strong><br>点一下图标就能开始听写</div>
          <button type="button" class="install-go" data-action="install">安装</button>
          <button type="button" class="install-close" data-action="dismiss-install" aria-label="不再提示">×</button>
        </div>` : ""}

      <div class="section-head">
        <h2>学习范围</h2>
        <span class="sub">${esc(book.subtitle)}</span>
      </div>
      <div class="book-strip">${bookCards}</div>
      <div class="book-meta-row">
        <button class="range-chip" type="button" data-open-range>
          ${esc(rangeLabel(book))}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>
        </button>
        <span class="range-hint">只在这个范围内抽词</span>
      </div>

      <div class="section-head">
        <h2>开始练习</h2>
        <span class="sub">${store.settings.order === "random" ? "随机 · 相近词成组" : "按词库顺序"}</span>
      </div>
      <div class="mode-grid">
        <button class="mode-card write" type="button" data-mode="zh2en">
          <span class="mode-icon">${ICONS.pencil}</span>
          <strong>看中文<br>写英文</strong>
          <small>听发音 · 拼写 · 手写</small>
          <span class="mode-arrow">${ICONS.arrow}</span>
        </button>
        <button class="mode-card pick" type="button" data-mode="en2zh">
          <span class="mode-icon">${ICONS.list}</span>
          <strong>看英文<br>选中文</strong>
          <small>四选一 · 快速识词</small>
          <span class="mode-arrow">${ICONS.arrow}</span>
        </button>
      </div>
      <p class="mode-note">每天 ${target} 个新词 · 错词自动重复出现</p>

      ${wrong.length ? `
        <div class="wrong-teaser">
          <span class="wrong-teaser-icon">${ICONS.book}</span>
          <div class="wrong-teaser-copy">
            <strong>错词本里有 ${wrong.length} 个词</strong>
            <small>${due.length ? `${due.length} 个今天该复习了` : "反复练，直到记牢"}</small>
          </div>
          <button class="soft-btn" type="button" data-go-wrong>去复习</button>
        </div>` : ""}

      <div class="section-head">
        <h2>今日例句</h2>
        <button class="text-btn" type="button" data-new-sentence>换一句</button>
      </div>
      <div class="daily-sentence">
        ${hasExample ? `
          <div class="daily-sentence-head">
            <h3>点任意单词，查音标和释义</h3>
            <button class="small-audio" type="button" data-speak="${escAttr(sentenceEntry.e)}">${ICONS.speaker} 朗读</button>
          </div>
          <div class="sentence-en">${renderTappable(sentenceEntry.e)}</div>
          <div class="sentence-zh">${esc(sentenceEntry.t)}</div>
          <div class="sentence-tools">
            <span class="range-hint">— ${esc(sentenceEntry.w)}</span>
            <button class="text-btn" type="button" data-word="${escAttr(sentenceEntry.w)}">查看这个词</button>
          </div>` : `
          <div class="daily-sentence-head"><h3>今日例句</h3></div>
          <div class="sentence-zh">当前范围暂时没有带例句的单词。</div>`}
      </div>

      <p class="tip-line">完全离线 · 无广告 · 无账号<br>学习记录只保存在这台设备上</p>
    `;
  }

  /* ---------------- wrong words ---------------- */
  function renderWrong() {
    const book = currentBook();
    if (!book) return;
    const list = wrongEntries(book);
    const due = dueWords(book).filter((item) => (item.item.wrongCount || 0) > 0).length;

    if (!list.length) {
      $("#view").innerHTML = `
        <div class="page-head">
          <div><h2>错词本</h2><p>${esc(book.name)} · 反复练，直到记住</p></div>
          <div class="count-badge"><strong>0</strong><span>错词</span></div>
        </div>
        <div class="empty-state">
          <div class="empty-icon">${ICONS.check}</div>
          <h3>还没有错词</h3>
          <p>练习中答错的单词会自动收进这里，之后会优先安排复习。</p>
          <button class="primary-btn" type="button" data-go-home>去练习</button>
        </div>`;
      return;
    }

    const items = list.map(({ entry, item }) => `
      <article class="wrong-item">
        <div class="wrong-item-top">
          <div>
            <button class="wrong-word" type="button" data-word="${escAttr(entry.w)}">${esc(entry.w)}</button>
            ${entry.p ? `<div class="wrong-phonetic">/${esc(entry.p)}/</div>` : ""}
          </div>
          <button class="mini-btn" type="button" data-speak="${escAttr(entry.w)}" aria-label="朗读 ${escAttr(entry.w)}">${ICONS.speaker}</button>
        </div>
        <div class="wrong-meaning">${esc(entry.m)}</div>
        <div class="wrong-foot">
          <small>错 ${item.wrongCount || 1} 次 · ${formatWhen(item.last)}</small>
          <div class="mini-actions">
            <button class="mini-btn" type="button" data-word="${escAttr(entry.w)}">${ICONS.eye} 例句</button>
            <button class="mini-btn danger" type="button" data-remove-word="${escAttr(entry.w)}">移除</button>
          </div>
        </div>
      </article>`).join("");

    $("#view").innerHTML = `
      <div class="page-head">
        <div><h2>错词本</h2><p>${esc(book.name)} · ${due ? `${due} 个今天到期` : "按遗忘规律安排复习"}</p></div>
        <div class="count-badge"><strong>${list.length}</strong><span>错词</span></div>
      </div>
      <div class="wrong-actions">
        <button class="primary-btn" type="button" data-wrong-mode="zh2en">写英文复习</button>
        <button class="ghost-btn" type="button" data-wrong-mode="en2zh">选中文</button>
      </div>
      <div class="wrong-list">${items}</div>
      <p class="tip-line">答对会逐步延长复习间隔<br>连续答对后自动移出错词本</p>`;
  }

  /* ---------------- stats ---------------- */
  function renderStats() {
    const total = globalStats();
    const streak = calcStreak();
    const today = getToday();
    const todayAccuracy = today.attempts ? Math.round((today.correct / today.attempts) * 100) : 0;
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const key = dateKey(-i);
      const day = store.daily[key];
      days.push({
        key,
        label: "日一二三四五六"[new Date(`${key}T00:00:00`).getDay()],
        count: day ? Number(day.attempts) || 0 : 0,
        isToday: i === 0,
      });
    }
    const maxCount = Math.max(1, ...days.map((day) => day.count));

    const bookRows = state.meta.books.map((meta) => {
      const b = state.books[meta.id];
      const progress = store.progress[meta.id] || {};
      let seen = 0;
      if (b) {
        for (const entry of b.words) if (progress[entry.w]) seen += 1;
      } else {
        seen = Object.keys(progress).length;
      }
      const pct = meta.count ? Math.round((seen / meta.count) * 100) : 0;
      return `
        <div class="book-progress-row">
          <strong>${esc(meta.short)}</strong>
          <div class="track"><i style="width:${pct}%;background:${escAttr(meta.color)}"></i></div>
          <small>${seen}/${meta.count}</small>
        </div>`;
    }).join("");

    const history = (store.history || []).slice(0, 12).map((item) => {
      const bookName = state.meta.books.find((meta) => meta.id === item.bookId)?.short || item.bookId;
      return `
        <div class="history-row">
          <span class="history-icon ${item.mode === "en2zh" ? "pick" : ""}">${item.mode === "en2zh" ? "选" : "写"}</span>
          <div class="history-copy">
            <strong>${esc(bookName)} · ${esc(MODE_LABEL[item.mode] || "练习")}</strong>
            <small>${formatWhen(item.date)} · ${item.attempts || 0} 题 · ${item.accuracy || 0}% 正确</small>
          </div>
          <div class="history-score"><strong>${item.score || 0}</strong><small>分</small></div>
        </div>`;
    }).join("");

    $("#view").innerHTML = `
      <div class="page-head">
        <div><h2>学习记录</h2><p>今天 ${today.attempts} 题 · 正确率 ${todayAccuracy}%</p></div>
      </div>
      <div class="stat-grid">
        <div class="stat-card highlight">
          <small>连续学习</small>
          <strong>${streak}<em>天</em></strong>
        </div>
        <div class="stat-card">
          <small>累计答对</small>
          <strong>${total.accuracy}<em>%</em></strong>
        </div>
        <div class="stat-card">
          <small>已学词条</small>
          <strong>${total.seen}<em>词</em></strong>
        </div>
        <div class="stat-card">
          <small>错词待复习</small>
          <strong>${total.wrong}<em>词</em></strong>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-head"><h3>最近 7 天</h3><span>每日答题数</span></div>
        <div class="chart">
          ${days.map((day) => `
            <div class="chart-col ${day.isToday ? "is-today" : ""}">
              <div class="chart-bar-wrap"><i class="chart-bar" style="height:${Math.max(4, Math.round((day.count / maxCount) * 100))}%"></i></div>
              <small>${day.label}</small>
            </div>`).join("")}
        </div>
      </div>

      <div class="section-head"><h2>词库进度</h2><span class="sub">已学 / 总数</span></div>
      <div class="book-progress-list">${bookRows}</div>

      <div class="section-head"><h2>练习记录</h2><span class="sub">最近 ${Math.min(12, store.history.length)} 次</span></div>
      ${history ? `<div class="history-card">${history}</div>` : `
        <div class="empty-state" style="padding:34px 20px 20px">
          <div class="empty-icon">${ICONS.spark}</div>
          <h3>还没有练习记录</h3>
          <p>完成一组听写后，得分和正确率会保存在这里。</p>
        </div>`}
      <p class="tip-line">记录保存在浏览器本地<br>清理浏览器数据前请先导出备份</p>`;
  }

  /* ---------------- settings ---------------- */
  function renderSettings() {
    const installed = isStandalone();
    const ios = isIOS();
    const swText = ui.swReady
      ? "离线缓存已就绪，断网也能打开"
      : "离线缓存准备中，请保持页面打开片刻";
    const book = currentBook();
    const totalWords = state.meta ? state.meta.books.reduce((sum, item) => sum + item.count, 0) : 0;

    $("#view").innerHTML = `
      <div class="page-head">
        <div><h2>我的</h2><p>不用登录，不上传，所有记录只在本机</p></div>
      </div>

      <div class="install-card">
        <h3>${installed ? "已安装到主屏幕" : "放到手机主屏幕"}</h3>
        <p>${installed
          ? "以后点桌面图标就能直接打开，完全离线也能听写。"
          : ios
            ? "在 Safari 里点分享按钮，再选“添加到主屏幕”。"
            : "安装后像普通 App 一样打开，断网也能使用。"}</p>
        ${installed ? "" : `<button type="button" data-action="install">${ios ? "查看安装步骤" : "安装到主屏幕"}</button>`}
      </div>

      <div class="settings-group">
        <div class="settings-title">每日学习</div>
        <div class="setting-row">
          <div class="setting-copy"><strong>每天新词</strong><small>每天第一次见到的单词数量</small></div>
          <div class="segmented" role="group" aria-label="每天新词数量">
            ${[5, 10, 15, 20, 30, 50].map((value) => `
              <button type="button" data-setting="dailyNew" data-value="${value}" class="${store.settings.dailyNew === value ? "is-active" : ""}">${value}</button>`).join("")}
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>每天复习</strong><small>到期错词和旧词的复习上限</small></div>
          <div class="segmented" role="group" aria-label="每天复习数量">
            ${[10, 20, 30, 50].map((value) => `
              <button type="button" data-setting="dailyReview" data-value="${value}" class="${store.settings.dailyReview === value ? "is-active" : ""}">${value}</button>`).join("")}
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>出题顺序</strong><small>随机时把近义词、易混词排在相邻题目</small></div>
          <div class="segmented" role="group" aria-label="出题顺序">
            <button type="button" data-setting="order" data-value="random" class="${store.settings.order === "random" ? "is-active" : ""}">随机</button>
            <button type="button" data-setting="order" data-value="sequence" class="${store.settings.order === "sequence" ? "is-active" : ""}">顺序</button>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>自动发音</strong><small>每道题出现时自动读一遍单词</small></div>
          <button type="button" class="switch ${store.settings.autoSpeak ? "is-on" : ""}" role="switch" aria-checked="${store.settings.autoSpeak}" data-toggle="autoSpeak" aria-label="自动发音"></button>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-title">发音</div>
        <div class="setting-row">
          <div class="setting-copy"><strong>口音</strong><small>使用设备自带的离线英语语音</small></div>
          <div class="segmented" role="group" aria-label="发音口音">
            <button type="button" data-setting="accent" data-value="us" class="${store.settings.accent === "us" ? "is-active" : ""}">美音</button>
            <button type="button" data-setting="accent" data-value="uk" class="${store.settings.accent === "uk" ? "is-active" : ""}">英音</button>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>答题音效</strong><small>答对“叮”，答错低沉的“duang”，无需联网</small></div>
          <div class="data-actions">
            <button class="mini-btn" type="button" data-action="sound-preview">叮 / duang</button>
            <button type="button" class="switch ${store.settings.sound ? "is-on" : ""}" role="switch" aria-checked="${store.settings.sound}" data-toggle="sound" aria-label="答题音效"></button>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>语音测试</strong><small>测试当前设备的英语语音</small></div>
          <button class="mini-btn" type="button" data-speak="vocabulary">${ICONS.speaker} 读一下</button>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-title">数据</div>
        <div class="setting-row">
          <div class="setting-copy"><strong>备份与恢复</strong><small>换手机前导出一份 JSON 记录</small></div>
          <div class="data-actions">
            <button class="mini-btn" type="button" data-action="export">${ICONS.download} 导出</button>
            <button class="mini-btn" type="button" data-action="import">${ICONS.upload} 导入</button>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>清空记录</strong><small>删除进度、错词本和全部历史</small></div>
          <button class="mini-btn danger" type="button" data-action="reset">${ICONS.trash} 清空</button>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-title">离线与更新</div>
        <div class="setting-row">
          <div class="setting-copy"><strong>离线状态</strong><small>${esc(swText)}</small></div>
          <span class="pill ${ui.swReady ? "green" : "amber"}">${ui.swReady ? "离线可用" : "准备中"}</span>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>检查更新</strong><small>有新版本时，重新打开即可</small></div>
          <button class="mini-btn" type="button" data-action="update">${ICONS.refresh} 检查</button>
        </div>
      </div>

      <div class="about-card">
        <h3>关于词听</h3>
        <div class="about-badges">
          <span>完全离线</span>
          <span>完全免费</span>
          <span>无广告</span>
          <span>无账号</span>
          <span>不上传数据</span>
        </div>
        <p>版本 ${APP_VERSION} · 词库 ${totalWords} 词 · 查词 ${state.meta ? state.meta.dictCount : 0} 条${book ? ` · 当前 ${esc(book.name)}` : ""}</p>
        <p>词库来自 KyleBing/english-vocabulary（BSD-3-Clause）与 pluto0x0/word3500（MIT），仅供学习使用。音标、释义和例句版权归原作者。</p>
        <p>发音调用手机系统自带的英语语音，不需要联网。如果没声音，请在系统设置中安装英语语音包。</p>
      </div>

      <p class="settings-footnote">词听 v${APP_VERSION}<br>数据只保存在本机 localStorage</p>
    `;
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function openInstallHelp() {
    const ios = isIOS();
    const wechat = /MicroMessenger/i.test(navigator.userAgent);
    openSheet(`
      ${sheetHead("安装到主屏幕", "安装一次，以后点图标直接打开")}
      ${wechat ? `<div class="sheet-note">当前像是在微信里打开。请先点右上角“…”选择“在浏览器打开”，再用下面的步骤安装。</div>` : ""}
      <div class="about-card" style="margin-top:0">
        <h3>${ios ? "iPhone / iPad（Safari）" : "Android（Chrome / Edge）"}</h3>
        <ol class="sheet-steps">
          ${ios ? `
            <li>用 Safari 打开本页。</li>
            <li>点屏幕底部的分享按钮（方框向上箭头）。</li>
            <li>向下找到“添加到主屏幕”，点“添加”。</li>
            <li>回到桌面，点“词听”图标即可使用。</li>` : `
            <li>用 Chrome 或 Edge 打开本页。</li>
            <li>点右上角菜单（三个点）。</li>
            <li>选择“安装应用”或“添加到主屏幕”。</li>
            <li>回到桌面，点“词听”图标即可使用。</li>`}
        </ol>
        <div class="sheet-note">第一次打开需要联网加载词库；加载完成后会缓存到本机，之后完全离线可用。</div>
      </div>
      <button class="primary-btn" style="margin-top:14px" type="button" data-close-sheet>知道了</button>
    `);
  }

  async function triggerInstall() {
    if (ui.deferredPrompt) {
      try {
        ui.deferredPrompt.prompt();
        const choice = await ui.deferredPrompt.userChoice;
        ui.deferredPrompt = null;
        if (choice && choice.outcome === "accepted") {
          toast("正在安装…");
        } else {
          toast("已取消安装");
        }
      } catch (error) {
        openInstallHelp();
      }
      return;
    }
    openInstallHelp();
  }

  function exportData() {
    const payload = {
      app: "词听",
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      data: store,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `citing-backup-${todayKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    toast("已导出备份文件");
  }

  function importData() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.hidden = true;
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) {
        input.remove();
        return;
      }
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const data = parsed && parsed.data ? parsed.data : parsed;
        if (!data || typeof data !== "object" || !data.settings || !data.progress) {
          toast("这个文件不是有效的词听备份", true);
          return;
        }
        if (!confirm("导入会覆盖当前设备上的学习记录，确定继续吗？")) return;
        store = loadStoreFrom(data);
        saveStore();
        toast("导入成功，正在重新打开…");
        setTimeout(() => location.reload(), 700);
      } catch (error) {
        console.warn(error);
        toast("导入失败：文件格式不正确", true);
      } finally {
        input.remove();
      }
    });
    // Safari 要求文件选择框在文档中才能可靠触发。
    document.body.appendChild(input);
    input.click();
  }

  function loadStoreFrom(raw) {
    const fresh = defaultStore();
    const settings = { ...fresh.settings, ...(raw.settings || {}) };
    settings.dailyNew = clamp(Number.isFinite(parseInt(settings.dailyNew, 10)) ? parseInt(settings.dailyNew, 10) : 20, 5, 100);
    settings.dailyReview = clamp(Number.isFinite(parseInt(settings.dailyReview, 10)) ? parseInt(settings.dailyReview, 10) : 20, 0, 100);
    settings.accent = settings.accent === "uk" ? "uk" : "us";
    settings.order = settings.order === "sequence" ? "sequence" : "random";
    settings.sound = settings.sound !== false;
    settings.ranges = settings.ranges && typeof settings.ranges === "object" ? settings.ranges : {};
    return {
      version: 1,
      settings,
      progress: raw.progress && typeof raw.progress === "object" ? raw.progress : {},
      history: Array.isArray(raw.history) ? raw.history : [],
      daily: raw.daily && typeof raw.daily === "object" ? raw.daily : {},
      totals: { ...fresh.totals, ...(raw.totals || {}) },
      createdAt: raw.createdAt || Date.now(),
    };
  }

  function resetData() {
    if (!confirm("确定清空全部学习记录吗？错词本、进度和历史都会删除，且无法恢复。")) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      toast("已清空，正在重新打开…");
      setTimeout(() => location.reload(), 600);
    } catch (error) {
      toast("清空失败", true);
    }
  }

  async function checkUpdate() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") {
      toast("当前不是网页安装版，无法检查更新");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        toast("离线缓存还没有准备好");
        return;
      }
      await registration.update();
      toast("已检查更新；有新版本时重新打开即可");
    } catch (error) {
      toast("检查更新失败，请稍后再试", true);
    }
  }

  /* ---------------- book & range sheets ---------------- */
  function openBookSheet() {
    const current = currentBook();
    const options = state.meta.books.map((meta) => {
      const active = current && meta.id === current.id;
      const stats = progressStats(meta);
      return `
        <button class="book-option ${active ? "is-active" : ""}" type="button" data-book-select="${escAttr(meta.id)}">
          <span class="book-option-dot" style="background:${escAttr(meta.color)}">${esc(meta.short.slice(0, 1))}</span>
          <span class="book-option-copy">
            <strong>${esc(meta.name)} · ${meta.count} 词</strong>
            <small>${esc(meta.description)}${stats.seen ? ` · 已学 ${stats.seen} 词` : ""}</small>
          </span>
          <span class="book-option-check">${active ? ICONS.check : ""}</span>
        </button>`;
    }).join("");

    openSheet(`
      ${sheetHead("选择学习范围", "词库之间进度独立保存，随时可以切换")}
      <div class="book-options">${options}</div>
      <div class="sheet-note">每天的新词和复习只在当前选中的词库里抽取。错词本按词库分别保存。</div>
    `);
  }

  async function selectBook(id) {
    if (!state.meta.books.some((book) => book.id === id)) return;
    if (store.settings.bookId === id && state.books[id]) {
      closeSheet();
      return;
    }
    try {
      if (!state.books[id]) {
        toast("正在加载词库…");
        await loadBook(id);
      }
      store.settings.bookId = id;
      saveStore();
      closeSheet();
      renderHome();
      prewarmRelations(currentBook());
      toast(`已切换到${state.meta.books.find((book) => book.id === id).name}`);
    } catch (error) {
      console.warn(error);
      toast("词库加载失败，请重新打开页面", true);
    }
  }

  function openRangeSheet() {
    const book = currentBook();
    if (!book) return;
    const [activeStart, activeEnd] = rangeFor(book);
    const chunks = [];
    for (let start = 0; start < book.words.length; start += 500) {
      const end = Math.min(book.words.length - 1, start + 499);
      chunks.push([start, end]);
    }
    const isAll = activeStart === 0 && activeEnd === book.words.length - 1;
    const options = [
      `<button class="range-option ${isAll ? "is-active" : ""}" type="button" data-range-start="0" data-range-end="${book.words.length - 1}">全部 ${book.words.length} 词</button>`,
      ...chunks.map(([start, end]) => {
        const active = activeStart === start && activeEnd === end;
        return `<button class="range-option ${active ? "is-active" : ""}" type="button" data-range-start="${start}" data-range-end="${end}">${start + 1}–${end + 1} 词</button>`;
      }),
    ].join("");

    openSheet(`
      ${sheetHead("选一段来学", `${book.name} · 当前 ${rangeLabel(book)}`)}
      <div class="range-list">${options}</div>
      <div class="sheet-note">范围只影响每天抽到的新词和复习词。错词本仍保留整个词库的错词，答对后会按记忆规律安排复习。</div>
    `);
  }

  function selectRange(start, end) {
    const book = currentBook();
    if (!book) return;
    store.settings.ranges[book.id] = [start, end];
    saveStore();
    closeSheet();
    renderHome();
  }

  /* ---------------- lookup ---------------- */
  async function openWordSheet(raw) {
    const query = String(raw || "").toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "");
    if (!query) return;
    const token = ++ui.lookupToken;
    openSheet(`
      ${sheetHead("查词", "正在查找离线词库…")}
      <div class="empty-state" style="padding:24px 10px 30px">
        <div class="empty-icon">${ICONS.book}</div>
        <p>正在查找 ${esc(query)}…</p>
      </div>
    `);

    let result = null;
    let error = null;
    try {
      result = await lookupWord(query);
    } catch (err) {
      error = err;
    }
    if (token !== ui.lookupToken) return;

    if (error) {
      openSheet(`
        ${sheetHead("查词", "词典加载失败")}
        <div class="empty-state" style="padding:20px 10px">
          <div class="empty-icon">${ICONS.book}</div>
          <h3>离线词典没有加载成功</h3>
          <p>请检查页面是否完整拷贝，或重新打开应用后再试。</p>
          <button class="primary-btn" type="button" data-close-sheet>关闭</button>
        </div>
      `);
      return;
    }

    if (!result) {
      openSheet(`
        ${sheetHead("查词")}
        <div class="lookup-word">${esc(query)}</div>
        <div class="lookup-phonetic">
          <span>暂未收录音标</span>
          <button class="audio-btn" type="button" data-speak="${escAttr(query)}">${ICONS.speaker} 朗读</button>
        </div>
        <div class="lookup-meaning">离线词库里暂时没有找到这个词。可能是人名、地名或非常用词。</div>
        <div class="lookup-actions">
          <button class="primary-btn" type="button" data-close-sheet>知道了</button>
        </div>
      `);
      return;
    }

    const exact = result.base === query;
    const found = findBookEntry(result.base);
    const progress = found ? progressFor(found.book.id)[found.entry.w] : null;
    const inCurrentBook = found && found.book.id === store.settings.bookId;
    const alreadyWrong = Boolean(progress && (progress.wrongCount || 0) > 0 && !progress.mastered);
    const example = found && found.entry.e && found.entry.t ? found.entry : null;

    openSheet(`
      ${sheetHead("查词", exact ? "音标 · 释义 · 例句" : `原形：${result.base}`)}
      <div class="lookup-word">${esc(query)}</div>
      <div class="lookup-phonetic">
        ${result.phonetic ? `<span>/${esc(result.phonetic)}/</span>` : "<span>暂无音标</span>"}
        <button class="audio-btn" type="button" data-speak="${escAttr(query)}">${ICONS.speaker} 朗读</button>
      </div>
      <div class="lookup-meaning">${posMeaning(result.meaning)}</div>
      ${!exact ? `<div class="lookup-note">这个词的原形是 <strong>${esc(result.base)}</strong>，释义和音标按原形显示。</div>` : ""}
      ${example ? `
        <div class="lookup-example">
          <div class="example-label">
            <span>例句 · 点单词可继续查</span>
            <button class="small-audio" type="button" data-speak="${escAttr(example.e)}">${ICONS.speaker} 朗读</button>
          </div>
          <div class="example-en">${renderTappable(example.e)}</div>
          <div class="example-zh">${esc(example.t)}</div>
        </div>` : ""}
      <div class="lookup-actions">
        ${inCurrentBook
          ? `<button class="primary-btn" type="button" data-mark-word="${escAttr(found.entry.w)}" ${alreadyWrong ? "disabled" : ""}>${alreadyWrong ? "已在错词本" : "加入错词本"}</button>`
          : `<button class="primary-btn" type="button" data-close-sheet>知道了</button>`}
        <button class="ghost-btn" type="button" data-close-sheet>关闭</button>
      </div>
      <div class="sheet-note">音标与释义来自离线词库，仅供学习参考。练习中的题目单词会在答题后显示释义，避免提前看到答案。</div>
    `);
  }

  function markWord(word) {
    const book = currentBook();
    if (!book || !book._index || !book._index.has(word)) {
      toast("这个词不在当前词库中", true);
      return;
    }
    const progress = progressFor(book.id);
    let item = progress[word];
    if (!item) {
      item = {
        firstSeen: Date.now(),
        seen: 0,
        attempts: 0,
        correct: 0,
        wrongCount: 0,
        level: 0,
        rightStreak: 0,
        due: Date.now(),
        last: 0,
        mastered: false,
      };
      progress[word] = item;
    }
    item.wrongCount = Math.max(1, item.wrongCount || 0);
    item.mastered = false;
    item.level = 0;
    item.rightStreak = 0;
    item.due = Date.now();
    item.last = Date.now();
    saveStore();
    updateWrongDot();
    toast(`已把 ${word} 加入错词本`);
    closeSheet();
  }

  function removeWrongWord(word) {
    const book = currentBook();
    if (!book) return;
    const progress = progressFor(book.id);
    const item = progress[word];
    if (!item) return;
    item.mastered = true;
    item.wrongCount = 0;
    item.level = 5;
    item.due = Date.now() + 3650 * DAY;
    saveStore();
    renderWrong();
    updateChrome();
    toast(`已移出错词本：${word}`);
  }

  /* ---------------- handwriting ---------------- */
  function openHandwriting() {
    const session = ui.session;
    if (!session || session.answered || session.mode !== "zh2en") return;
    const entry = session.queue[session.index].word;
    openSheet(`
      ${sheetHead("手写练习", "用指尖在格子里写，写完对照答案自评")}
      <div class="hw-hint">中文提示：<strong>${esc(shortMeaning(entry.m))}</strong></div>
      <canvas class="hw-canvas" id="hwCanvas" aria-label="手写区域"></canvas>
      <div class="hw-actions">
        <button class="ghost-btn" type="button" data-hw-clear>清空</button>
        <button class="primary-btn" type="button" data-hw-reveal>写好了，看答案</button>
      </div>
      <div class="hw-answer" id="hwAnswer" hidden>
        <div class="hw-word">${esc(entry.w)}</div>
        <p>${entry.p ? `/${esc(entry.p)}/` : ""}</p>
        <div class="hw-self">
          <button class="primary-btn" type="button" data-hw-correct>我写对了</button>
          <button class="ghost-btn" type="button" data-hw-wrong>写错了</button>
        </div>
      </div>
      <div class="sheet-note">也可以直接在答题框里输入：把手机输入法切换成“手写”，就能手写答题并自动判分。</div>
    `);
    window.setTimeout(initHandwritingCanvas, 40);
  }

  function initHandwritingCanvas() {
    const canvas = $("#hwCanvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#22302a";
    ctx.lineWidth = 3.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    let drawing = false;
    let lastX = 0;
    let lastY = 0;

    const point = (event) => {
      const r = canvas.getBoundingClientRect();
      return { x: event.clientX - r.left, y: event.clientY - r.top };
    };

    canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      drawing = true;
      const p = point(event);
      lastX = p.x;
      lastY = p.y;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.1, p.y + 0.1);
      ctx.stroke();
      try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* ignore */ }
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!drawing) return;
      event.preventDefault();
      const p = point(event);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastX = p.x;
      lastY = p.y;
    });

    const stop = () => { drawing = false; };
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);
    canvas.addEventListener("pointerleave", stop);
  }

  /* ---------------- session ---------------- */
  function buildDailyQueue(book) {
    const progress = progressFor(book.id);
    const words = rangeWords(book);
    const unseen = [];
    for (const entry of words) {
      if (!progress[entry.w]) unseen.push(entry);
    }
    const dueEntries = dueWords(book)
      .slice(0, store.settings.dailyReview)
      .map(({ entry }) => entry);
    const newLimit = Math.max(0, store.settings.dailyNew - todayNew(book.id));
    const randomOrder = store.settings.order === "random";
    const freshGroups = randomOrder
      ? selectRelatedGroups(unseen, newLimit, book)
      : unseen.slice(0, newLimit).map((entry) => [entry]);
    const dueGroups = randomOrder
      ? selectRelatedGroups(dueEntries, dueEntries.length, book)
      : dueEntries.map((entry) => [entry]);
    return weaveGroups(freshGroups, dueGroups);
  }

  function pickFreeQueue(book) {
    const progress = progressFor(book.id);
    const words = rangeWords(book);
    const review = words
      .filter((entry) => progress[entry.w] && !progress[entry.w].mastered)
      .sort((a, b) => {
        const pa = progress[a.w];
        const pb = progress[b.w];
        return (pa.due || 0) - (pb.due || 0) || (pb.wrongCount || 0) - (pa.wrongCount || 0);
      });
    const unseen = words.filter((entry) => !progress[entry.w]);
    const pool = review.length ? review : unseen.length ? unseen : words;
    let picked;
    if (store.settings.order === "random") {
      picked = selectRelatedGroups(pool, 10, book).reduce((out, group) => out.concat(group), []);
    } else {
      picked = pool.slice(0, 10);
    }
    return picked.map((entry) => ({ word: entry, isNew: !progress[entry.w] }));
  }

  function startSession(mode, options = {}) {
    const book = currentBook();
    if (!book) {
      toast("词库还没有准备好", true);
      return;
    }
    if (mode !== "zh2en" && mode !== "en2zh") mode = "zh2en";

    let queue = [];
    if (Array.isArray(options.entries) && options.entries.length) {
      queue = arrangeRelated(options.entries, book).map((entry) => ({ word: entry, isNew: false }));
    } else if (options.source === "wrong") {
      const entries = wrongEntries(book).slice(0, 30).map(({ entry }) => entry);
      queue = arrangeRelated(entries, book).map((entry) => ({ word: entry, isNew: false }));
    } else if (options.source === "free") {
      queue = pickFreeQueue(book);
    } else {
      queue = buildDailyQueue(book);
      if (!queue.length) queue = pickFreeQueue(book);
    }

    if (!queue.length) {
      toast("当前范围还没有可练习的单词");
      return;
    }

    ui.session = {
      mode,
      bookId: book.id,
      queue,
      index: 0,
      attempts: 0,
      correct: 0,
      score: 0,
      startedAt: Date.now(),
      answered: false,
      finished: false,
      newCount: 0,
      wrongSet: new Set(),
      currentOptions: null,
      hintUsed: false,
    };

    const sessionEl = $("#session");
    sessionEl.hidden = false;
    document.body.classList.add("session-open");
    sessionEl.scrollTop = 0;
    updateSessionHeader();
    renderSession(true);
  }

  function updateSessionHeader() {
    const session = ui.session;
    if (!session) return;
    const book = bookById(session.bookId);
    $("#sessionBook").textContent = `${book ? book.name : "练习"} · ${MODE_LABEL[session.mode]}`;
    $("#sessionCount").textContent = `${Math.min(session.index + 1, session.queue.length)} / ${session.queue.length}`;
    $("#sessionScore").textContent = session.score;
    const completed = session.index + (session.answered ? 1 : 0);
    const pct = session.queue.length ? clamp(Math.round((completed / session.queue.length) * 100), 0, 100) : 0;
    $("#sessionBar").style.width = `${pct}%`;
  }

  function slotsHTML(word) {
    const letters = word.replace(/[^a-z]/gi, "");
    if (letters.length > 17) return `<span class="slots-many">共 ${letters.length} 个字母</span>`;
    return Array.from(word).map((char) => (
      /[a-z]/i.test(char) ? "<i></i>" : `<b>${esc(char)}</b>`
    )).join("");
  }

  function questionHTML(item) {
    const session = ui.session;
    const entry = item.word;
    const newTag = item.isNew ? `<span class="new-tag">新词</span>` : "";
    if (session.mode === "zh2en") {
      return `
        <div class="question-card">
          <div class="question-inner">
            <div class="question-kicker"><span>看中文 · 写英文</span>${newTag}</div>
            <div class="prompt-meaning">${posMeaning(entry.m)}</div>
            <div class="prompt-sub">写出对应的英文单词</div>
            <div class="prompt-tools">
              <button class="audio-btn" type="button" data-speak="${escAttr(entry.w)}">${ICONS.speaker} 听发音</button>
              <button class="ghost-chip" type="button" data-handwriting>${ICONS.pencil} 手写板</button>
            </div>
            <div class="word-slots" aria-label="共 ${entry.w.replace(/[^a-z]/gi, "").length} 个字母">${slotsHTML(entry.w)}</div>
            <input class="answer-input" id="answerInput" type="text" inputmode="text"
              autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"
              enterkeyhint="done" aria-label="输入英文单词" placeholder="输入或手写这个单词">
            <div class="answer-row">
              <button class="primary-btn" type="button" data-submit>提交</button>
              <button class="ghost-btn" type="button" data-hint>提示</button>
              <button class="ghost-btn reveal-btn" type="button" data-reveal>不会</button>
            </div>
            <div class="hint-text" id="hintText"></div>
          </div>
        </div>`;
    }

    const options = session.currentOptions || [];
    return `
      <div class="question-card">
        <div class="question-inner">
          <div class="question-kicker"><span>看英文 · 选中文</span>${newTag}</div>
          <div class="prompt-word">${esc(entry.w)}</div>
          <div class="phonetic">${entry.p ? `/${esc(entry.p)}/` : ""}</div>
          <div class="prompt-tools">
            <button class="audio-btn" type="button" data-speak="${escAttr(entry.w)}">${ICONS.speaker} 听发音</button>
            <span class="prompt-sub">选出正确的中文释义</span>
          </div>
          <div class="options">
            ${options.map((option, index) => `
              <button class="option" type="button" data-option="${index}">
                <span class="option-key">${"ABCD"[index]}</span>
                <span class="option-text">${esc(shortMeaning(option.m))}</span>
              </button>`).join("")}
          </div>
        </div>
      </div>`;
  }

  function buildOptions(entry, book) {
    const pool = (rangeWords(book).length >= 4 ? rangeWords(book) : book.words);
    const chosen = [];
    const used = new Set([entry.m]);
    let tries = 0;
    while (chosen.length < 3 && tries < 300) {
      tries += 1;
      const candidate = pool[Math.floor(Math.random() * pool.length)];
      if (!candidate || candidate.w === entry.w) continue;
      if (!candidate.m || used.has(candidate.m)) continue;
      used.add(candidate.m);
      chosen.push(candidate);
    }
    if (chosen.length < 3) {
      for (const candidate of shuffle(book.words)) {
        if (chosen.length >= 3) break;
        if (candidate.w === entry.w || used.has(candidate.m)) continue;
        used.add(candidate.m);
        chosen.push(candidate);
      }
    }
    return shuffle([entry, ...chosen]);
  }

  function renderSession(shouldSpeak = false) {
    const session = ui.session;
    if (!session) return;
    if (session.index >= session.queue.length) {
      finishSession();
      return;
    }
    const item = session.queue[session.index];
    const book = bookById(session.bookId);
    if (!book) {
      closeSession(true);
      return;
    }
    session.answered = false;
    session.currentOptions = session.mode === "en2zh" ? buildOptions(item.word, book) : null;
    session.selectedIndex = null;
    session.hintUsed = false;
    const body = $("#sessionBody");
    body.innerHTML = questionHTML(item);
    body.scrollTop = 0;
    updateSessionHeader();

    if (session.mode === "zh2en" && !isTouchDevice()) {
      setTimeout(() => {
        const input = $("#answerInput");
        if (input) input.focus({ preventScroll: true });
      }, 120);
    }
    if (shouldSpeak && store.settings.autoSpeak) {
      setTimeout(() => speak(item.word.w), 140);
    }
  }

  function isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  function submitSpelling() {
    const session = ui.session;
    if (!session || session.answered) return;
    const input = $("#answerInput");
    if (!input) return;
    const value = input.value.trim();
    if (!value) {
      toast("先写下这个单词，再提交");
      input.focus();
      return;
    }
    const entry = session.queue[session.index].word;
    handleAnswer(isCorrectAnswer(value, entry.w), value, null);
  }

  function chooseOption(index) {
    const session = ui.session;
    if (!session || session.answered || session.mode !== "en2zh") return;
    const selected = session.currentOptions[index];
    if (!selected) return;
    const entry = session.queue[session.index].word;
    handleAnswer(selected.w === entry.w, selected.m, index);
  }

  function showHint() {
    const session = ui.session;
    if (!session || session.answered) return;
    const entry = session.queue[session.index].word;
    session.hintUsed = true;
    const hint = $("#hintText");
    if (hint) {
      const pattern = Array.from(entry.w).map((char, index) => (index === 0 ? char : /[a-z]/i.test(char) ? "·" : char)).join(" ");
      hint.textContent = `提示：${pattern} · 共 ${entry.w.replace(/[^a-z]/gi, "").length} 个字母`;
    }
  }

  function revealAnswer() {
    const session = ui.session;
    if (!session || session.answered || session.mode !== "zh2en") return;
    const entry = session.queue[session.index].word;
    const input = $("#answerInput");
    if (input) {
      input.value = entry.w;
      input.disabled = true;
    }
    handleAnswer(false, "", null, true);
  }

  function handleAnswer(isCorrect, userAnswer, selectedIndex = null, revealed = false) {
    const session = ui.session;
    if (!session || session.answered) return;
    const item = session.queue[session.index];
    const entry = item.word;
    const book = bookById(session.bookId);
    if (!book) return;

    session.answered = true;
    session.selectedIndex = selectedIndex;
    session.attempts += 1;
    const today = getToday();
    today.attempts += 1;
    store.totals.attempts += 1;

    const progress = progressFor(book.id);
    const isNew = !progress[entry.w];
    let record = progress[entry.w];
    if (!record) {
      record = {
        firstSeen: Date.now(),
        seen: 0,
        attempts: 0,
        correct: 0,
        wrongCount: 0,
        level: 0,
        rightStreak: 0,
        due: Date.now(),
        last: 0,
        mastered: false,
      };
      progress[entry.w] = record;
      session.newCount += 1;
      today.newByBook[book.id] = (today.newByBook[book.id] || 0) + 1;
    }

    const now = Date.now();
    record.seen = (record.seen || 0) + 1;
    record.attempts = (record.attempts || 0) + 1;
    record.last = now;
    record.lastResult = isCorrect ? "correct" : "wrong";

    let points = 0;
    if (isCorrect) {
      record.correct = (record.correct || 0) + 1;
      record.rightStreak = (record.rightStreak || 0) + 1;
      record.level = Math.min(5, (record.level || 0) + 1);
      record.due = now + REVIEW_DAYS[record.level] * DAY;
      if (record.level >= 5) record.mastered = true;
      session.correct += 1;
      today.correct += 1;
      store.totals.correct += 1;
      points = item.retry ? 5 : 10;
      session.score += points;
    } else {
      record.wrongCount = (record.wrongCount || 0) + 1;
      record.level = 0;
      record.rightStreak = 0;
      record.mastered = false;
      record.due = now;
      session.wrongSet.add(entry.w);
      const retryCount = item.retryCount || 0;
      if (retryCount < 2) {
        const retryItem = { word: entry, isNew: false, retry: true, retryCount: retryCount + 1 };
        const position = Math.min(session.index + 3, session.queue.length);
        session.queue.splice(position, 0, retryItem);
      }
    }

    saveStore();
    updateWrongDot();
    playFeedback(isCorrect);

    if (session.mode === "zh2en") {
      const input = $("#answerInput");
      if (input) input.disabled = true;
      $$("[data-submit], [data-hint], [data-handwriting], [data-reveal]", $("#sessionBody")).forEach((el) => { el.disabled = true; });
    } else {
      const correctIndex = session.currentOptions.findIndex((option) => option.w === entry.w);
      $$(".option", $("#sessionBody")).forEach((el, index) => {
        el.disabled = true;
        if (index === correctIndex) el.classList.add("is-correct");
        else if (index === selectedIndex) el.classList.add("is-wrong");
      });
    }

    updateSessionHeader();
    renderFeedback(isCorrect, userAnswer, points, selectedIndex, isNew, revealed);
  }

  function renderFeedback(isCorrect, userAnswer, points, selectedIndex, isNew, revealed = false) {
    const session = ui.session;
    if (!session) return;
    const entry = session.queue[session.index].word;
    const card = $(".question-card", $("#sessionBody"));
    if (!card) return;

    const example = entry.e && entry.t ? `
      <div class="example-box">
        <div class="example-label">
          <span>例句 · 点单词可查</span>
          <button class="small-audio" type="button" data-speak="${escAttr(entry.e)}">${ICONS.speaker} 朗读</button>
        </div>
        <div class="example-en">${renderTappable(entry.e)}</div>
        <div class="example-zh">${esc(entry.t)}</div>
      </div>` : `
      <div class="example-box">
        <div class="example-label"><span>例句</span></div>
        <div class="example-zh">这个词暂时没有例句，先记住它的释义。</div>
      </div>`;

    const yourAnswer = !isCorrect && userAnswer
      ? `<div class="your-answer">${session.mode === "en2zh" ? "你的选择" : "你的答案"}：<s>${esc(userAnswer)}</s></div>`
      : "";

    const feedback = `
      <div class="feedback ${isCorrect ? "correct" : "wrong"}" id="feedback">
        <div class="feedback-head">
          <span class="feedback-icon">${isCorrect ? "✓" : "×"}</span>
          <span>${isCorrect ? (isNew ? "新词答对了" : "答对了") : revealed ? "看过答案，再记一遍" : "答错了，看看正确答案"}</span>
          <span class="feedback-score">${points > 0 ? `+${points}` : revealed ? "已记入错词" : "下次记住"}</span>
        </div>
        <div class="feedback-word-row">
          <button class="feedback-word tapword" type="button" data-word="${escAttr(entry.w)}">${esc(entry.w)}</button>
          ${entry.p ? `<span class="phonetic">/${esc(entry.p)}/</span>` : ""}
          <button class="mini-btn" type="button" data-speak="${escAttr(entry.w)}">${ICONS.speaker}</button>
        </div>
        <div class="feedback-meaning">${posMeaning(entry.m)}</div>
        ${yourAnswer}
        ${example}
        <div class="answer-actions">
          <button class="primary-btn" type="button" data-next>${session.index + 1 >= session.queue.length ? "查看结果" : "下一题"}</button>
        </div>
        <div class="keyboard-tip">按 <kbd>Enter</kbd> 继续</div>
      </div>`;

    card.insertAdjacentHTML("beforeend", feedback);
    const feedbackEl = $("#feedback");
    if (feedbackEl) {
      setTimeout(() => feedbackEl.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    }
    if (store.settings.autoSpeak) {
      setTimeout(() => speak(entry.w), 220);
    }
  }

  function nextQuestion() {
    const session = ui.session;
    if (!session || !session.answered) return;
    session.index += 1;
    if (session.index >= session.queue.length) {
      finishSession();
      return;
    }
    renderSession(true);
    const body = $("#sessionBody");
    if (body) body.scrollTop = 0;
  }

  function finishSession() {
    const session = ui.session;
    if (!session || session.finished) return;
    session.finished = true;
    const duration = Math.max(1, Math.round((Date.now() - session.startedAt) / 1000));
    const accuracy = session.attempts ? Math.round((session.correct / session.attempts) * 100) : 0;
    const book = bookById(session.bookId);
    const today = getToday();
    today.sessions += 1;
    today.seconds += duration;
    store.totals.sessions += 1;
    store.totals.seconds += duration;

    if (session.attempts > 0) {
      store.history.unshift({
        id: Date.now(),
        date: Date.now(),
        bookId: session.bookId,
        mode: session.mode,
        attempts: session.attempts,
        correct: session.correct,
        score: session.score,
        accuracy,
        duration,
        newCount: session.newCount,
        wrongCount: session.wrongSet.size,
        wrongWords: Array.from(session.wrongSet),
      });
      if (store.history.length > 200) store.history.length = 200;
    }
    saveStore();
    updateWrongDot();
    updateSessionHeader();

    $("#sessionBook").textContent = `${book ? book.name : "练习"} · ${MODE_LABEL[session.mode]}`;
    $("#sessionCount").textContent = `${session.attempts} 题`;
    $("#sessionBar").style.width = "100%";

    const wrongList = Array.from(session.wrongSet).slice(0, 30);
    const title = accuracy >= 90 ? "漂亮，完成！" : accuracy >= 70 ? "完成，继续保持" : "完成，再练一轮";
    const wrongChips = wrongList.map((word) => `
      <button class="result-wrong-word" type="button" data-word="${escAttr(word)}">${esc(word)}</button>`).join("");

    $("#sessionBody").innerHTML = `
      <div class="result">
        <div class="result-mark">${ICONS.spark}</div>
        <h2>${title}</h2>
        <p class="result-sub">${esc(book ? book.name : "")} · ${esc(MODE_LABEL[session.mode])}${session.newCount ? ` · 新词 ${session.newCount} 个` : ""}</p>
        <div class="result-score">${session.score}<span>分</span></div>
        <div class="result-stats">
          <div><strong>${accuracy}%</strong><small>正确率</small></div>
          <div><strong>${session.correct}/${session.attempts}</strong><small>答对 / 总题</small></div>
          <div><strong>${formatDuration(duration)}</strong><small>用时</small></div>
        </div>
        ${wrongList.length ? `
          <div class="result-wrong-list">
            <h3>这次错过的词 · 点一下查释义</h3>
            ${wrongChips}
          </div>` : ""}
        <div class="result-actions">
          ${wrongList.length
            ? `<button class="primary-btn" type="button" data-retry-wrong>只练这次错词</button>
               <button class="ghost-btn" type="button" data-again>再来一组</button>
               <button class="ghost-btn" type="button" data-close-session>返回首页</button>`
            : `<button class="primary-btn" type="button" data-again>再来一组</button>
               <button class="ghost-btn" type="button" data-close-session>返回首页</button>`}
        </div>
        <p class="tip-line">答错的词已经自动加入错词本<br>之后会优先安排复习</p>
      </div>`;
    $("#sessionBody").scrollTop = 0;
  }

  function closeSession(force = false) {
    const session = ui.session;
    if (!session) return;
    if (!force && !session.finished && session.attempts > 0) {
      if (!confirm("退出本次练习？已答的题目会计入今日统计，但不会生成完整记录。")) return;
    }
    stopSpeaking();
    ui.session = null;
    $("#session").hidden = true;
    document.body.classList.remove("session-open");
    renderCurrent();
  }

  function retryWrongWords() {
    const session = ui.session;
    if (!session) return;
    const book = bookById(session.bookId);
    if (!book) return;
    const entries = Array.from(session.wrongSet)
      .map((word) => book.words[book._index.get(word)])
      .filter(Boolean);
    if (!entries.length) {
      toast("这次没有错词");
      return;
    }
    const mode = session.mode;
    startSession(mode, { entries });
  }

  function againSession() {
    const session = ui.session;
    if (!session) return;
    const mode = session.mode;
    startSession(mode);
  }

  /* ---------------- boot & events ---------------- */
  function hideSplash() {
    const splash = $("#splash");
    if (!splash) return;
    splash.classList.add("is-hidden");
    setTimeout(() => splash.remove(), 700);
  }

  function renderFatal(message) {
    const splash = $("#splash");
    if (!splash) {
      document.body.innerHTML = `<div class="noscript">${esc(message)}</div>`;
      return;
    }
    splash.hidden = false;
    splash.classList.remove("is-hidden");
    splash.innerHTML = `
      <img src="icons/icon-192.png" alt="" width="76" height="76">
      <div class="splash-brand">词听</div>
      <p style="max-width:310px;text-align:center;line-height:1.7">${esc(message)}</p>
      <button class="primary-btn" style="width:auto;min-height:44px;padding:10px 22px;margin-top:8px" type="button" data-retry>重新加载</button>
      <button class="text-btn" type="button" data-install-help style="font-size:12px">安装 / 打开说明</button>
    `;
  }

  async function init() {
    try {
      if (location.protocol === "file:") {
        // Some mobile browsers allow local file access, others do not. Try anyway,
        // but make the failure message useful.
        $("#splashText").textContent = "正在读取本地词库…";
      }
      await loadMeta();
      if (!state.meta.books.some((book) => book.id === store.settings.bookId)) {
        store.settings.bookId = state.meta.books[0].id;
        saveStore();
      }
      await loadBook(store.settings.bookId);
      hideSplash();
      updateChrome();
      renderHome();
      prewarmRelations(currentBook());

      loadDict().catch((error) => console.warn("Dictionary will load on demand", error));
      registerServiceWorker();

      const params = new URLSearchParams(location.search);
      const mode = params.get("mode");
      if (mode === "zh2en" || mode === "en2zh") {
        history.replaceState(null, "", location.pathname + location.hash);
        setTimeout(() => startSession(mode), 420);
      }
    } catch (error) {
      console.error(error);
      let message = "词库加载失败，请检查页面文件是否完整。";
      if (location.protocol === "file:") {
        message = "浏览器不允许直接打开本地文件读取词库。请用本地服务器打开，或把项目托管到 GitLab Pages / GitHub Pages 后再使用。";
      } else if (!navigator.onLine) {
        message = "第一次打开需要联网加载词库。联网完成一次后，就可以完全离线使用。";
      }
      renderFatal(message);
    }
  }

  async function registerServiceWorker() {
    if (location.protocol === "file:" || !("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register("sw.js", { scope: "./" });
      navigator.serviceWorker.ready.then(() => {
        ui.swReady = true;
        if (ui.tab === "settings") renderSettings();
        if (!sessionStorage.getItem("citing.swNotified")) {
          sessionStorage.setItem("citing.swNotified", "1");
          setTimeout(() => toast("离线词库已就绪，断网也能使用"), 1400);
        }
      });
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            toast("新版本已准备好，重新打开后生效");
          }
        });
      });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && !ui.swReady) {
          navigator.serviceWorker.ready.then(() => {
            ui.swReady = true;
            if (ui.tab === "settings") renderSettings();
          }).catch(() => {});
        }
      });
    } catch (error) {
      console.warn("Service worker registration failed", error);
    }
  }

  function bindEvents() {
    $("#brandHome").addEventListener("click", () => switchTab("home"));

    $("#topAction").addEventListener("click", () => {
      if (ui.tab === "settings") switchTab("home");
      else switchTab("settings");
    });

    $$(".tab").forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    $("#sessionClose").addEventListener("click", () => closeSession());
    $("#backdrop").addEventListener("click", closeSheet);

    $("#view").addEventListener("click", (event) => {
      const target = event.target;
      const bookButton = target.closest("[data-book]");
      if (bookButton) {
        selectBook(bookButton.dataset.book);
        return;
      }
      const rangeButton = target.closest("[data-open-range]");
      if (rangeButton) {
        openRangeSheet();
        return;
      }
      const modeButton = target.closest("[data-mode]");
      if (modeButton) {
        startSession(modeButton.dataset.mode);
        return;
      }
      if (target.closest("[data-go-wrong]")) {
        switchTab("wrong");
        return;
      }
      if (target.closest("[data-go-home]")) {
        switchTab("home");
        return;
      }
      if (target.closest("[data-new-sentence]")) {
        ui.sentenceSeed += 1;
        renderHome();
        return;
      }
      const wrongMode = target.closest("[data-wrong-mode]");
      if (wrongMode) {
        startSession(wrongMode.dataset.wrongMode, { source: "wrong" });
        return;
      }
      const removeButton = target.closest("[data-remove-word]");
      if (removeButton) {
        removeWrongWord(removeButton.dataset.removeWord);
        return;
      }
      const settingButton = target.closest("[data-setting]");
      if (settingButton) {
        const key = settingButton.dataset.setting;
        const value = settingButton.dataset.value;
        if (key === "dailyNew") store.settings.dailyNew = clamp(parseInt(value, 10) || 20, 5, 100);
        else if (key === "dailyReview") store.settings.dailyReview = clamp(parseInt(value, 10) || 20, 0, 100);
        else if (key === "accent") store.settings.accent = value === "uk" ? "uk" : "us";
        else if (key === "order") store.settings.order = value === "sequence" ? "sequence" : "random";
        saveStore();
        renderSettings();
        if (key === "order" && store.settings.order === "random") prewarmRelations(currentBook());
        return;
      }
      const toggle = target.closest("[data-toggle]");
      if (toggle) {
        const key = toggle.dataset.toggle;
        if (key === "autoSpeak") store.settings.autoSpeak = !store.settings.autoSpeak;
        else if (key === "sound") store.settings.sound = !store.settings.sound;
        saveStore();
        renderSettings();
        return;
      }
      const actionButton = target.closest("[data-action]");
      if (actionButton) {
        const action = actionButton.dataset.action;
        if (action === "install") triggerInstall();
        else if (action === "dismiss-install") {
          store.settings.installHintDismissed = true;
          saveStore();
          renderHome();
        } else if (action === "export") exportData();
        else if (action === "import") importData();
        else if (action === "reset") resetData();
        else if (action === "sound-preview") previewFeedbackSound();
        else if (action === "update") checkUpdate();
        return;
      }
    });

    $("#sessionBody").addEventListener("click", (event) => {
      const target = event.target;
      if (target.closest("[data-submit]")) {
        submitSpelling();
        return;
      }
      if (target.closest("[data-next]")) {
        nextQuestion();
        return;
      }
      const option = target.closest("[data-option]");
      if (option) {
        chooseOption(parseInt(option.dataset.option, 10));
        return;
      }
      if (target.closest("[data-hint]")) {
        showHint();
        return;
      }
      if (target.closest("[data-reveal]")) {
        revealAnswer();
        return;
      }
      if (target.closest("[data-handwriting]")) {
        openHandwriting();
        return;
      }
      if (target.closest("[data-retry-wrong]")) {
        retryWrongWords();
        return;
      }
      if (target.closest("[data-again]")) {
        againSession();
        return;
      }
      if (target.closest("[data-close-session]")) {
        ui.tab = "home";
        closeSession();
      }
    });

    $("#sessionBody").addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const session = ui.session;
      if (!session) return;
      if (session.answered) {
        event.preventDefault();
        nextQuestion();
        return;
      }
      if (event.target && event.target.id === "answerInput") {
        event.preventDefault();
        submitSpelling();
      }
    });

    $("#sheetContent").addEventListener("click", (event) => {
      const target = event.target;
      if (target.closest("[data-close-sheet]")) {
        closeSheet();
        return;
      }
      const bookButton = target.closest("[data-book-select]");
      if (bookButton) {
        selectBook(bookButton.dataset.bookSelect);
        return;
      }
      const rangeButton = target.closest("[data-range-start]");
      if (rangeButton) {
        selectRange(parseInt(rangeButton.dataset.rangeStart, 10), parseInt(rangeButton.dataset.rangeEnd, 10));
        return;
      }
      const markButton = target.closest("[data-mark-word]");
      if (markButton) {
        markWord(markButton.dataset.markWord);
        return;
      }
      if (target.closest("[data-hw-clear]")) {
        const canvas = $("#hwCanvas");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        return;
      }
      if (target.closest("[data-hw-reveal]")) {
        const answer = $("#hwAnswer");
        const reveal = target.closest("[data-hw-reveal]");
        if (answer) answer.hidden = false;
        if (reveal) reveal.hidden = true;
        return;
      }
      if (target.closest("[data-hw-correct]")) {
        closeSheet();
        handleAnswer(true, "手写", null);
        return;
      }
      if (target.closest("[data-hw-wrong]")) {
        closeSheet();
        handleAnswer(false, "手写", null);
      }
    });

    document.addEventListener("click", (event) => {
      const speechButton = event.target.closest("[data-speak]");
      if (speechButton) {
        event.preventDefault();
        speak(speechButton.dataset.speak);
        return;
      }
      const wordButton = event.target.closest(".tapword, [data-word]");
      if (wordButton) {
        event.preventDefault();
        openWordSheet(wordButton.dataset.word);
        return;
      }
      if (event.target.closest("[data-retry]")) {
        location.reload();
        return;
      }
      if (event.target.closest("[data-install-help]")) {
        openInstallHelp();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (ui.sheetOpen) {
          closeSheet();
          return;
        }
        if (ui.session) closeSession();
        return;
      }
      if (ui.sheetOpen) return;
      const session = ui.session;
      if (!session) return;
      if (event.key === "Enter" && session.answered) {
        event.preventDefault();
        nextQuestion();
        return;
      }
      if (!session.answered && session.mode === "en2zh" && /^[1-4]$/.test(event.key)) {
        event.preventDefault();
        chooseOption(parseInt(event.key, 10) - 1);
      }
    });

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      ui.deferredPrompt = event;
      if (ui.tab === "home" || ui.tab === "settings") renderCurrent();
    });

    window.addEventListener("appinstalled", () => {
      ui.deferredPrompt = null;
      store.settings.installHintDismissed = true;
      saveStore();
      toast("已安装到主屏幕");
      renderCurrent();
    });

    window.addEventListener("online", () => {
      if (ui.tab === "settings") renderSettings();
    });
    window.addEventListener("offline", () => {
      if (ui.tab === "settings") renderSettings();
    });
  }

  bindEvents();
  init();
})();
