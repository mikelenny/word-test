/* 词听 · offline vocabulary dictation */
(() => {
  "use strict";

  const APP_VERSION = "1.5.6";
  const STORAGE_KEY = "citing.state.v1";
  const UPLOAD_KEY = "citing.upload.v1";
  const UPLOAD_BOOK_ID = "upload";
  const DAY = 24 * 60 * 60 * 1000;
  const REVIEW_DAYS = [0, 1, 2, 4, 7, 15, 30];

  // 词库层级：数字越小越基础。一个词同时出现在多个词库时，只显示最基础的归属。
  const LIBRARY_LEVELS = [
    { id: "gaokao", short: "高考", name: "高考 3500", color: "#2f6b50", bit: 1 },
    { id: "cet4", short: "四级", name: "四级词汇", color: "#3f5f8a", bit: 2 },
    { id: "ielts", short: "雅思", name: "雅思核心", color: "#b45a35", bit: 4 },
    { id: "kaoyan", short: "考研", name: "考研词汇", color: "#70508e", bit: 8 },
  ];
  const LIBRARY_BY_ID = Object.fromEntries(LIBRARY_LEVELS.map((item) => [item.id, item]));
  const UPLOAD_MAX_WORDS = 3000;

  // 试卷里大量出现冠词、介词和代词；这些不是要背的“词汇”。
  const UPLOAD_STOPWORDS = new Set(`
    a an the and or but if of to in on at for with from by as
    is am are was were be been being do does did have has had
    will would can could may might must shall should
    i you he she it we they me him her us them my your his its our their
    this that these those there here who whom whose which what when where why how
    not no yes so very too also only just more most some any all each every
    both other another such own same one two three four five six seven eight nine ten
    than then up down out off over under about into onto upon
  `.trim().split(/\s+/));
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
    plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
    minus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>`,
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
    bookPromises: {},
    wordIndex: null,
    wordIndexPromise: null,
    upload: loadUpload(),
    pdfjsPromise: null,
  };

  const ui = {
    tab: "home",
    session: null,
    sheetOpen: false,
    sheetTimer: 0,
    lookupToken: 0,
    deferredPrompt: null,
    swReady: false,
    offlineReady: false,
    offlineProgress: 0,
    offlineTotal: 6,
    bookLoading: false,
    bookError: "",
    bookPromise: null,
    sentenceSeed: 0,
    lastFocus: null,
    uploadBusy: false,
    uploadInput: null,
    uploadDraft: null,
    uploadDrag: null,
    uploadSuppressClick: 0,
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

  // 完形填空的原句里保留空格标记，只是把它标出来，方便对上原题。
  function renderPaperExample(text) {
    return renderTappable(text).replace(
      /_{2,}\s*\d{1,3}\s*_{2,}|_{2,}\s*\d{1,3}\b|\b\d{1,3}\s*_{2,}/g,
      (mark) => `<span class="cloze-gap">${mark}</span>`
    );
  }

  // 朗读用：把当前这个词填进第一个空格，其余空格去掉，免得读出“下划线”。
  function fillClozeGap(text, word) {
    const gap = /_{2,}\s*\d{1,3}\s*_{2,}|_{2,}\s*\d{1,3}\b|\b\d{1,3}\s*_{2,}|\(\s*\d{1,3}\s*\)/g;
    let used = false;
    return String(text || "")
      .replace(gap, () => {
        if (used) return "";
        used = true;
        return word || "";
      })
      .replace(/\s{2,}/g, " ")
      .trim();
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
      settings.voiceURI = typeof settings.voiceURI === "string" ? settings.voiceURI : "";
      if (typeof settings.softKeyboard !== "boolean") settings.softKeyboard = isTouchDevice();
      settings.soundVolume = [0.7, 1, 1.5].includes(Number(settings.soundVolume)) ? Number(settings.soundVolume) : 1.5;
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
        voiceURI: "",
        autoSpeak: false,
        order: "random",
        sound: true,
        softKeyboard: isTouchDevice(),
        soundVolume: 1.5,
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

  /* ---------------- uploaded vocabulary ---------------- */
  function loadUpload() {
    try {
      const raw = JSON.parse(localStorage.getItem(UPLOAD_KEY) || "null");
      if (!raw || typeof raw !== "object" || !Array.isArray(raw.words)) return null;
      const words = raw.words
        .filter((entry) => entry && typeof entry.w === "string" && entry.w)
        .map((entry) => ({
          ...entry,
          w: entry.w.toLowerCase(),
          m: entry.m || "暂无释义",
          p: entry.p || "",
          beyond: Boolean(entry.beyond),
          freq: Number(entry.freq) || 1,
        }));
      if (!words.length) return null;
      return {
        version: 1,
        createdAt: raw.createdAt || Date.now(),
        updatedAt: raw.updatedAt || raw.createdAt || Date.now(),
        files: Array.isArray(raw.files) ? raw.files.slice(0, 20) : [],
        words,
      };
    } catch (error) {
      console.warn("Failed to load uploaded vocabulary", error);
      return null;
    }
  }

  function saveUpload(upload) {
    try {
      localStorage.setItem(UPLOAD_KEY, JSON.stringify(upload));
    } catch (error) {
      console.warn("Failed to save uploaded vocabulary", error);
      throw new Error("保存失败：设备存储空间可能已满，请先清理一些数据。");
    }
  }

  function uploadStats(upload = state.upload) {
    let gaokao = 0;
    let beyond = 0;
    const libraries = {};
    for (const entry of (upload && upload.words) || []) {
      if (entry.beyond) beyond += 1;
      else gaokao += 1;
      const library = affiliationFor(entry.w, entry);
      if (library) libraries[library.id] = (libraries[library.id] || 0) + 1;
    }
    return { total: gaokao + beyond, gaokao, beyond, libraries };
  }

  function uploadSummaryHTML(stats) {
    const items = [[stats.total, "累计词汇"]];
    for (const library of LIBRARY_LEVELS) {
      if (stats.libraries[library.id]) items.push([stats.libraries[library.id], library.short]);
    }
    return `
      <div class="upload-summary">
        ${items.map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("")}
      </div>`;
  }

  function uploadMeta(upload) {
    const stats = uploadStats(upload);
    const fileName = upload && upload.files && upload.files[0] ? upload.files[0].name : "";
    return {
      id: UPLOAD_BOOK_ID,
      name: "个人词汇",
      short: "个人",
      subtitle: "自己收进来的词",
      description: fileName ? `${fileName} · ${stats.total} 词` : `${stats.total} 词`,
      color: "#8a6a3b",
      count: stats.total,
      uploaded: true,
    };
  }

  // 把“个人词汇”放在学习范围最前面，和普通词库共用同一套练习逻辑。
  function syncUploadBookMeta() {
    if (!state.meta || !Array.isArray(state.meta.books)) return;
    const books = state.meta.books.filter((book) => book.id !== UPLOAD_BOOK_ID);
    if (state.upload && state.upload.words.length) books.unshift(uploadMeta(state.upload));
    state.meta.books = books;
  }

  function invalidateUploadBook() {
    delete state.books[UPLOAD_BOOK_ID];
    delete state.bookPromises[UPLOAD_BOOK_ID];
  }

  function lowestLibrary(mask) {
    if (!mask) return null;
    for (const library of LIBRARY_LEVELS) {
      if (mask & library.bit) return library;
    }
    return null;
  }

  function affiliationFor(word, entry = null) {
    if (entry && entry.lib && LIBRARY_BY_ID[entry.lib]) return LIBRARY_BY_ID[entry.lib];
    const key = String(word || "").toLowerCase();
    const mask = state.wordIndex ? state.wordIndex[key] : 0;
    const found = lowestLibrary(mask);
    if (found) return found;
    const book = currentBook();
    return book && LIBRARY_BY_ID[book.id] ? LIBRARY_BY_ID[book.id] : null;
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
  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function fetchJSON(path, options = {}) {
    const attempts = options.attempts || 3;
    const timeout = options.timeout || 20000;
    let lastError = new Error(`加载失败：${path}`);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? window.setTimeout(() => controller.abort(), timeout) : 0;
      try {
        // 重试时加时间戳，绕过可能已经损坏的 HTTP / Service Worker 缓存。
        const url = attempt === 0 ? path : `${path}${path.includes("?") ? "&" : "?"}retry=${Date.now()}`;
        const response = await fetch(url, {
          cache: "no-cache",
          signal: controller ? controller.signal : undefined,
        });
        if (!response.ok) throw new Error(`${response.status} ${path}`);
        return await response.json();
      } catch (error) {
        lastError = error;
        if (attempt < attempts - 1) await wait(700 * (attempt + 1));
      } finally {
        if (timer) window.clearTimeout(timer);
      }
    }
    throw lastError;
  }

  async function loadMeta() {
    state.meta = await fetchJSON("data/meta.json", { timeout: 12000, attempts: 3 });
    if (!state.meta || !Array.isArray(state.meta.books) || !state.meta.books.length) {
      throw new Error("词库元数据无效");
    }
    syncUploadBookMeta();
  }

  function loadWordIndex() {
    if (state.wordIndex) return Promise.resolve(state.wordIndex);
    if (!state.wordIndexPromise) {
      state.wordIndexPromise = fetchJSON("data/word-index.json", { timeout: 15000, attempts: 3 })
        .then((data) => {
          state.wordIndex = data && typeof data === "object" ? data : {};
          return state.wordIndex;
        })
        .catch((error) => {
          state.wordIndexPromise = null;
          throw error;
        });
    }
    return state.wordIndexPromise;
  }

  // word-index.json 是四套词库的合并索引；如果旧缓存里没有这个文件，
  // 就退回到逐本加载词库来建立索引。
  async function ensureWordIndex() {
    try {
      return await loadWordIndex();
    } catch (error) {
      console.warn("Word index unavailable, building from books", error);
      const books = await Promise.all(LIBRARY_LEVELS.map((library) => ensureBook(library.id)));
      const index = {};
      for (const library of LIBRARY_LEVELS) {
        const book = books.find((item) => item.id === library.id);
        if (!book) continue;
        for (const entry of book.words) {
          const key = entry.w.toLowerCase();
          index[key] = (index[key] || 0) | library.bit;
        }
      }
      state.wordIndex = index;
      return index;
    }
  }

  async function loadBook(id) {
    if (state.books[id]) return state.books[id];
    if (id === UPLOAD_BOOK_ID) {
      if (!state.upload || !state.upload.words.length) throw new Error("个人词汇还是空的");
      const meta = state.meta.books.find((book) => book.id === UPLOAD_BOOK_ID);
      const data = {
        id: UPLOAD_BOOK_ID,
        name: meta ? meta.name : "个人词汇",
        color: meta ? meta.color : "#8a6a3b",
        words: state.upload.words,
        _index: new Map(state.upload.words.map((entry, index) => [entry.w, index])),
        _examples: state.upload.words.filter((entry) => entry.e && !entry.cn),
      };
      state.books[UPLOAD_BOOK_ID] = data;
      return data;
    }
    const meta = state.meta.books.find((book) => book.id === id);
    if (!meta) throw new Error("没有找到这个词库");
    const data = await fetchJSON(`data/books/${id}.json`, { timeout: 30000, attempts: 3 });
    if (!data || !Array.isArray(data.words) || !data.words.length) {
      throw new Error("词库内容为空");
    }
    data.id = id;
    data.name = meta.name;
    data.color = meta.color;
    data._index = new Map(data.words.map((entry, index) => [entry.w, index]));
    data._examples = data.words.filter((entry) => entry.e);
    state.books[id] = data;
    return data;
  }

  function ensureBook(id) {
    if (state.books[id]) return Promise.resolve(state.books[id]);
    if (!state.bookPromises[id]) {
      state.bookPromises[id] = loadBook(id).finally(() => {
        delete state.bookPromises[id];
      });
    }
    return state.bookPromises[id];
  }

  function ensureCurrentBook() {
    const id = store.settings.bookId;
    if (state.books[id]) return Promise.resolve(state.books[id]);
    if (state.bookPromises[id]) return state.bookPromises[id];
    ui.bookLoading = true;
    ui.bookError = "";
    renderCurrent();
    const promise = ensureBook(id)
      .then((book) => {
        ui.bookLoading = false;
        ui.bookError = "";
        if (store.settings.bookId === id) {
          renderCurrent();
          prewarmRelations(book);
        }
        return book;
      })
      .catch((error) => {
        ui.bookLoading = false;
        ui.bookError = error && error.message ? error.message : "词库加载失败";
        renderCurrent();
        throw error;
      })
      .finally(() => {
        ui.bookLoading = false;
      });
    return promise;
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
  let speechErrorShown = false;

  // 优先使用系统里听起来更自然的英语语音；避免 Apple 的搞怪语音。
  const PREFERRED_VOICE = /(samantha|alex|ava|allie|susan|tom|karen|daniel|serena|moira|tessa|fiona|victoria|google us english|google uk english|microsoft (aria|jenny|guy|zira|david|mark|libby|sonia|ryan|natasha))/i;
  const NOVELTY_VOICE = /(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|grandma|grandpa|rocko|shelley|sandy|flo|eddy|reed|junior|ralph|kathy|princess)/i;

  function loadVoices() {
    if (!("speechSynthesis" in window)) return;
    try {
      voices = window.speechSynthesis.getVoices() || [];
      if (voices.length) voicesLoaded = true;
    } catch (error) {
      voices = [];
    }
  }

  function voiceLang(voice) {
    return String((voice && voice.lang) || "").toLowerCase().replace(/_/g, "-");
  }

  function voiceKey(voice) {
    if (!voice) return "";
    return voice.voiceURI || `${voice.name || ""}|${voice.lang || ""}`;
  }

  function voiceLabel(voice) {
    const name = String(voice.name || "英语语音").replace(/\s*\((?:en[-_][A-Z]{2})\)\s*$/i, "");
    const lang = String(voice.lang || "").replace("_", "-");
    return lang ? `${name} · ${lang}` : name;
  }

  function speechVoiceScore(voice, accent) {
    const lang = voiceLang(voice);
    const target = String(accent || "").toLowerCase();
    if (!/^en(?:-|$)/.test(lang)) return -1000;
    let score = 0;
    if (lang === target) score += 80;
    else if (lang.slice(0, 2) === target.slice(0, 2)) score += 40;
    else score += 10;
    if (voice.localService) score += 25;
    const name = String(voice.name || "");
    if (/(enhanced|premium|natural|neural)/i.test(name)) score += 35;
    if (PREFERRED_VOICE.test(name)) score += 30;
    if (NOVELTY_VOICE.test(name)) score -= 200;
    if (/compact/i.test(name)) score -= 8;
    return score;
  }

  function englishVoices() {
    loadVoices();
    return voices
      .filter((voice) => /^en(?:-|_|$)/i.test(String(voice.lang || "")))
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }

  function pickSpeechVoice(accent) {
    const list = englishVoices();
    if (!list.length) return null;
    const saved = store.settings.voiceURI;
    if (saved) {
      const chosen = list.find((voice) => voiceKey(voice) === saved)
        || list.find((voice) => voice.voiceURI === saved)
        || list.find((voice) => `${voice.name || ""}|${voice.lang || ""}` === saved);
      if (chosen) return chosen;
    }
    const chosen = list.slice().sort((a, b) => speechVoiceScore(b, accent) - speechVoiceScore(a, accent))[0];
    return chosen;
  }

  function voiceOptionsHTML() {
    const current = store.settings.voiceURI || "";
    const list = englishVoices().filter((voice) => !NOVELTY_VOICE.test(String(voice.name || "")) || voiceKey(voice) === current);
    const options = list.map((voice) => {
      const key = voiceKey(voice);
      return `<option value="${escAttr(key)}" ${key === current ? "selected" : ""}>${esc(voiceLabel(voice))}</option>`;
    }).join("");
    return `<option value="" ${current ? "" : "selected"}>系统推荐</option>${options}`;
  }

  if ("speechSynthesis" in window) {
    loadVoices();
    // Safari 早期版本只支持 onvoiceschanged，同时保留 addEventListener 兼容。
    try { window.speechSynthesis.addEventListener("voiceschanged", loadVoices); } catch (error) { /* ignore */ }
    try { window.speechSynthesis.onvoiceschanged = loadVoices; } catch (error) { /* ignore */ }
    [0, 250, 800, 1800, 3500, 6000].forEach((delay) => setTimeout(loadVoices, delay));
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
      utterance.rate = options.rate || 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      const voice = pickSpeechVoice(accent);
      if (voice) {
        utterance.voice = voice;
        // 用户选了不同口音的语音时，以语音自身的语言为准。
        if (voice.lang) utterance.lang = voice.lang;
      }
      utterance.onerror = (event) => {
        const reason = event && event.error ? event.error : "unknown";
        // 自动发音不是用户手势，Safari 会返回 not-allowed；不要因此误报“没有语音包”。
        if (reason === "canceled" || reason === "interrupted" || reason === "not-allowed") return;
        console.warn("Speech error", reason);
        if (!speechErrorShown) {
          speechErrorShown = true;
          toast("语音没有播放出来：请检查媒体音量，或在系统设置中安装英语语音", true);
        }
      };
      window.speechSynthesis.speak(utterance);
      // 不把 getVoices() 为空当成“没有语音包”。iOS 往往要等第一次 speak 后
      // 才会返回语音列表，但系统默认语音此时已经可以正常朗读。
      window.setTimeout(loadVoices, 300);
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

  function feedbackOutput(ctx) {
    const master = ctx.createGain();
    master.gain.value = Number(store.settings.soundVolume) || 1.5;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-20, ctx.currentTime);
    compressor.knee.setValueAtTime(24, ctx.currentTime);
    compressor.ratio.setValueAtTime(5, ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    compressor.release.setValueAtTime(0.22, ctx.currentTime);
    master.connect(compressor);
    compressor.connect(ctx.destination);
    return master;
  }

  function scheduleCorrectCue(ctx, start, output) {
    [
      { freq: 1046.5, offset: 0, duration: 0.24, volume: 0.52 },
      { freq: 1568, offset: 0.08, duration: 0.34, volume: 0.42 },
      { freq: 2093, offset: 0.08, duration: 0.2, volume: 0.08 },
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
      gain.connect(output);
      osc.start(at);
      osc.stop(at + duration + 0.02);
    });
  }

  function scheduleNoise(ctx, start, output) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * 0.075));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const fade = Math.pow(1 - i / length, 3);
      data[i] = (Math.random() * 2 - 1) * fade;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    source.start(start);
    source.stop(start + 0.09);
  }

  function scheduleWrongCue(ctx, start, output) {
    [
      { type: "sine", from: 260, to: 82, volume: 0.62, duration: 0.4 },
      { type: "triangle", from: 520, to: 190, volume: 0.2, duration: 0.27 },
    ].forEach(({ type, from, to, volume, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, start);
      osc.frequency.exponentialRampToValueAtTime(to, start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration + 0.03);
      osc.connect(gain);
      gain.connect(output);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    });
    scheduleNoise(ctx, start, output);
  }

  function playFeedback(isCorrect, force = false) {
    if (!force && !store.settings.sound) return;
    const ctx = feedbackAudioContext();
    if (!ctx) return;
    const start = () => {
      try {
        const output = feedbackOutput(ctx);
        if (isCorrect) scheduleCorrectCue(ctx, ctx.currentTime + 0.015, output);
        else scheduleWrongCue(ctx, ctx.currentTime + 0.015, output);
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
    sheet.classList.toggle("is-max", options.maximized === true);
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
    sheet.classList.remove("is-max");
    backdrop.classList.remove("is-open");
    ui.sheetOpen = false;
    document.body.classList.remove("sheet-open");
    ui.sheetTimer = window.setTimeout(() => {
      sheet.hidden = true;
      backdrop.hidden = true;
      $("#sheetContent").innerHTML = "";
    }, 290);
    ui.lookupToken += 1;
    ui.uploadDraft = null;
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
    const upload = $("#topUpload");

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

    if (upload) {
      upload.innerHTML = ICONS.upload;
      upload.hidden = ui.tab === "settings";
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
  function renderBookGate(scope = "home") {
    const meta = state.meta && state.meta.books.find((item) => item.id === store.settings.bookId);
    const name = meta ? meta.name : "当前词库";
    const isWrong = scope === "wrong";
    if (ui.bookError) {
      $("#view").innerHTML = `
        <div class="page-head">
          <div><h2>${isWrong ? "错词本" : "词听"}</h2><p>${esc(name)} · 加载失败</p></div>
        </div>
        <div class="book-gate is-error">
          <div class="book-gate-icon">!</div>
          <h3>词库没有下载完成</h3>
          <p>可能是网络中断，或浏览器缓存了旧文件。请保持联网后重试。</p>
          <p class="book-gate-detail">${esc(ui.bookError)}</p>
          <button class="primary-btn" type="button" data-retry-book>重新加载词库</button>
          <button class="ghost-btn" type="button" data-action="install-help">查看安装说明</button>
        </div>`;
      return;
    }
    $("#view").innerHTML = `
      <div class="page-head">
        <div><h2>${isWrong ? "错词本" : "词听"}</h2><p>${esc(name)} · 正在准备</p></div>
      </div>
      <div class="book-gate">
        <div class="book-gate-spinner" aria-hidden="true"></div>
        <h3>正在加载 ${esc(name)}</h3>
        <p>第一次需要下载词库文件，网络较慢时会自动重试。</p>
        <p class="book-gate-detail">下载完成后会自动进入，不需要一直停在启动页。</p>
      </div>`;
  }

  function renderHome() {
    const book = currentBook();
    if (!book) {
      renderBookGate("home");
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
    const hasExample = Boolean(sentenceEntry && sentenceEntry.e && !sentenceEntry.cn);
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
        ${state.upload && state.upload.words.length
          ? `<button class="mini-btn danger" type="button" data-delete-upload>${ICONS.trash} 清空个人词汇</button>`
          : `<span class="sub">${esc(book.subtitle)}</span>`}
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
          <div class="sentence-zh">${sentenceEntry.t ? esc(sentenceEntry.t) : "— 来自试卷原文"}</div>
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
    if (!book) {
      renderBookGate("wrong");
      return;
    }
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
    const swText = ui.offlineReady
      ? "全部词库已离线缓存，断网也能查词"
      : ui.offlineProgress
        ? `正在后台缓存词库 ${ui.offlineProgress}/${ui.offlineTotal}`
        : "正在准备离线缓存，可以继续背单词";
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
        <div class="settings-title">个人词汇</div>
        <div class="setting-row">
          <div class="setting-copy">
            <strong>个人词汇</strong>
            <small>${state.upload
              ? `${uploadStats().total} 词 · 答题时点「加入个人词汇」或上传试卷都能加进来`
              : "答题时点「加入个人词汇」，或上传试卷批量提取"}</small>
          </div>
          <div class="data-actions">
            ${state.upload ? `<button class="mini-btn" type="button" data-action="manage-upload">查看</button>` : ""}
            <button class="mini-btn" type="button" data-action="upload-file">${ICONS.upload} 上传试卷</button>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-title">输入</div>
        <div class="setting-row">
          <div class="setting-copy"><strong>内置软键盘</strong><small>手机上不再弹出系统键盘，避免联想和自动改词</small></div>
          <button type="button" class="switch ${store.settings.softKeyboard ? "is-on" : ""}" role="switch" aria-checked="${store.settings.softKeyboard}" data-toggle="softKeyboard" aria-label="内置软键盘"></button>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>手写识别</strong><small>在答题卡里写印刷体，每格一个字母，自动判分</small></div>
          <span class="pill green">实验</span>
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
          <div class="setting-copy"><strong>朗读语音</strong><small>觉得声音怪时，换一个系统英语语音</small></div>
          <div class="voice-picker">
            <select class="voice-select" data-setting-select="voice" aria-label="朗读语音">
              ${voiceOptionsHTML()}
            </select>
            <button class="mini-btn" type="button" data-action="voice-preview">试听</button>
            <button class="mini-btn" type="button" data-action="refresh-voices" aria-label="刷新语音列表">刷新</button>
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
          <div class="setting-copy"><strong>音效音量</strong><small>手机媒体音量也会影响实际响度</small></div>
          <div class="segmented" role="group" aria-label="答题音效音量">
            ${[[0.7, "小"], [1, "中"], [1.5, "大"]].map(([value, label]) => `
              <button type="button" data-setting="soundVolume" data-value="${value}" class="${Number(store.settings.soundVolume) === value ? "is-active" : ""}">${label}</button>`).join("")}
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>语音测试</strong><small>第一次请点一下，让浏览器启用系统语音</small></div>
          <button class="mini-btn" type="button" data-speak="vocabulary">${ICONS.speaker} 读一下</button>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-title">数据</div>
        <div class="setting-row">
          <div class="setting-copy"><strong>数据导入导出</strong><small>个人词汇、错词、学习记录，可选范围</small></div>
          <button class="mini-btn" type="button" data-action="data-transfer">${ICONS.download} 导入导出</button>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>清空记录</strong><small>删除进度、错词本和全部历史</small></div>
          <button class="mini-btn danger" type="button" data-action="reset">${ICONS.trash} 清空</button>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-title">离线与更新</div>
        <div class="setting-row">
          <div class="setting-copy"><strong>离线词库</strong><small>${esc(swText)}</small></div>
          <div class="data-actions">
            ${ui.offlineReady ? "" : `<button class="mini-btn" type="button" data-action="cache-offline">立即缓存</button>`}
            <span class="pill ${ui.offlineReady ? "green" : "amber"}">${ui.offlineReady ? "已就绪" : "缓存中"}</span>
          </div>
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
        <p>发音调用手机系统自带的英语语音，不需要联网。第一次请先在“语音测试”点一下“读一下”；如果仍没声音，再检查媒体音量或安装英语语音。</p>
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

  /* ---------------- 数据导入导出（可选范围） ---------------- */
  const DATA_SCOPES = [
    { id: "personal", label: "个人词汇", hint: "收进来的词，带音标、释义和例句" },
    { id: "wrong", label: "错词", hint: "答错还没记牢的词和复习时间" },
    { id: "records", label: "学习记录", hint: "全部进度、每日统计、历史与设置" },
  ];

  // 错词散在各个词库的 progress 里，集中抽出来便于单独导出。
  function wrongWordsFrom(progress) {
    const out = [];
    const books = progress && typeof progress === "object" ? progress : {};
    for (const bookId of Object.keys(books)) {
      const map = books[bookId];
      if (!map || typeof map !== "object") continue;
      for (const word of Object.keys(map)) {
        const item = map[word];
        if (!item || typeof item !== "object") continue;
        if (!(item.wrongCount > 0) || item.mastered) continue;
        out.push({ b: bookId, w: word, i: item });
      }
    }
    return out;
  }

  function collectWrongWords() {
    return wrongWordsFrom(store.progress);
  }

  function dataScopeInfo() {
    const personal = (state.upload && state.upload.words) || [];
    const wrong = collectWrongWords();
    const books = store.progress && typeof store.progress === "object" ? store.progress : {};
    let seen = 0;
    for (const bookId of Object.keys(books)) {
      if (books[bookId] && typeof books[bookId] === "object") seen += Object.keys(books[bookId]).length;
    }
    const sessions = Array.isArray(store.history) ? store.history.length : 0;
    return {
      personal: { count: personal.length, note: `${personal.length} 词` },
      wrong: { count: wrong.length, note: `${wrong.length} 个待复习` },
      records: { count: seen, note: `已学 ${seen} 词 · 练习 ${sessions} 次` },
    };
  }

  function scopedPayload(scopes) {
    const set = new Set(scopes);
    const payload = {
      app: "词听",
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      scopes: [...set],
    };
    if (set.has("personal")) payload.upload = state.upload || null;
    if (set.has("wrong")) payload.wrong = collectWrongWords();
    if (set.has("records")) payload.data = store;
    return payload;
  }

  function formatBytes(size) {
    if (!Number.isFinite(size) || size <= 0) return "0 KB";
    if (size < 1024) return `${size} B`;
    const kb = size / 1024;
    if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  function scopeSize(scopes) {
    try {
      return formatBytes(new Blob([JSON.stringify(scopedPayload(scopes))]).size);
    } catch (error) {
      return "";
    }
  }

  function openDataTransferSheet() {
    const info = dataScopeInfo();
    const rows = DATA_SCOPES.map((scope) => `
      <label class="scope-row">
        <input type="checkbox" data-scope="${scope.id}" checked>
        <span class="scope-text">
          <strong>${scope.label}</strong>
          <small>${scope.hint}</small>
        </span>
        <span class="scope-meta">${esc(info[scope.id].note)}</span>
      </label>`).join("");
    openSheet(`
      ${sheetHead("数据导入导出", "先选范围，再导出或导入")}
      <div class="scope-list">
        ${rows}
        <label class="scope-row is-all">
          <input type="checkbox" data-scope="all" checked>
          <span class="scope-text"><strong>全部</strong><small>个人词汇 + 错词 + 学习记录</small></span>
          <span class="scope-meta">${scopeSize(["personal", "wrong", "records"])}</span>
        </label>
      </div>
      <div class="upload-pick-actions">
        <button class="primary-btn" type="button" data-data-export>${ICONS.download} 导出全部数据</button>
        <button class="ghost-btn" type="button" data-data-import>${ICONS.upload} 选文件导入</button>
      </div>
      <div class="sheet-note">导出一个 JSON 文件，换设备时把它拷过去导入即可。<br>导入时「个人词汇」和「错词」按词合并，已有的不会重复；勾了「学习记录」会用文件里的进度、统计和设置覆盖本机。</div>
    `, { focus: false });
    updateDataTransferUI();
  }

  function scopeCheckboxes() {
    return Array.from(document.querySelectorAll("#sheetContent [data-scope]"))
      .filter((box) => box.dataset.scope !== "all");
  }

  function selectedScopes() {
    return scopeCheckboxes().filter((box) => box.checked).map((box) => box.dataset.scope);
  }

  function updateDataTransferUI() {
    const chosen = selectedScopes();
    const allBox = document.querySelector('#sheetContent [data-scope="all"]');
    if (allBox) allBox.checked = chosen.length === DATA_SCOPES.length;
    const button = document.querySelector("#sheetContent [data-data-export]");
    if (!button) return;
    button.disabled = chosen.length === 0;
    if (!chosen.length) button.innerHTML = "请先选择数据";
    else if (chosen.length === DATA_SCOPES.length) button.innerHTML = `${ICONS.download} 导出全部数据`;
    else button.innerHTML = `${ICONS.download} 导出所选 ${chosen.length} 项`;
  }

  function exportData(scopes = DATA_SCOPES.map((scope) => scope.id)) {
    const chosen = DATA_SCOPES.map((scope) => scope.id).filter((id) => scopes.includes(id));
    if (!chosen.length) {
      toast("先选择要导出的数据", true);
      return;
    }
    const payload = scopedPayload(chosen);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const tag = chosen.length === DATA_SCOPES.length ? "backup" : chosen.join("-");
    link.href = url;
    link.download = `citing-${tag}-${todayKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    const labels = DATA_SCOPES.filter((scope) => chosen.includes(scope.id)).map((scope) => scope.label);
    toast(`已导出：${labels.join("、")}`);
  }

  // 兼容旧备份：没有 scopes 字段时，按文件里实际有的内容推断。
  function availableScopes(parsed) {
    const out = [];
    if (parsed && parsed.upload && Array.isArray(parsed.upload.words)) out.push("personal");
    // 旧备份没有单独的 wrong 字段，错词藏在 data.progress 里，也能单独取出来。
    if (parsed && (Array.isArray(parsed.wrong) || (parsed.data && parsed.data.progress))) out.push("wrong");
    if (parsed && parsed.data && typeof parsed.data === "object") out.push("records");
    return out;
  }

  function mergeWrongWords(list) {
    let added = 0;
    for (const row of list) {
      if (!row || !row.b || !row.w) continue;
      if (!store.progress[row.b] || typeof store.progress[row.b] !== "object") store.progress[row.b] = {};
      const map = store.progress[row.b];
      const incoming = row.i && typeof row.i === "object" ? row.i : {};
      const existing = map[row.w];
      if (!existing) {
        map[row.w] = {
          level: 0,
          rightStreak: 0,
          ...incoming,
          wrongCount: Math.max(1, Number(incoming.wrongCount) || 1),
          mastered: false,
        };
        added += 1;
        continue;
      }
      existing.wrongCount = Math.max(Number(existing.wrongCount) || 0, Number(incoming.wrongCount) || 0, 1);
      existing.mastered = false;
      existing.rightStreak = 0;
      if (Number.isFinite(Number(incoming.due))) {
        const due = Number(incoming.due);
        existing.due = Number.isFinite(Number(existing.due)) ? Math.min(Number(existing.due), due) : due;
      }
    }
    if (added || list.length) saveStore();
    return added;
  }

  function mergePersonalFrom(section) {
    const words = Array.isArray(section && section.words) ? section.words.filter((entry) => entry && entry.w) : [];
    if (!words.length) return 0;
    const result = mergeUpload(words, "", { manual: true });
    const files = Array.isArray(section.files) ? section.files : [];
    if (files.length) {
      const known = new Set((result.upload.files || []).map((file) => `${file.name}|${file.at}`));
      for (const file of files) {
        if (!file || known.has(`${file.name}|${file.at}`)) continue;
        result.upload.files.push(file);
      }
      result.upload.files = result.upload.files.slice(0, 20);
    }
    saveUpload(result.upload);
    state.upload = result.upload;
    invalidateUploadBook();
    syncUploadBookMeta();
    return result.added;
  }

  function applyImport(parsed, scopes) {
    const chosen = availableScopes(parsed).filter((id) => scopes.includes(id));
    if (!chosen.length) return { ok: false, message: "文件里没有你选中的数据" };
    const parts = [];
    const recordsApplied = chosen.includes("records");
    if (recordsApplied) {
      store = loadStoreFrom(parsed.data);
      saveStore();
      parts.push("学习记录");
    }
    // 学习记录里已经带着错词，重复合并没有意义。
    if (chosen.includes("wrong") && !recordsApplied) {
      const list = Array.isArray(parsed.wrong)
        ? parsed.wrong
        : wrongWordsFrom(parsed.data && parsed.data.progress);
      const added = mergeWrongWords(list);
      parts.push(`错词 ${list.length} 个（新增 ${added}）`);
    }
    if (chosen.includes("personal")) {
      const added = mergePersonalFrom(parsed.upload);
      parts.push(`个人词汇 +${added} 词`);
    }
    return { ok: true, message: parts.join(" · ") };
  }

  function importData(scopes = DATA_SCOPES.map((scope) => scope.id)) {
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
        const available = availableScopes(parsed);
        if (!available.length) {
          toast("这个文件不是有效的词听备份", true);
          return;
        }
        if (!available.some((id) => scopes.includes(id))) {
          toast("文件里没有你选中的数据", true);
          return;
        }
        const replace = available.includes("records") && scopes.includes("records");
        const question = replace
          ? "导入「学习记录」会用文件里的进度、统计和设置覆盖本机，确定继续吗？"
          : "会把文件里的数据合并到本机，已有的词不会重复添加，确定继续吗？";
        if (!confirm(question)) return;
        const result = applyImport(parsed, scopes);
        if (!result.ok) {
          toast(result.message, true);
          return;
        }
        toast(`导入成功：${result.message}，正在重新打开…`);
        setTimeout(() => location.reload(), 800);
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
    settings.voiceURI = typeof settings.voiceURI === "string" ? settings.voiceURI : "";
    if (typeof settings.softKeyboard !== "boolean") settings.softKeyboard = isTouchDevice();
    settings.soundVolume = [0.7, 1, 1.5].includes(Number(settings.soundVolume)) ? Number(settings.soundVolume) : 1.5;
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
        await ensureBook(id);
      }
      store.settings.bookId = id;
      ui.bookError = "";
      saveStore();
      closeSheet();
      renderCurrent();
      prewarmRelations(currentBook());
      toast(`已切换到${state.meta.books.find((book) => book.id === id).name}`);
    } catch (error) {
      console.warn(error);
      toast("词库加载失败，请检查网络后重试", true);
    }
  }

  function openRangeSheet() {
    const book = currentBook();
    if (!book) {
      toast("词库还在加载，请稍候");
      return;
    }
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

  /* ---------------- upload a paper ---------------- */
  function openUploadPicker() {
    if (ui.uploadBusy) {
      toast("正在处理文件，请稍候");
      return;
    }
    if (!ui.uploadInput) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".txt,.doc,.docx,.pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf";
      input.hidden = true;
      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        input.value = "";
        if (file) handleUploadFile(file);
      });
      document.body.appendChild(input);
      ui.uploadInput = input;
    }
    ui.uploadInput.click();
  }

  function setUploadStatus(text, pct) {
    const status = $("#uploadStatus");
    if (status) status.textContent = text;
    const bar = $("#uploadBar");
    if (bar) bar.style.width = `${clamp(pct, 0, 100)}%`;
  }

  function showUploadProgress(fileName) {
    openSheet(`
      ${sheetHead("上传试卷", fileName)}
      <div class="upload-progress">
        <div class="book-gate-spinner" aria-hidden="true"></div>
        <p id="uploadStatus">正在读取文件…</p>
        <div class="upload-bar"><i id="uploadBar"></i></div>
      </div>
      <div class="sheet-note">支持 TXT、DOC、DOCX、PDF。扫描版 PDF 没有文字层，需要先 OCR 成文字版。</div>
    `);
  }

  function decodeText(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder("utf-16le").decode(bytes.subarray(2));
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder("utf-16be").decode(bytes.subarray(2));
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      try {
        return new TextDecoder("gb18030").decode(bytes);
      } catch (fallbackError) {
        return new TextDecoder("utf-8").decode(bytes);
      }
    }
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("当前浏览器不支持解压 DOCX，请换用新版 Chrome、Edge 或 Safari。");
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function readZipEntries(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    let eocd = -1;
    const stop = Math.max(0, bytes.length - 65557);
    for (let i = bytes.length - 22; i >= stop; i -= 1) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("DOCX 文件结构损坏，无法读取。");
    const count = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const entries = new Map();
    for (let i = 0; i < count; i += 1) {
      if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) break;
      const method = view.getUint16(offset + 10, true);
      const compSize = view.getUint32(offset + 20, true);
      const nameLen = view.getUint16(offset + 28, true);
      const extraLen = view.getUint16(offset + 30, true);
      const commentLen = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const name = new TextDecoder("utf-8").decode(bytes.subarray(offset + 46, offset + 46 + nameLen));
      entries.set(name, { method, compSize, localOffset });
      offset += 46 + nameLen + extraLen + commentLen;
    }
    return { bytes, view, entries };
  }

  async function readZipEntry(zip, name) {
    const entry = zip.entries.get(name);
    if (!entry) return null;
    const offset = entry.localOffset;
    if (offset + 30 > zip.bytes.length || zip.view.getUint32(offset, true) !== 0x04034b50) return null;
    const nameLen = zip.view.getUint16(offset + 26, true);
    const extraLen = zip.view.getUint16(offset + 28, true);
    const start = offset + 30 + nameLen + extraLen;
    const data = zip.bytes.subarray(start, start + entry.compSize);
    if (entry.method === 0) return data;
    if (entry.method === 8) return inflateRaw(data);
    throw new Error("DOCX 使用了不支持的压缩方式。");
  }

  function xmlToText(xml) {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) {
      return xml.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    }
    const paragraphs = doc.getElementsByTagName("w:p");
    const out = [];
    const collect = (node) => {
      let text = "";
      for (const child of node.childNodes) {
        if (child.nodeType === 3) {
          text += child.nodeValue || "";
        } else if (child.nodeType === 1) {
          const name = child.localName;
          if (name === "t") text += child.textContent || "";
          else if (name === "tab") text += " ";
          else if (name === "br" || name === "cr") text += " ";
          else if (name !== "instrText") text += collect(child);
        }
      }
      return text;
    };
    for (const paragraph of paragraphs) {
      const text = collect(paragraph).replace(/\s+/g, " ").trim();
      if (text) out.push(text);
    }
    if (!out.length) {
      for (const node of doc.getElementsByTagName("w:t")) {
        const text = (node.textContent || "").trim();
        if (text) out.push(text);
      }
    }
    return out.join("\n");
  }

  async function extractDocxText(buffer) {
    const zip = readZipEntries(buffer);
    const names = Array.from(zip.entries.keys()).filter((name) => (
      /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(name)
    ));
    if (!names.length) throw new Error("这个 DOCX 里没有找到正文内容。");
    const chunks = [];
    for (const name of names) {
      const data = await readZipEntry(zip, name);
      if (!data) continue;
      chunks.push(xmlToText(new TextDecoder("utf-8").decode(data)));
    }
    return chunks.join("\n");
  }

  function readU16(bytes, offset) {
    if (offset + 2 > bytes.length) return 0;
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  function readU32(bytes, offset) {
    if (offset + 4 > bytes.length) return 0;
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
  }

  function concatBytes(chunks) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }

  // 读取老式 .doc 的 OLE 复合文档结构，拿到 WordDocument / 0Table / 1Table 流。
  function readCfbStreams(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 512 || readU32(bytes, 0) !== 0xe011cfd0 || readU32(bytes, 4) !== 0xe11ab1a1) return null;
    const sectorSize = 1 << readU16(bytes, 30);
    const miniSectorSize = 1 << readU16(bytes, 32);
    const firstDirSector = readU32(bytes, 48);
    const miniCutoff = readU32(bytes, 56);
    const firstMiniFatSector = readU32(bytes, 60);
    const firstDifatSector = readU32(bytes, 68);
    const numDifatSectors = readU32(bytes, 72);
    if (!sectorSize || !miniSectorSize) return null;

    const difat = [];
    for (let i = 0; i < 109; i += 1) {
      const sector = readU32(bytes, 76 + i * 4);
      if (sector !== 0xffffffff) difat.push(sector);
    }
    let difatSector = firstDifatSector;
    for (let i = 0; i < numDifatSectors && difatSector !== 0xffffffff && difatSector !== 0xfffffffe; i += 1) {
      const start = 512 + difatSector * sectorSize;
      const count = sectorSize / 4 - 1;
      for (let j = 0; j < count; j += 1) {
        const sector = readU32(bytes, start + j * 4);
        if (sector !== 0xffffffff) difat.push(sector);
      }
      difatSector = readU32(bytes, start + count * 4);
    }

    const fat = [];
    for (const sector of difat) {
      const start = 512 + sector * sectorSize;
      for (let i = 0; i < sectorSize / 4; i += 1) fat.push(readU32(bytes, start + i * 4));
    }

    const readChain = (startSector, size) => {
      const chunks = [];
      const seen = new Set();
      let sector = startSector;
      let remaining = size;
      while (sector !== 0xfffffffe && sector !== 0xffffffff && remaining > 0 && !seen.has(sector)) {
        seen.add(sector);
        const start = 512 + sector * sectorSize;
        const length = Math.min(sectorSize, remaining);
        chunks.push(bytes.subarray(start, start + length));
        remaining -= length;
        sector = fat[sector];
      }
      return concatBytes(chunks);
    };

    const readChainAll = (startSector) => {
      const chunks = [];
      const seen = new Set();
      let sector = startSector;
      while (sector !== 0xfffffffe && sector !== 0xffffffff && !seen.has(sector)) {
        seen.add(sector);
        const start = 512 + sector * sectorSize;
        chunks.push(bytes.subarray(start, start + sectorSize));
        sector = fat[sector];
      }
      return concatBytes(chunks);
    };

    const dirBytes = readChainAll(firstDirSector);
    const entries = [];
    for (let offset = 0; offset + 128 <= dirBytes.length; offset += 128) {
      const type = dirBytes[offset + 66];
      if (type !== 1 && type !== 2 && type !== 5) continue;
      const nameLength = readU16(dirBytes, offset + 64);
      const nameBytes = dirBytes.subarray(offset, offset + Math.max(0, Math.min(64, nameLength - 2)));
      let name = "";
      try {
        name = new TextDecoder("utf-16le").decode(nameBytes);
      } catch (error) {
        name = "";
      }
      entries.push({
        name,
        type,
        startSector: readU32(dirBytes, offset + 116),
        size: readU32(dirBytes, offset + 120),
      });
    }

    const root = entries.find((entry) => entry.type === 5);
    const miniFat = [];
    if (firstMiniFatSector !== 0xffffffff) {
      const miniFatBytes = readChainAll(firstMiniFatSector);
      for (let i = 0; i + 4 <= miniFatBytes.length; i += 4) miniFat.push(readU32(miniFatBytes, i));
    }
    const miniStream = root ? readChain(root.startSector, root.size) : new Uint8Array(0);
    const readMiniChain = (startSector, size) => {
      const chunks = [];
      const seen = new Set();
      let sector = startSector;
      let remaining = size;
      while (sector !== 0xfffffffe && sector !== 0xffffffff && remaining > 0 && !seen.has(sector)) {
        seen.add(sector);
        const start = sector * miniSectorSize;
        const length = Math.min(miniSectorSize, remaining);
        chunks.push(miniStream.subarray(start, start + length));
        remaining -= length;
        sector = miniFat[sector];
      }
      return concatBytes(chunks);
    };

    const streams = new Map();
    for (const entry of entries) {
      if (entry.type !== 2) continue;
      streams.set(entry.name, entry.size < miniCutoff
        ? readMiniChain(entry.startSector, entry.size)
        : readChain(entry.startSector, entry.size));
    }
    return streams;
  }

  function scanDocStream(stream) {
    const runs = [];
    const scan = (step, offset) => {
      let current = "";
      for (let i = offset; i + step <= stream.length; i += step) {
        const code = step === 1 ? stream[i] : stream[i] | (stream[i + 1] << 8);
        if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13) {
          current += String.fromCharCode(code);
          if (current.length > 6000) {
            runs.push(current);
            current = "";
          }
        } else {
          if (current.length >= 2) runs.push(current);
          current = "";
        }
      }
      if (current.length >= 2) runs.push(current);
    };
    scan(1, 0);
    scan(2, 0);
    scan(2, 1);
    return runs.join("\n");
  }

  function extractWordBinaryText(word, table0, table1) {
    if (!word || !word.length) return "";
    const flags = readU16(word, 0x0a);
    const table = (flags & 0x0200) ? table1 : table0;
    if (table && table.length > 0x01aa) {
      const fcClx = readU32(word, 0x01a2);
      const lcbClx = readU32(word, 0x01a6);
      if (lcbClx > 0 && fcClx + lcbClx <= table.length) {
        const clx = table.subarray(fcClx, fcClx + lcbClx);
        let pos = 0;
        while (pos < clx.length && clx[pos] === 0x01) {
          pos += 3 + readU16(clx, pos + 1);
        }
        if (pos < clx.length && clx[pos] === 0x02) {
          const lcb = readU32(clx, pos + 1);
          const plc = clx.subarray(pos + 5, pos + 5 + lcb);
          const count = (lcb - 4) / 12;
          if (Number.isInteger(count) && count > 0 && plc.length >= lcb) {
            const cps = [];
            for (let i = 0; i <= count; i += 1) cps.push(readU32(plc, i * 4));
            const pcdStart = (count + 1) * 4;
            let out = "";
            for (let i = 0; i < count; i += 1) {
              const pcd = pcdStart + i * 8;
              const rawFc = readU32(plc, pcd + 2);
              const compressed = (rawFc & 0x40000000) !== 0;
              const fc = compressed ? (rawFc & 0x3fffffff) / 2 : (rawFc & 0x3fffffff);
              const charCount = cps[i + 1] - cps[i];
              if (charCount <= 0) continue;
              if (compressed) {
                const data = word.subarray(fc, fc + charCount);
                let text = "";
                for (const byte of data) text += String.fromCharCode(byte);
                out += text;
              } else {
                out += new TextDecoder("utf-16le").decode(word.subarray(fc, fc + charCount * 2));
              }
            }
            if (out.trim()) return out;
          }
        }
      }
    }
    return scanDocStream(word);
  }

  function extractDocText(buffer) {
    const streams = readCfbStreams(buffer);
    if (streams && streams.has("WordDocument")) {
      return extractWordBinaryText(
        streams.get("WordDocument"),
        streams.get("0Table"),
        streams.get("1Table")
      );
    }
    // 不是标准 OLE .doc（有些工具会直接写纯文本），退回扫描原始字节。
    return scanDocStream(new Uint8Array(buffer));
  }

  function loadPdfJs() {
    if (!state.pdfjsPromise) {
      const source = new URL("vendor/pdf/pdf.min.mjs", document.baseURI).href;
      const worker = new URL("vendor/pdf/pdf.worker.min.mjs", document.baseURI).href;
      state.pdfjsPromise = import(source)
        .then((module) => {
          module.GlobalWorkerOptions.workerSrc = worker;
          return module;
        })
        .catch((error) => {
          state.pdfjsPromise = null;
          throw new Error("PDF 组件加载失败，请联网打开一次后再试。");
        });
    }
    return state.pdfjsPromise;
  }

  async function extractPdfText(buffer, report) {
    const pdfjs = await loadPdfJs();
    const task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useWorkerFetch: false,
      disableFontFace: true,
      useSystemFonts: false,
    });
    const doc = await task.promise;
    const chunks = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      report(15 + Math.round((pageNumber / Math.max(1, doc.numPages)) * 38), `正在读取 PDF 第 ${pageNumber}/${doc.numPages} 页…`);
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent({ normalizeWhitespace: true });
      let text = "";
      for (const item of content.items) {
        if (!item || typeof item.str !== "string") continue;
        text += item.str;
        text += item.hasEOL ? "\n" : " ";
      }
      chunks.push(text);
      page.cleanup();
    }
    await doc.destroy();
    return chunks.join("\n");
  }

  async function extractTextFromFile(file, buffer, report) {
    const name = String(file.name || "").toLowerCase();
    const bytes = new Uint8Array(buffer);
    const isPdf = bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
    const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
    const isOle = bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;

    if (name.endsWith(".pdf") || isPdf) {
      report(12, "正在打开 PDF…");
      return extractPdfText(buffer, report);
    }
    if (name.endsWith(".docx") || isZip) {
      report(22, "正在解压 DOCX…");
      return extractDocxText(buffer);
    }
    if (name.endsWith(".doc") || isOle) {
      report(22, "正在读取 DOC…");
      return extractDocText(buffer);
    }
    if (name.endsWith(".txt") || name.endsWith(".text") || (file.type || "").startsWith("text/")) {
      report(25, "正在解码文本…");
      return decodeText(buffer);
    }
    throw new Error("暂不支持这个文件格式，请上传 TXT、DOC、DOCX 或 PDF。");
  }

  function tokenWords(raw) {
    let token = String(raw || "").toLowerCase().replace(/[’‘]/g, "'").replace(/^['-]+|['-]+$/g, "");
    if (!token) return [];
    if (token.includes("'")) {
      token = token.replace(/'s$/, "").replace(/s'$/, "").replace(/'$/, "");
      if (token.includes("'")) return [];
    }
    if (token.includes("-")) return token.split("-").filter(Boolean);
    return [token];
  }

  // 完形填空的空格标记：___53___、____55____、53 ____、___54、(53)。
  const GAP_MARK_RE = /_{2,}\s*\d{1,3}\s*_{2,}|_{2,}\s*\d{1,3}\b|\b\d{1,3}\s*_{2,}|\(\s*\d{1,3}\s*\)/g;
  const GAP_HINT_RE = /_{2,}\s*\d{1,3}|\(\s*\d{1,3}\s*\)/;
  // 选择题选项标记：A. / B、/ C．/ D)
  const CHOICE_MARK_RE = /(?:^|[\s、，,（(])([A-D])\s*[.、)．:：]/g;

  // 中文排版里的全角标点（"me．"、"kids，"）会让切句失效，先统一成半角。
  const FULLWIDTH_PUNCT = {
    "．": ".", "。": ".", "！": "!", "？": "?", "；": ";", "：": ":",
    "，": ",", "（": "(", "）": ")", "【": "[", "】": "]", "、": ",",
  };

  function normalizePunctuation(text) {
    return String(text || "")
      .replace(/[．。！？；：，（）、【】]/g, (ch) => FULLWIDTH_PUNCT[ch] || ch)
      // "details,which" → "details, which"；数字里的 "1,000" 不动。
      .replace(/([,;:])(?=[A-Za-z"'(])/g, (mark, _p, offset, whole) => (
        /\d/.test(whole[offset - 1] || "") ? mark : `${mark} `
      ))
      .replace(/\.(?=[A-Z"'(])/g, ". ");
  }

  // 把试卷原文切成句子，后面用原句做单词例句。
  function splitPaperSentences(text) {
    const source = normalizePunctuation(String(text || ""))
      .replace(/\r\n?/g, "\n")
      .replace(/[\u00a0\u3000]/g, " ")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"');
    const lines = source
      .split(/\n+/)
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .filter(Boolean);

    // PDF 经常在句子中间换行。下一行以小写字母或空格标记开头时，先接回上一行。
    const blocks = [];
    for (const line of lines) {
      const previous = blocks[blocks.length - 1];
      if (previous
        && !/[.!?;:]["')\]]?$/.test(previous)
        && /^[a-z0-9"'(（_]/.test(line)
        && previous.length + line.length < 300) {
        blocks[blocks.length - 1] = `${previous} ${line}`;
      } else {
        blocks.push(line);
      }
    }

    const sentences = [];
    const seen = new Set();
    for (const block of blocks) {
      const parts = block.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [block];
      for (const part of parts) {
        const sentence = part.replace(/\s+/g, " ").trim();
        if (sentence.length > 320) continue;
        // 带空格标记的句子本身就是完形填空的原文，即使很短（"Dad ____53____."）也要留下。
        if (!GAP_HINT_RE.test(sentence)) {
          if (sentence.length < 12) continue;
          if ((sentence.match(/[A-Za-z]/g) || []).length < 6) continue;
        } else if (sentence.length < 8) {
          continue;
        }
        const words = sentence.split(/\s+/).length;
        const commas = (sentence.match(/,/g) || []).length;
        // 逗号分隔的单词表不算例句，避免把 "apple, abandon, ..." 当原句。
        if (commas >= 3 && words / (commas + 1) < 2.5) continue;
        const key = sentence.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        sentences.push(sentence);
      }
    }
    return sentences;
  }

  // 选项行（"55. A. withdraw B. donate C. receive D. appreciate"）没有句子结构，
  // 不能当例句；但它们能把选项词和原题号对应起来。
  // 完形填空的空格（___55___）就在同号那句原文里，用它给这些词补例句。
  function choiceLineGroups(line) {
    const groups = [];
    const headRe = /(?:^|\s)(\d{1,3})\s*[.、)．]?\s*(?=[A-D]\s*[.、)．:：])/g;
    const hits = [];
    let match;
    while ((match = headRe.exec(line))) {
      hits.push({ index: match.index, number: Number(match[1]), end: match.index + match[0].length });
    }
    hits.forEach((hit, index) => {
      const to = index + 1 < hits.length ? hits[index + 1].index : line.length;
      groups.push({ number: hit.number, text: line.slice(hit.end, to) });
    });
    return groups;
  }

  // 把选项行拆出来：passage 用于切句，choices 记录“词 → 题号”。
  // 同时兼容一行四选项（"55. A. withdraw B. donate …"）和一字母一行（A. / B. …）。
  function splitChoiceLines(text) {
    const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
    const kept = [];
    const choices = new Map();
    const record = (number, chunk) => {
      if (!Number.isFinite(number) || number <= 0) return;
      const cleaned = String(chunk || "").replace(CHOICE_MARK_RE, " ");
      for (const raw of cleaned.match(/[A-Za-z][A-Za-z'’\-]*/g) || []) {
        for (const word of tokenWords(raw)) {
          if (word.length < 3 || UPLOAD_STOPWORDS.has(word)) continue;
          const bucket = choices.get(word) || new Set();
          bucket.add(number);
          choices.set(word, bucket);
        }
      }
    };

    let lastNumber = 0;
    let block = null;
    const flush = () => {
      if (!block) return;
      for (const chunk of block.chunks) record(block.number, chunk);
      block = null;
    };

    for (const line of lines) {
      if ((line.match(CHOICE_MARK_RE) || []).length >= 2) {
        flush();
        for (const group of choiceLineGroups(line)) record(group.number, group.text);
        continue;
      }
      // 一字母一行：可带题号（"41. A. sold"），也可以只有字母（"A. sold"）。
      const single = line.match(/^\s*(?:(\d{1,3})\s*[.、)．]?\s*)?([A-D])\s*[.、)．:：]\s*(\S.*)$/);
      if (single) {
        const number = single[1] ? Number(single[1]) : lastNumber;
        if (!block || (single[1] && block.number !== number)) {
          flush();
          block = { number, chunks: [] };
        }
        block.chunks.push(single[3]);
        continue;
      }
      flush();
      const bare = line.match(/^\s*(\d{1,3})\s*[.、)．]?\s*$/);
      if (bare) lastNumber = Number(bare[1]);
      kept.push(line);
    }
    flush();
    return { passage: kept.join("\n"), choices };
  }

  // 题号 → 原文里含该空格的句子下标。
  function buildClozeGaps(sentences) {
    const gaps = new Map();
    sentences.forEach((sentence, index) => {
      for (const mark of sentence.match(GAP_MARK_RE) || []) {
        const digits = mark.match(/\d{1,3}/);
        if (!digits) continue;
        const number = Number(digits[0]);
        const previous = gaps.get(number);
        if (previous == null || sentenceScore(sentence) > sentenceScore(sentences[previous])) {
          gaps.set(number, index);
        }
      }
    });
    return gaps;
  }

  // 空格所在句常常很短（"Dad ____53____."），接上下一句把上下文补足。
  function clozeSentenceText(sentences, index) {
    let text = sentences[index] || "";
    if (!text) return "";
    let next = index + 1;
    while (text.split(/\s+/).length < 5 && next < sentences.length && text.length < 220) {
      const addition = sentences[next];
      if (!addition || text.length + addition.length > 260) break;
      text = `${text} ${addition}`;
      next += 1;
    }
    return text;
  }

  function sentenceScore(sentence) {
    const text = String(sentence || "").trim();
    if (!text) return -1;
    const words = text.split(/\s+/).length;
    if (words < 4) return -1;
    let score = 0;
    if (text.length >= 30 && text.length <= 180) score += 3;
    else if (text.length <= 260) score += 1;
    if (/[.!?]["')\]]?$/.test(text)) score += 1;
    if (words >= 6) score += 1;
    const commas = (text.match(/,/g) || []).length;
    if (commas >= 3 && words / (commas + 1) < 2.5) score -= 2;
    if (/\b[A-D][.)]\s/.test(text)) score -= 2;
    if (/_{2,}|\(\s*\)/.test(text)) score -= 1;
    return score;
  }

  function extractWordTokens(text) {
    const seen = new Map();
    const add = (value) => {
      let word = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
      if (word.length < 3 || word.length > 32) return;
      if (UPLOAD_STOPWORDS.has(word)) return;
      seen.set(word, (seen.get(word) || 0) + 1);
    };
    const consume = (block) => {
      const matches = String(block || "").match(/[A-Za-z][A-Za-z'’\-]*/g) || [];
      for (const raw of matches) {
        for (const word of tokenWords(raw)) add(word);
      }
    };
    consume(text);

    const { passage, choices } = splitChoiceLines(text);
    const sentences = splitPaperSentences(passage);
    const gaps = buildClozeGaps(sentences);
    const sentenceMap = new Map();
    const sentenceScores = sentences.map(sentenceScore);
    sentences.forEach((sentence, index) => {
      // 分数为负的多半是选项行碎片（"hesitated D."），不能当例句。
      if (sentenceScores[index] < 0) return;
      const matches = sentence.match(/[A-Za-z][A-Za-z'’\-]*/g) || [];
      for (const raw of matches) {
        for (const word of tokenWords(raw)) {
          const current = sentenceMap.get(word);
          if (current == null || sentenceScores[index] > sentenceScores[current]) {
            sentenceMap.set(word, index);
          }
        }
      }
    });

    return {
      tokens: Array.from(seen, ([word, freq]) => {
        const sentence = sentenceMap.has(word) ? sentenceMap.get(word) : -1;
        let cloze = -1;
        let clozeNo = 0;
        if (sentence < 0 && choices.has(word)) {
          for (const number of choices.get(word)) {
            const index = gaps.get(number);
            if (index == null || index < 0) continue;
            if (cloze < 0) {
              cloze = index;
              clozeNo = number;
            }
          }
        }
        return { word, freq, sentence, cloze, clozeNo };
      }),
      sentences,
    };
  }

  function betterSentence(a, b, sentences) {
    if (a == null || a < 0) return b == null ? -1 : b;
    if (b == null || b < 0) return a;
    return sentenceScore(sentences[b]) > sentenceScore(sentences[a]) ? b : a;
  }

  function matchUploadTokens(tokens, index, sentences = []) {
    const matched = new Map();
    for (const token of tokens) {
      const candidates = lemmaCandidates(token.word);
      let best = null;
      for (const candidate of candidates) {
        const mask = index[candidate];
        if (mask == null) continue;
        const library = lowestLibrary(mask);
        const level = library ? LIBRARY_LEVELS.indexOf(library) : LIBRARY_LEVELS.length;
        const score = level * 10 + (candidate === token.word ? 0 : 1);
        if (!best || score < best.score) best = { word: candidate, mask, score };
      }
      if (!best) continue;
      const previous = matched.get(best.word);
      if (previous) {
        previous.freq += token.freq;
        previous.sentence = betterSentence(previous.sentence, token.sentence, sentences);
        if (token.cloze >= 0 && previous.cloze < 0) {
          previous.cloze = token.cloze;
          previous.clozeNo = token.clozeNo;
        }
      } else {
        matched.set(best.word, {
          word: best.word,
          mask: best.mask,
          freq: token.freq,
          sentence: token.sentence == null ? -1 : token.sentence,
          cloze: token.cloze == null ? -1 : token.cloze,
          clozeNo: token.clozeNo || 0,
        });
      }
    }
    return Array.from(matched.values());
  }

  function findLoadedEntry(word) {
    for (const library of LIBRARY_LEVELS) {
      const book = state.books[library.id];
      if (!book || !book._index) continue;
      const index = book._index.get(word);
      if (index != null && index >= 0) return book.words[index];
    }
    return null;
  }

  function buildUploadEntries(matched, dict, sentences = []) {
    const entries = matched.map((item) => {
      const loaded = findLoadedEntry(item.word);
      const fromDict = dict && dict[item.word] ? dict[item.word] : null;
      const library = lowestLibrary(item.mask);
      const direct = item.sentence >= 0 && sentences[item.sentence] ? sentences[item.sentence] : "";
      // 只在选项里出现过的词：用同号空格所在的原文当例句（句子本身保留空格）。
      const cloze = !direct && item.cloze >= 0 ? clozeSentenceText(sentences, item.cloze) : "";
      const sentence = direct || cloze;
      const entry = {
        w: item.word,
        p: (loaded && loaded.p) || (fromDict && fromDict[0]) || "",
        m: (loaded && loaded.m) || (fromDict && fromDict[1]) || "暂无释义",
        lib: library ? library.id : "",
        beyond: !(item.mask & 1),
        freq: item.freq,
      };
      if (sentence) {
        entry.e = sentence;
        entry.t = "";
        entry.paper = true;
        if (!direct && item.clozeNo) entry.cn = item.clozeNo;
      }
      return entry;
    });
    entries.sort((a, b) => (
      (a.beyond ? 1 : 0) - (b.beyond ? 1 : 0) ||
      (b.freq || 0) - (a.freq || 0) ||
      a.w.localeCompare(b.w)
    ));
    return entries;
  }

  function mergeUpload(entries, fileName, options = {}) {
    const now = Date.now();
    const existing = state.upload && Array.isArray(state.upload.words) ? state.upload : null;
    const byWord = new Map();
    if (existing) {
      for (const entry of existing.words) byWord.set(entry.w, { ...entry });
    }
    let added = 0;
    for (const entry of entries) {
      const previous = byWord.get(entry.w);
      if (!previous) {
        byWord.set(entry.w, entry);
        added += 1;
        continue;
      }
      previous.freq = (previous.freq || 0) + (entry.freq || 0);
      if ((!previous.m || previous.m === "暂无释义") && entry.m) {
        previous.m = entry.m;
        previous.p = entry.p;
      }
      // 旧例句可能是选项行碎片（"hesitated D."）；新例句更像完整句子时换上。
      const weakExample = !previous.e || String(previous.e).trim().split(/\s+/).length < 4;
      if (entry.e && (weakExample || (entry.paper && !previous.paper))) {
        previous.e = entry.e;
        previous.t = entry.t || "";
        previous.paper = Boolean(entry.paper);
        previous.cn = entry.cn || 0;
      }
    }
    const all = Array.from(byWord.values()).sort((a, b) => (
      (a.beyond ? 1 : 0) - (b.beyond ? 1 : 0) ||
      (b.freq || 0) - (a.freq || 0) ||
      a.w.localeCompare(b.w)
    ));
    const words = all.slice(0, UPLOAD_MAX_WORDS);
    const files = existing && Array.isArray(existing.files) ? existing.files.slice() : [];
    // 手动加入的词没有“试卷”来源，不记到 files 里。
    if (!options.manual && fileName) files.unshift({ name: fileName, at: now, added, matched: entries.length });
    return {
      upload: {
        version: 1,
        createdAt: (existing && existing.createdAt) || now,
        updatedAt: now,
        files: files.slice(0, 20),
        words,
      },
      added,
      truncated: all.length > UPLOAD_MAX_WORDS,
    };
  }

  /* ---------------- 单词 → 个人词汇 ---------------- */
  function inPersonalWords(word) {
    const key = String(word || "").toLowerCase();
    if (!key || !state.upload || !Array.isArray(state.upload.words)) return false;
    return state.upload.words.some((entry) => entry.w === key);
  }

  // 题目里的词条（可能来自任意词库）转成个人词汇的存法。
  function personalEntryFrom(entry) {
    const word = String((entry && entry.w) || "").toLowerCase();
    if (!word) return null;
    const mask = (state.wordIndex && state.wordIndex[word]) || 0;
    const library = entry.lib && LIBRARY_BY_ID[entry.lib] ? LIBRARY_BY_ID[entry.lib] : lowestLibrary(mask);
    const out = {
      w: word,
      p: entry.p || "",
      m: entry.m || "暂无释义",
      lib: library ? library.id : "",
      beyond: typeof entry.beyond === "boolean" ? entry.beyond : !(mask & 1),
      freq: 1,
    };
    if (entry.e) {
      out.e = entry.e;
      out.t = entry.t || "";
      out.paper = Boolean(entry.paper);
      if (entry.cn) out.cn = entry.cn;
    }
    return out;
  }

  // 反馈卡里的那一个按钮：没在个人词汇里就是“加入”，已经在里面就是“移出”。
  // 注意不要带 data-word：document 上的查词监听会把它当成“点单词查释义”。
  function personalButtonHTML(word) {
    const added = inPersonalWords(word);
    return `<button class="personal-btn${added ? " is-added" : ""}" type="button" data-personal-toggle>${added
      ? `${ICONS.minus} 从个人词汇中移出`
      : `${ICONS.plus} 加入个人词汇`}</button>`;
  }

  function setPersonalButtonState(button, added) {
    if (!button) return;
    button.classList.toggle("is-added", Boolean(added));
    button.innerHTML = added ? `${ICONS.minus} 从个人词汇中移出` : `${ICONS.plus} 加入个人词汇`;
  }

  function addWordToPersonal(entry, button) {
    const item = personalEntryFrom(entry);
    if (!item) return;
    if (inPersonalWords(item.w)) {
      setPersonalButtonState(button, true);
      toast(`「${item.w}」已经在个人词汇里了`);
      return;
    }
    try {
      const result = mergeUpload([item], "", { manual: true });
      saveUpload(result.upload);
      state.upload = result.upload;
      invalidateUploadBook();
      syncUploadBookMeta();
      // 新词要能进练习范围：范围和词表重排序对不上，直接放开成全部。
      delete store.settings.ranges[UPLOAD_BOOK_ID];
      saveStore();
      if (store.settings.bookId === UPLOAD_BOOK_ID) ensureBook(UPLOAD_BOOK_ID).catch(() => {});
      else if (!ui.session) renderCurrent();
      setPersonalButtonState(button, true);
      toast(`「${item.w}」已加入个人词汇 · 共 ${uploadStats().total} 词`);
    } catch (error) {
      console.warn("Failed to add personal word", error);
      toast(error && error.message ? error.message : "加入个人词汇失败", true);
    }
  }

  function removeWordFromPersonal(word, button) {
    const key = String(word || "").toLowerCase();
    const upload = state.upload;
    if (!key || !upload || !Array.isArray(upload.words)) return;
    const remaining = upload.words.filter((item) => item.w !== key);
    if (remaining.length === upload.words.length) {
      setPersonalButtonState(button, false);
      return;
    }
    const progress = store.progress[UPLOAD_BOOK_ID];
    if (progress) delete progress[key];

    if (!remaining.length) {
      // 最后一个词被移出：整个个人词汇一起清掉，回到高考词库
      try {
        localStorage.removeItem(UPLOAD_KEY);
      } catch (error) {
        console.warn(error);
      }
      state.upload = null;
      invalidateUploadBook();
      delete store.progress[UPLOAD_BOOK_ID];
      delete store.settings.ranges[UPLOAD_BOOK_ID];
      for (const day of Object.values(store.daily)) {
        if (day && day.newByBook) delete day.newByBook[UPLOAD_BOOK_ID];
      }
      if (store.settings.bookId === UPLOAD_BOOK_ID) store.settings.bookId = "gaokao";
      saveStore();
      syncUploadBookMeta();
      setPersonalButtonState(button, false);
      ensureCurrentBook().catch(() => {});
      toast(`「${key}」已移出，个人词汇已清空`);
      return;
    }

    upload.words = remaining;
    upload.updatedAt = Date.now();
    try {
      saveUpload(upload);
    } catch (error) {
      toast(error && error.message ? error.message : "保存失败", true);
      return;
    }
    invalidateUploadBook();
    syncUploadBookMeta();
    saveStore();
    if (store.settings.bookId === UPLOAD_BOOK_ID) ensureBook(UPLOAD_BOOK_ID).catch(() => {});
    else if (!ui.session) renderCurrent();
    setPersonalButtonState(button, false);
    toast(`「${key}」已从个人词汇移出 · 还剩 ${remaining.length} 词`);
  }

  function togglePersonalWord(entry, button) {
    const word = String((entry && entry.w) || "").toLowerCase();
    if (!word) return;
    if (inPersonalWords(word)) removeWordFromPersonal(word, button);
    else addWordToPersonal(entry, button);
  }

  async function handleUploadFile(file) {
    if (!file || ui.uploadBusy) return;
    ui.uploadBusy = true;
    ui.uploadDraft = null;
    try {
      if (file.size > 30 * 1024 * 1024) {
        throw new Error("文件超过 30 MB，请先拆分或压缩后再上传。");
      }
      showUploadProgress(file.name);
      setUploadStatus("正在读取文件…", 5);
      const buffer = await file.arrayBuffer();
      const text = await extractTextFromFile(file, buffer, (pct, label) => setUploadStatus(label, pct));
      setUploadStatus("正在提取英文单词…", 56);
      const { tokens, sentences } = extractWordTokens(text);
      if (!tokens.length) {
        throw new Error("没有提取到可学习的英文词汇。如果是扫描版 PDF，请先用 OCR 转成文字版。");
      }
      setUploadStatus("正在匹配四套词库…", 66);
      const index = await ensureWordIndex();
      setUploadStatus("正在读取释义…", 74);
      const dict = await loadDict();
      const matched = matchUploadTokens(tokens, index, sentences);
      if (!matched.length) {
        throw new Error(`从文件中识别出 ${tokens.length} 个英文词，但没有匹配到高考或更高阶词库中的词汇。`);
      }
      setUploadStatus("正在整理词汇…", 88);
      const entries = buildUploadEntries(matched, dict, sentences);
      showUploadSelection(entries, file.name);
    } catch (error) {
      console.warn("Upload failed", error);
      showUploadError(error && error.message ? error.message : "文件处理失败，请换一个文件再试。");
    } finally {
      ui.uploadBusy = false;
    }
  }

  function uploadPickItemHTML(entry, checked) {
    const library = affiliationFor(entry.w, entry);
    return `
      <label class="upload-pick-item">
        <input type="checkbox" data-upload-select value="${escAttr(entry.w)}" ${checked ? "checked" : ""}>
        <span class="upload-pick-copy">
          <span class="upload-pick-word">
            <strong>${esc(entry.w)}</strong>
            ${library ? `<span class="lib-tag lib-${escAttr(library.id)}">${esc(library.short)}</span>` : ""}
            ${entry.existing ? `<span class="pick-existing">已收录</span>` : ""}
          </span>
          <small>${esc(shortMeaning(entry.m))}</small>
          ${entry.e ? `<em>${entry.cn ? `第 ${entry.cn} 题空格 · ` : ""}${esc(entry.e)}</em>` : ""}
        </span>
      </label>`;
  }

  // 按词汇类别分组。
  function uploadGroups(entries) {
    const groups = LIBRARY_LEVELS.map((library) => ({
      title: `${library.short}词汇`,
      items: entries.filter((entry) => {
        const found = affiliationFor(entry.w, entry);
        return found && found.id === library.id;
      }),
    })).filter((group) => group.items.length);
    const rest = entries.filter((entry) => !affiliationFor(entry.w, entry));
    if (rest.length) groups.push({ title: "其他词汇", items: rest });
    return groups;
  }

  function uploadPickSectionsHTML(entries, selected) {
    return uploadGroups(entries).map((group) => `
      <div class="upload-section">
        <div class="upload-section-head"><h3>${group.title}</h3><span>${group.items.length} 词</span></div>
        <div class="upload-pick-list">
          ${group.items.map((entry) => uploadPickItemHTML(entry, selected.has(entry.w))).join("")}
        </div>
      </div>`).join("");
  }

  function showUploadSelection(entries, fileName) {
    const existing = new Set(((state.upload && state.upload.words) || []).map((entry) => entry.w));
    for (const entry of entries) entry.existing = existing.has(entry.w);
    const selected = new Set(entries.map((entry) => entry.w));
    ui.uploadDraft = { entries, fileName, selected, anchorIndex: null };
    const count = entries.length;
    openSheet(`
      ${sheetHead("选择要加入的词", `${fileName} · 识别到 ${count} 词`)}
      <div class="upload-pick-bar">
        <span class="upload-pick-count" id="uploadPickCount"><strong>${count}</strong> / ${count} 词</span>
        <span class="upload-pick-tools">
          <button class="mini-btn" type="button" data-upload-all>全选</button>
          <button class="mini-btn" type="button" data-upload-none>全不选</button>
        </span>
      </div>
      <div class="sheet-note">取消勾选不想加入的词。Shift 连选；按住拖动可批量勾选。例句使用试卷原句。</div>
      <div class="upload-pick-actions">
        <button class="primary-btn" type="button" data-upload-confirm>加入 ${count} 词</button>
        <button class="ghost-btn" type="button" data-pick-upload>换一个文件</button>
      </div>
      <div class="upload-pick-scroll">
        ${uploadPickSectionsHTML(entries, selected)}
      </div>
    `, { maximized: true, focus: false });
  }

  // 学习范围里点「个人词汇」卡片：列出已加入的词，勾选要删的那几个。
  function uploadManageItemHTML(entry, checked) {
    const library = affiliationFor(entry.w, entry);
    return `
      <label class="upload-pick-item">
        <input type="checkbox" data-upload-select value="${escAttr(entry.w)}" ${checked ? "checked" : ""}>
        <span class="upload-pick-copy">
          <span class="upload-pick-word">
            <strong>${esc(entry.w)}</strong>
            ${library ? `<span class="lib-tag lib-${escAttr(library.id)}">${esc(library.short)}</span>` : ""}
          </span>
          <small>${esc(shortMeaning(entry.m))}</small>
          ${entry.e ? `<em>${entry.cn ? `第 ${entry.cn} 题空格 · ` : ""}${esc(entry.e)}</em>` : ""}
        </span>
      </label>`;
  }

  function deleteSelectedUploadWords() {
    const draft = ui.uploadDraft;
    const upload = state.upload;
    if (!draft || draft.mode !== "delete" || !upload || !draft.selected.size) return;
    const remove = draft.selected;
    const remaining = upload.words.filter((entry) => !remove.has(entry.w));
    const removed = upload.words.length - remaining.length;
    const progress = store.progress[UPLOAD_BOOK_ID];
    if (progress) for (const word of remove) delete progress[word];
    closeSheet();

    if (!remaining.length) {
      // 全删完了：整个个人词汇一起清掉，回到高考词库
      try {
        localStorage.removeItem(UPLOAD_KEY);
      } catch (error) {
        console.warn(error);
      }
      state.upload = null;
      invalidateUploadBook();
      delete store.progress[UPLOAD_BOOK_ID];
      delete store.settings.ranges[UPLOAD_BOOK_ID];
      for (const day of Object.values(store.daily)) {
        if (day && day.newByBook) delete day.newByBook[UPLOAD_BOOK_ID];
      }
      if (store.settings.bookId === UPLOAD_BOOK_ID) store.settings.bookId = "gaokao";
      saveStore();
      syncUploadBookMeta();
      renderCurrent();
      ensureCurrentBook().catch(() => {});
      toast(`已删除 ${removed} 个词，个人词汇已清空`);
      return;
    }

    upload.words = remaining;
    upload.updatedAt = Date.now();
    try {
      saveUpload(upload);
    } catch (error) {
      toast(error && error.message ? error.message : "保存失败", true);
      return;
    }
    invalidateUploadBook();
    syncUploadBookMeta();
    saveStore();
    renderCurrent();
    ensureCurrentBook().catch(() => {});
    toast(`已删除 ${removed} 个词`);
  }

  function updateUploadPickCount() {
    const draft = ui.uploadDraft;
    if (!draft) return;
    const count = draft.selected.size;
    const total = draft.entries.length;
    const label = $("#uploadPickCount");
    if (label) label.innerHTML = `<strong>${count}</strong> / ${total} 词`;
    if (draft.mode === "delete") {
      const remove = $("[data-upload-delete]", $("#sheetContent"));
      if (remove) {
        remove.disabled = count === 0;
        remove.textContent = count ? `删除 ${count} 词` : "删除选中";
      }
      return;
    }
    const confirm = $("[data-upload-confirm]", $("#sheetContent"));
    if (confirm) {
      confirm.disabled = count === 0;
      confirm.textContent = count ? `加入 ${count} 词` : "请选择词汇";
    }
  }

  function setUploadSelection(all) {
    const draft = ui.uploadDraft;
    if (!draft) return;
    draft.selected = all ? new Set(draft.entries.map((entry) => entry.w)) : new Set();
    draft.anchorIndex = null;
    $$("[data-upload-select]", $("#sheetContent")).forEach((input) => {
      input.checked = all;
    });
    updateUploadPickCount();
  }

  function uploadPickInputs() {
    return $$("[data-upload-select]", $("#sheetContent"));
  }

  function setUploadPickInput(input, checked) {
    if (!input || !ui.uploadDraft) return;
    if (input.checked !== checked) input.checked = checked;
    if (checked) ui.uploadDraft.selected.add(input.value);
    else ui.uploadDraft.selected.delete(input.value);
  }

  function uploadPickInputAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const item = el && el.closest ? el.closest(".upload-pick-item") : null;
    return item ? $("[data-upload-select]", item) : null;
  }

  function paintUploadDragAt(x, y) {
    const drag = ui.uploadDrag;
    if (!drag || !ui.uploadDraft) return false;
    const input = uploadPickInputAt(x, y);
    if (!input) return false;
    if (input.checked !== drag.value) {
      setUploadPickInput(input, drag.value);
      drag.applied = true;
      updateUploadPickCount();
    }
    return true;
  }

  function uploadDragTick() {
    const drag = ui.uploadDrag;
    if (!drag || !drag.active) return;
    const scroller = $(".upload-pick-scroll", $("#sheetContent"));
    if (scroller) {
      const rect = scroller.getBoundingClientRect();
      const edge = Math.min(56, rect.height * 0.28);
      let delta = 0;
      if (drag.y < rect.top + edge) delta = -Math.max(3, Math.ceil((rect.top + edge - drag.y) / 3));
      else if (drag.y > rect.bottom - edge) delta = Math.max(3, Math.ceil((drag.y - (rect.bottom - edge)) / 3));
      if (delta) {
        const before = scroller.scrollTop;
        scroller.scrollTop = clamp(scroller.scrollTop + delta, 0, scroller.scrollHeight);
        if (scroller.scrollTop !== before) paintUploadDragAt(drag.x, drag.y);
      }
    }
    drag.raf = requestAnimationFrame(uploadDragTick);
  }

  function beginUploadDrag(event) {
    if (!ui.uploadDraft) return;
    if (event.button != null && event.button !== 0) return;
    const item = event.target.closest(".upload-pick-item");
    if (!item) return;
    const input = $("[data-upload-select]", item);
    if (!input) return;
    const isMouse = event.pointerType === "mouse" || !event.pointerType;
    const drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      value: !input.checked,
      active: isMouse,
      moved: false,
      applied: false,
      timer: 0,
      raf: 0,
    };
    if (!isMouse) {
      // 触摸时从复选框直接拖动，或在词条上按住约 0.3 秒后进入多选。
      if (event.target.closest("input")) {
        drag.active = true;
      } else {
        drag.timer = window.setTimeout(() => {
          if (ui.uploadDrag !== drag) return;
          drag.timer = 0;
          drag.active = true;
          drag.applied = true;
          try { if (navigator.vibrate) navigator.vibrate(8); } catch (error) { /* ignore */ }
          paintUploadDragAt(drag.x, drag.y);
          if (!drag.raf) drag.raf = requestAnimationFrame(uploadDragTick);
        }, 320);
      }
    }
    ui.uploadDrag = drag;
  }

  function moveUploadDrag(event) {
    const drag = ui.uploadDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) {
      drag.moved = true;
    }
    if (!drag.active) {
      if (!drag.moved) return;
      if (drag.timer) {
        clearTimeout(drag.timer);
        drag.timer = 0;
      }
      // 触摸在长按生效前移动，视为滚动，不进入多选。
      if (event.pointerType !== "mouse") {
        ui.uploadDrag = null;
        return;
      }
      drag.active = true;
    }
    if (!drag.moved) return;
    if (drag.timer) {
      clearTimeout(drag.timer);
      drag.timer = 0;
    }
    if (event.cancelable) event.preventDefault();
    paintUploadDragAt(event.clientX, event.clientY);
    if (!drag.raf) drag.raf = requestAnimationFrame(uploadDragTick);
  }

  function moveUploadTouch(event) {
    const drag = ui.uploadDrag;
    if (!drag || !drag.active || !drag.moved) return;
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    drag.x = touch.clientX;
    drag.y = touch.clientY;
    if (event.cancelable) event.preventDefault();
    paintUploadDragAt(drag.x, drag.y);
    if (!drag.raf) drag.raf = requestAnimationFrame(uploadDragTick);
  }

  function endUploadDrag(event) {
    const drag = ui.uploadDrag;
    if (!drag) return;
    if (event && drag.pointerId != null && event.pointerId != null && event.pointerId !== drag.pointerId) return;
    if (drag.timer) clearTimeout(drag.timer);
    if (drag.raf) cancelAnimationFrame(drag.raf);
    if (drag.active && drag.applied) ui.uploadSuppressClick = Date.now() + 400;
    ui.uploadDrag = null;
  }

  function handleUploadPickClick(event) {
    const input = event.target.closest("[data-upload-select]");
    if (!input || !ui.uploadDraft) return;
    if (ui.uploadSuppressClick && Date.now() < ui.uploadSuppressClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const inputs = uploadPickInputs();
    const index = inputs.indexOf(input);
    if (index < 0) return;
    const draft = ui.uploadDraft;
    if (event.shiftKey && draft.anchorIndex != null) {
      const checked = input.checked;
      const start = Math.min(draft.anchorIndex, index);
      const end = Math.max(draft.anchorIndex, index);
      for (let i = start; i <= end; i += 1) setUploadPickInput(inputs[i], checked);
      updateUploadPickCount();
      return;
    }
    draft.anchorIndex = index;
  }

  async function confirmUploadSelection() {
    const draft = ui.uploadDraft;
    if (!draft || ui.uploadBusy) return;
    const entries = draft.entries
      .filter((entry) => draft.selected.has(entry.w))
      .map(({ existing, ...entry }) => entry);
    if (!entries.length) {
      toast("至少选择一个词", true);
      return;
    }
    ui.uploadBusy = true;
    try {
      const result = mergeUpload(entries, draft.fileName);
      saveUpload(result.upload);
      state.upload = result.upload;
      invalidateUploadBook();
      syncUploadBookMeta();
      store.settings.bookId = UPLOAD_BOOK_ID;
      delete store.settings.ranges[UPLOAD_BOOK_ID];
      saveStore();
      ui.uploadDraft = null;
      await ensureBook(UPLOAD_BOOK_ID);
      renderCurrent();
      showUploadResult(result.upload, result.added, draft.fileName, result.truncated, entries.length);
    } catch (error) {
      console.warn("Upload save failed", error);
      toast(error && error.message ? error.message : "保存个人词汇失败", true);
    } finally {
      ui.uploadBusy = false;
    }
  }

  function uploadWordHTML(entry) {
    const library = affiliationFor(entry.w, entry);
    return `
      <button class="upload-word" type="button" data-word="${escAttr(entry.w)}">
        <span class="upload-word-main">
          <strong>${esc(entry.w)}</strong>
          <small>${esc(shortMeaning(entry.m))}</small>
        </span>
        <span class="upload-word-tags">
          ${library ? `<span class="lib-tag lib-${escAttr(library.id)}">${esc(library.short)}</span>` : ""}
        </span>
      </button>`;
  }

  function uploadSectionsHTML(upload) {
    const words = (upload && upload.words) || [];
    const section = (title, items) => items.length ? `
      <div class="upload-section">
        <div class="upload-section-head"><h3>${title}</h3><span>${items.length} 词</span></div>
        <div class="upload-word-list">${items.map(uploadWordHTML).join("")}</div>
      </div>` : "";
    return uploadGroups(words).map((group) => section(group.title, group.items)).join("");
  }

  // 管理弹层里的词条：可勾选（勾中的会被删掉），同样按词汇类别分组。
  function uploadManageSectionsHTML(entries) {
    return uploadGroups(entries).map((group) => `
      <div class="upload-section">
        <div class="upload-section-head"><h3>${group.title}</h3><span>${group.items.length} 词</span></div>
        <div class="upload-pick-list">
          ${group.items.map((entry) => uploadManageItemHTML(entry, false)).join("")}
        </div>
      </div>`).join("");
  }

  function showUploadResult(upload, added, fileName, truncated = false, selected = added) {
    const stats = uploadStats(upload);
    const subtitle = selected === added
      ? `${fileName} · 本次加入 ${added} 词`
      : `${fileName} · 选择 ${selected} 词 · 新增 ${added} 词`;
    openSheet(`
      ${sheetHead("提取完成", subtitle)}
      ${uploadSummaryHTML(stats)}
      <div class="upload-actions">
        <button class="primary-btn" type="button" data-upload-practice>用个人词汇练习</button>
        <button class="ghost-btn" type="button" data-pick-upload>继续上传</button>
      </div>
      <div class="sheet-note">已加入学习范围最前面的「个人词汇」。题目右上角显示词汇类别；同一词同时属于多个词库时，只显示最基础的归属。</div>
      ${truncated ? `<div class="sheet-note">词汇超过 ${UPLOAD_MAX_WORDS} 个，只保留前 ${UPLOAD_MAX_WORDS} 个。</div>` : ""}
      ${uploadSectionsHTML(upload)}
    `);
  }

  function showUploadError(message) {
    openSheet(`
      ${sheetHead("上传失败", "没有生成新的词汇")}
      <div class="empty-state" style="padding:22px 12px 16px">
        <div class="empty-icon">!</div>
        <h3>这次没有提取成功</h3>
        <p>${esc(message)}</p>
        <button class="primary-btn" type="button" data-pick-upload>换一个文件</button>
        <button class="ghost-btn" type="button" data-close-sheet>关闭</button>
      </div>
      <div class="sheet-note">TXT 最稳定；DOCX 和文字版 PDF 通常可以直接读取；扫描版 PDF 需要先 OCR。</div>
    `);
  }

  function openUploadManageSheet() {
    if (!state.upload || !state.upload.words.length) {
      openSheet(`
        ${sheetHead("个人词汇", "还没有收过词")}
        <div class="empty-state" style="padding:22px 12px 16px">
          <div class="empty-icon">${ICONS.upload}</div>
          <h3>两种加法</h3>
          <p>答题后点「加入个人词汇」，一个词一个词攒；或者上传一份试卷，批量提取后勾选要加入的词。</p>
          <button class="primary-btn" type="button" data-pick-upload>上传试卷</button>
        </div>
      `);
      return;
    }
    const stats = uploadStats();
    const files = (state.upload.files || []).length;
    const words = state.upload.words;
    const subtitle = files ? `${stats.total} 词 · 来自 ${files} 份试卷` : `${stats.total} 词 · 答题时逐个加入`;
    // 这个弹层同时是「管理」：勾选词条就能删掉不想要的词。
    ui.uploadDraft = { mode: "delete", entries: words, selected: new Set(), anchorIndex: null };
    openSheet(`
      ${sheetHead("个人词汇", subtitle)}
      ${uploadSummaryHTML(stats)}
      <div class="upload-actions">
        <button class="primary-btn" type="button" data-upload-practice>开始练习</button>
        <button class="ghost-btn" type="button" data-pick-upload>继续上传</button>
        <button class="mini-btn danger" type="button" data-upload-clear>清空</button>
      </div>
      <div class="upload-pick-bar">
        <span class="upload-pick-count" id="uploadPickCount"><strong>0</strong> / ${words.length} 词</span>
        <span class="upload-pick-tools">
          <button class="mini-btn" type="button" data-upload-all>全选</button>
          <button class="mini-btn" type="button" data-upload-none>全不选</button>
          <button class="mini-btn danger" type="button" data-upload-delete disabled>删除选中</button>
        </span>
      </div>
      <div class="sheet-note">勾选要删除的词，再点「删除选中」。Shift 连选；按住拖动可批量勾选。</div>
      <div class="upload-pick-scroll is-delete-mode">
        ${uploadManageSectionsHTML(words)}
      </div>
    `, { maximized: true, focus: false });
    updateUploadPickCount();
  }

  async function activateUploadBook() {
    if (!state.upload || !state.upload.words.length) {
      toast("个人词汇还是空的");
      return;
    }
    syncUploadBookMeta();
    store.settings.bookId = UPLOAD_BOOK_ID;
    saveStore();
    closeSheet();
    renderCurrent();
    try {
      await ensureCurrentBook();
      prewarmRelations(currentBook());
      // 等底部弹层收起的动画结束再开始，避免第一下点击被弹层挡住。
      window.setTimeout(() => {
        startSession("zh2en").catch(() => {});
      }, 320);
    } catch (error) {
      console.warn(error);
      toast("个人词汇加载失败", true);
    }
  }

  function clearUpload() {
    if (!state.upload) return;
    if (!confirm("确定清空个人词汇吗？这些词和「个人词汇」的练习进度都会删除。")) return;
    try {
      localStorage.removeItem(UPLOAD_KEY);
    } catch (error) {
      console.warn(error);
    }
    state.upload = null;
    invalidateUploadBook();
    delete store.progress[UPLOAD_BOOK_ID];
    delete store.settings.ranges[UPLOAD_BOOK_ID];
    for (const day of Object.values(store.daily)) {
      if (day && day.newByBook) delete day.newByBook[UPLOAD_BOOK_ID];
    }
    if (store.settings.bookId === UPLOAD_BOOK_ID) store.settings.bookId = "gaokao";
    saveStore();
    syncUploadBookMeta();
    closeSheet();
    renderCurrent();
    ensureCurrentBook().catch(() => {});
    toast("已清空个人词汇");
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
    const example = found && found.entry.e ? found.entry : null;

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
            <span>${example.paper ? (example.cn ? `试卷原句 · 第${example.cn}题空格` : "试卷原文例句") : "例句"} · 点单词可继续查</span>
            <button class="small-audio" type="button" data-speak="${escAttr(example.cn ? fillClozeGap(example.e, example.w) : example.e)}">${ICONS.speaker} 朗读</button>
          </div>
          <div class="example-en">${example.paper ? renderPaperExample(example.e) : renderTappable(example.e)}</div>
          ${example.t ? `<div class="example-zh">${esc(example.t)}</div>` : ""}
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

  /* ---------------- handwriting recognition ---------------- */
  const HW_MASK_SIZE = 24;
  const HW_ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");
  const HW_FONT_STACKS = [
    '700 48px "Arial", "Helvetica Neue", Helvetica, sans-serif',
    '400 48px "Arial", "Helvetica Neue", Helvetica, sans-serif',
    '700 48px "Verdana", Geneva, sans-serif',
    '400 48px "Trebuchet MS", "Segoe UI", sans-serif',
    '700 48px Georgia, "Times New Roman", serif',
    '400 48px "Courier New", Courier, monospace',
    '600 48px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
    '700 48px "Gill Sans", "Avenir Next", "Trebuchet MS", sans-serif',
    // 常见平板/手机上的印刷体、手写体字体，增加对圆体和略随手写字形的覆盖。
    '600 48px "Chalkboard", "Trebuchet MS", sans-serif',
    '600 48px "Noteworthy", "Comic Sans MS", "Trebuchet MS", sans-serif',
    '600 48px "Marker Felt", "Chalkboard", "Trebuchet MS", sans-serif',
    '600 48px "Bradley Hand", "Chalkboard", "Trebuchet MS", sans-serif',
    '600 48px "Comic Sans MS", "Chalkboard", "Trebuchet MS", sans-serif',
    '600 48px "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif',
    '600 48px "Futura", "Avenir Next", "Trebuchet MS", sans-serif',
    '600 48px "Optima", "Gill Sans", "Trebuchet MS", sans-serif',
    '600 48px "Baskerville", Georgia, "Times New Roman", serif',
    '600 48px "Arial Rounded MT Bold", "Trebuchet MS", sans-serif',
  ];
  let hwTemplateBank = null;
  let hwState = null;

  function hwDistanceField(bits) {
    const size = HW_MASK_SIZE;
    const total = size * size;
    const dist = new Uint8Array(total);
    dist.fill(255);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;
    for (let i = 0; i < total; i += 1) {
      if (bits[i]) {
        dist[i] = 0;
        queue[tail] = i;
        tail += 1;
      }
    }
    const moves = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [-1, 1], [1, -1], [1, 1],
    ];
    while (head < tail) {
      const index = queue[head];
      head += 1;
      const x = index % size;
      const y = Math.floor(index / size);
      const next = dist[index] + 1;
      if (next >= 8) continue;
      for (const [dx, dy] of moves) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const ni = ny * size + nx;
        if (dist[ni] <= next) continue;
        dist[ni] = next;
        queue[tail] = ni;
        tail += 1;
      }
    }
    return dist;
  }

  function hwInkComponents(bits) {
    const size = HW_MASK_SIZE;
    const seen = new Uint8Array(bits.length);
    const queue = new Int32Array(bits.length);
    let count = 0;
    for (let start = 0; start < bits.length; start += 1) {
      if (!bits[start] || seen[start]) continue;
      count += 1;
      let head = 0;
      let tail = 0;
      queue[tail] = start;
      tail += 1;
      seen[start] = 1;
      while (head < tail) {
        const index = queue[head];
        head += 1;
        const x = index % size;
        const y = Math.floor(index / size);
        if (x > 0) { const ni = index - 1; if (bits[ni] && !seen[ni]) { seen[ni] = 1; queue[tail] = ni; tail += 1; } }
        if (x < size - 1) { const ni = index + 1; if (bits[ni] && !seen[ni]) { seen[ni] = 1; queue[tail] = ni; tail += 1; } }
        if (y > 0) { const ni = index - size; if (bits[ni] && !seen[ni]) { seen[ni] = 1; queue[tail] = ni; tail += 1; } }
        if (y < size - 1) { const ni = index + size; if (bits[ni] && !seen[ni]) { seen[ni] = 1; queue[tail] = ni; tail += 1; } }
      }
    }
    return count;
  }

  function hwHoleCount(bits) {
    const size = HW_MASK_SIZE;
    const seen = new Uint8Array(bits.length);
    const queue = new Int32Array(bits.length);
    let head = 0;
    let tail = 0;
    const push = (index) => {
      if (index < 0 || index >= bits.length || bits[index] || seen[index]) return;
      seen[index] = 1;
      queue[tail] = index;
      tail += 1;
    };
    for (let x = 0; x < size; x += 1) { push(x); push((size - 1) * size + x); }
    for (let y = 0; y < size; y += 1) { push(y * size); push(y * size + size - 1); }
    while (head < tail) {
      const index = queue[head];
      head += 1;
      const x = index % size;
      const y = Math.floor(index / size);
      if (x > 0) push(index - 1);
      if (x < size - 1) push(index + 1);
      if (y > 0) push(index - size);
      if (y < size - 1) push(index + size);
    }
    let holes = 0;
    for (let start = 0; start < bits.length; start += 1) {
      if (bits[start] || seen[start]) continue;
      holes += 1;
      let h = 0;
      let t = 0;
      queue[t] = start;
      t += 1;
      seen[start] = 1;
      while (h < t) {
        const index = queue[h];
        h += 1;
        const x = index % size;
        const y = Math.floor(index / size);
        if (x > 0 && !bits[index - 1] && !seen[index - 1]) { seen[index - 1] = 1; queue[t] = index - 1; t += 1; }
        if (x < size - 1 && !bits[index + 1] && !seen[index + 1]) { seen[index + 1] = 1; queue[t] = index + 1; t += 1; }
        if (y > 0 && !bits[index - size] && !seen[index - size]) { seen[index - size] = 1; queue[t] = index - size; t += 1; }
        if (y < size - 1 && !bits[index + size] && !seen[index + size]) { seen[index + size] = 1; queue[t] = index + size; t += 1; }
      }
    }
    return holes;
  }

  function hwProfileFeatures(bits) {
    const size = HW_MASK_SIZE;
    const col = new Float32Array(size);
    const row = new Float32Array(size);
    let ink = 0;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (bits[y * size + x]) {
          col[x] += 1;
          row[y] += 1;
          ink += 1;
        }
      }
    }
    if (ink) {
      for (let i = 0; i < size; i += 1) { col[i] /= ink; row[i] /= ink; }
    }
    let max = 0;
    for (let i = 0; i < size; i += 1) max = Math.max(max, col[i]);
    let bands = 0;
    let inBand = false;
    for (let i = 0; i < size; i += 1) {
      const on = max > 0 && col[i] / max > 0.28;
      if (on && !inBand) bands += 1;
      inBand = on;
    }
    return { col, row, bands };
  }

  function hwProfileDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i] - b[i]);
    return sum;
  }

  function hwMaskFromCanvas(source, sx, sy, sw, sh) {
    if (!source || sw < 2 || sh < 2) return null;
    let data;
    try {
      data = source.getContext("2d").getImageData(sx, sy, sw, sh).data;
    } catch (error) {
      return null;
    }
    let minX = sw;
    let minY = sh;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < sh; y += 1) {
      for (let x = 0; x < sw; x += 1) {
        if (data[(y * sw + x) * 4 + 3] > 35) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return null;
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    if (cropW < 2 || cropH < 2) return null;
    const pad = 2;
    const scale = Math.min((HW_MASK_SIZE - pad * 2) / cropW, (HW_MASK_SIZE - pad * 2) / cropH);
    const drawW = Math.max(1, Math.round(cropW * scale));
    const drawH = Math.max(1, Math.round(cropH * scale));
    const off = document.createElement("canvas");
    off.width = HW_MASK_SIZE;
    off.height = HW_MASK_SIZE;
    const octx = off.getContext("2d");
    octx.imageSmoothingEnabled = true;
    octx.drawImage(
      source,
      sx + minX, sy + minY, cropW, cropH,
      Math.round((HW_MASK_SIZE - drawW) / 2),
      Math.round((HW_MASK_SIZE - drawH) / 2),
      drawW, drawH
    );
    const pixels = octx.getImageData(0, 0, HW_MASK_SIZE, HW_MASK_SIZE).data;
    const bits = new Uint8Array(HW_MASK_SIZE * HW_MASK_SIZE);
    let ink = 0;
    for (let i = 0; i < bits.length; i += 1) {
      if (pixels[i * 4 + 3] > 40) {
        bits[i] = 1;
        ink += 1;
      }
    }
    if (ink < 2) return null;
    const profile = hwProfileFeatures(bits);
    return {
      bits,
      ink,
      aspect: cropW / cropH,
      components: hwInkComponents(bits),
      holes: hwHoleCount(bits),
      colProfile: profile.col,
      rowProfile: profile.row,
      bands: profile.bands,
      relHeight: cropH / sh,
      relWidth: cropW / sw,
      relTop: minY / sh,
      relLeft: minX / sw,
    };
  }

  function buildHandwritingTemplates() {
    if (hwTemplateBank) return hwTemplateBank;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const bank = [];
    for (const font of HW_FONT_STACKS) {
      for (const lower of HW_ALPHABET) {
        for (const form of [lower, lower.toUpperCase()]) {
          ctx.clearRect(0, 0, 64, 64);
          ctx.fillStyle = "#000";
          ctx.font = font;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(form, 32, 34);
          const mask = hwMaskFromCanvas(canvas, 0, 0, 64, 64);
          if (!mask) continue;
          bank.push({
            letter: lower,
            bits: mask.bits,
            ink: mask.ink,
            aspect: mask.aspect,
            components: mask.components,
            holes: mask.holes,
            colProfile: mask.colProfile,
            rowProfile: mask.rowProfile,
            bands: mask.bands,
            relHeight: mask.relHeight,
            relWidth: mask.relWidth,
            relTop: mask.relTop,
            relLeft: mask.relLeft,
            dist: hwDistanceField(mask.bits),
          });
        }
      }
    }
    hwTemplateBank = bank;
    return bank;
  }

  function hwScoreMask(mask, maskDist, template) {
    let outward = 0;
    for (let i = 0; i < mask.bits.length; i += 1) {
      if (mask.bits[i]) outward += Math.min(template.dist[i], 8);
    }
    outward /= Math.max(1, mask.ink);
    let inward = 0;
    for (let i = 0; i < template.bits.length; i += 1) {
      if (template.bits[i]) inward += Math.min(maskDist[i], 8);
    }
    inward /= Math.max(1, template.ink);
    const aspectPenalty = Math.min(1.4, Math.abs(Math.log(mask.aspect / template.aspect))) * 0.55;
    const densityPenalty = Math.min(1.4, Math.abs(Math.log(mask.ink / template.ink))) * 0.05;
    const profilePenalty = (hwProfileDistance(mask.colProfile, template.colProfile) * 0.6 + hwProfileDistance(mask.rowProfile, template.rowProfile) * 0.4) * 0.65;
    const holePenalty = Math.min(3, Math.abs(mask.holes - template.holes)) * 0.32;
    const componentPenalty = Math.min(3, Math.abs(mask.components - template.components)) * 0.16;
    const bandPenalty = Math.min(3, Math.abs(mask.bands - template.bands)) * 0.14;
    // 归一化到 24×24 后，h/n、i/l、a/d 的差别主要在于字高和宽高比，
    // 所以额外比较字母在格子里的相对高度和宽度，避免这些形近字母互相吞掉。
    const heightPenalty = Math.min(1.2, Math.abs(mask.relHeight - template.relHeight)) * 0.9;
    const widthPenalty = Math.min(1.2, Math.abs(mask.relWidth - template.relWidth)) * 0.3;
    return outward * 0.55 + inward * 0.45 + aspectPenalty + densityPenalty + profilePenalty + holePenalty + componentPenalty + bandPenalty + heightPenalty + widthPenalty;
  }

  function classifyHandwritingMask(mask) {
    const bank = buildHandwritingTemplates();
    const maskDist = hwDistanceField(mask.bits);
    const byLetter = new Map();
    for (const template of bank) {
      const score = hwScoreMask(mask, maskDist, template);
      const previous = byLetter.get(template.letter);
      if (!previous || score < previous.score) {
        byLetter.set(template.letter, { letter: template.letter, score });
      }
    }
    const ranked = Array.from(byLetter.values()).sort((a, b) => a.score - b.score);
    return {
      best: ranked[0] || null,
      second: ranked[1] || null,
      scores: byLetter,
    };
  }

  function handwritingGridLayout(chars) {
    const wrap = $("#hwGridWrap");
    const width = Math.max(260, Math.round((wrap && wrap.getBoundingClientRect().width) || 320));
    const maxCols = Math.max(1, Math.min(8, Math.floor(width / 48)));
    const cols = Math.min(Math.max(1, chars.length), maxCols);
    const cellW = Math.min(82, width / cols);
    const offsetX = Math.max(0, (width - cellW * cols) / 2);
    const cellH = 68;
    const rows = Math.ceil(chars.length / cols);
    const height = rows * cellH + 8;
    return { width, cols, rows, cellW, cellH, offsetX, height, yOffset: 4 };
  }

  function hwCellRect(index) {
    const hw = hwState;
    if (!hw) return null;
    const col = index % hw.cols;
    const row = Math.floor(index / hw.cols);
    return {
      x: hw.offsetX + col * hw.cellW,
      y: hw.yOffset + row * hw.cellH,
      w: hw.cellW,
      h: hw.cellH,
    };
  }

  function initHandwritingGrid() {
    const session = ui.session;
    if (!session) return;
    const entry = session.queue[session.index].word;
    const chars = Array.from(entry.w);
    const grid = $("#hwGrid");
    const ink = $("#hwCanvas");
    const wrap = $("#hwGridWrap");
    if (!grid || !ink || !wrap) return;

    const layout = handwritingGridLayout(chars);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    wrap.style.height = `${layout.height}px`;
    for (const canvas of [grid, ink]) {
      canvas.width = Math.max(1, Math.round(layout.width * dpr));
      canvas.height = Math.max(1, Math.round(layout.height * dpr));
    }

    const gctx = grid.getContext("2d");
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gctx.clearRect(0, 0, layout.width, layout.height);
    chars.forEach((char, index) => {
      const rect = {
        x: layout.offsetX + (index % layout.cols) * layout.cellW + 3,
        y: layout.yOffset + Math.floor(index / layout.cols) * layout.cellH + 3,
        w: layout.cellW - 6,
        h: layout.cellH - 6,
      };
      const isLetter = /[a-z]/i.test(char);
      gctx.beginPath();
      gctx.rect(rect.x, rect.y, rect.w, rect.h);
      gctx.fillStyle = isLetter ? "rgba(255, 254, 250, 0.72)" : "rgba(235, 229, 216, 0.6)";
      gctx.fill();
      gctx.strokeStyle = "rgba(173, 160, 138, 0.62)";
      gctx.lineWidth = 1;
      gctx.stroke();
      if (isLetter) {
        // 三条很淡的参考线：上缘、x-height 和基线。真实手写时字高更稳定，
        // 高度/宽度特征也更可靠。
        gctx.save();
        gctx.setLineDash([3, 4]);
        gctx.strokeStyle = "rgba(199, 188, 167, 0.42)";
        for (const ratio of [0.16, 0.5]) {
          gctx.beginPath();
          gctx.moveTo(rect.x + 6, rect.y + rect.h * ratio);
          gctx.lineTo(rect.x + rect.w - 6, rect.y + rect.h * ratio);
          gctx.stroke();
        }
        gctx.setLineDash([]);
        gctx.strokeStyle = "rgba(173, 160, 138, 0.55)";
        gctx.beginPath();
        gctx.moveTo(rect.x + 6, rect.y + rect.h * 0.76);
        gctx.lineTo(rect.x + rect.w - 6, rect.y + rect.h * 0.76);
        gctx.stroke();
        gctx.restore();
      } else {
        gctx.fillStyle = "rgba(120, 108, 88, 0.72)";
        gctx.font = '22px Georgia, "Times New Roman", serif';
        gctx.textAlign = "center";
        gctx.textBaseline = "middle";
        gctx.fillText(char === " " ? "␣" : char, rect.x + rect.w / 2, rect.y + rect.h / 2);
      }
    });

    const ctx = ink.getContext("2d", { willReadFrequently: true });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = "#22302a";
    ctx.lineWidth = 3.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    hwState = {
      entry,
      chars,
      ...layout,
      dpr,
      grid,
      ink,
      ctx,
      drawing: false,
      lastX: 0,
      lastY: 0,
      recognized: "",
    };

    const point = (event) => {
      const rect = ink.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    ink.addEventListener("pointerdown", (event) => {
      if (!ui.session || ui.session.answered) return;
      event.preventDefault();
      hwState.drawing = true;
      const p = point(event);
      hwState.lastX = p.x;
      hwState.lastY = p.y;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.1, p.y + 0.1);
      ctx.stroke();
      try { ink.setPointerCapture(event.pointerId); } catch (error) { /* ignore */ }
    });

    ink.addEventListener("pointermove", (event) => {
      if (!hwState || !hwState.drawing) return;
      event.preventDefault();
      const p = point(event);
      ctx.beginPath();
      ctx.moveTo(hwState.lastX, hwState.lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      hwState.lastX = p.x;
      hwState.lastY = p.y;
    });

    const stop = () => {
      if (!hwState) return;
      hwState.drawing = false;
    };
    ink.addEventListener("pointerup", stop);
    ink.addEventListener("pointercancel", stop);
    ink.addEventListener("pointerleave", stop);

    const status = $("#hwStatus");
    if (status) {
      status.textContent = `请用印刷体填写 ${chars.filter((char) => /[a-z]/i.test(char)).length} 个字母，每格一个。`;
    }
    // 提前生成字体模板，第一次点“识别”时就不用等待。
    window.setTimeout(() => {
      try { buildHandwritingTemplates(); } catch (error) { console.warn("Handwriting templates failed", error); }
    }, 160);
  }

  function clearHandwriting() {
    if (!hwState) return;
    const { ink, ctx } = hwState;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ink.width, ink.height);
    ctx.restore();
    hwState.recognized = "";
    const result = $("#hwResult");
    if (result) result.hidden = true;
    const status = $("#hwStatus");
    if (status) status.textContent = `已清空，请重新用印刷体填写 ${hwState.chars.filter((char) => /[a-z]/i.test(char)).length} 个字母。`;
  }

  function hwCellMask(index) {
    const hw = hwState;
    if (!hw) return null;
    const rect = hwCellRect(index);
    if (!rect) return null;
    const pad = 3;
    const sx = clamp(Math.round((rect.x + pad) * hw.dpr), 0, Math.max(0, hw.ink.width - 2));
    const sy = clamp(Math.round((rect.y + pad) * hw.dpr), 0, Math.max(0, hw.ink.height - 2));
    const sw = clamp(Math.round((rect.w - pad * 2) * hw.dpr), 2, hw.ink.width - sx);
    const sh = clamp(Math.round((rect.h - pad * 2) * hw.dpr), 2, hw.ink.height - sy);
    return hwMaskFromCanvas(hw.ink, sx, sy, sw, sh);
  }

  function finishHandwriting(correct, answer) {
    closeSheet();
    window.setTimeout(() => handleAnswer(Boolean(correct), answer || "手写", null), 30);
  }

  function showHandwritingResult(recognized) {
    const result = $("#hwResult");
    const word = $("#hwRecognized");
    if (!result || !word) return;
    hwState.recognized = recognized;
    word.textContent = recognized || "未识别";
    result.hidden = false;
    const status = $("#hwStatus");
    if (status) status.textContent = "识别结果不太确定。确认后可以按识别结果判分，或重写一次。";
  }

  function recognizeHandwriting() {
    const session = ui.session;
    const hw = hwState;
    if (!session || !hw || session.answered) return;
    const button = $("[data-hw-recognize]");
    const status = $("#hwStatus");
    if (button) button.disabled = true;
    if (status) status.textContent = "正在识别…";
    window.setTimeout(() => {
      try {
        const results = [];
        let missing = -1;
        hw.chars.forEach((char, index) => {
          if (!/[a-z]/i.test(char)) return;
          const mask = hwCellMask(index);
          if (!mask) {
            if (missing < 0) missing = index;
            return;
          }
          const classified = classifyHandwritingMask(mask);
          const target = char.toLowerCase();
          const targetScore = classified.scores.has(target) ? classified.scores.get(target).score : Infinity;
          results.push({
            index,
            target,
            letter: classified.best ? classified.best.letter : "",
            best: classified.best,
            second: classified.second,
            targetScore,
          });
        });

        if (missing >= 0) {
          if (status) status.textContent = `第 ${hw.chars.slice(0, missing + 1).filter((char) => /[a-z]/i.test(char)).length} 个字母格还没有写。`;
          if (button) button.disabled = false;
          return;
        }

        const byIndex = new Map(results.map((item) => [item.index, item.letter]));
        const recognized = hw.chars.map((char, index) => (/[a-z]/i.test(char) ? (byIndex.get(index) || "") : char)).join("");
        const correct = isCorrectAnswer(recognized, hw.entry.w);

        // 既然目标词已知，就不只看“识别第一名”。只要每个格子的笔迹和目标字母
        // 的模板也足够接近，即使它被认成了形近字母，也按目标词判对。这样对真实
        // 手写更宽容；如果某个格子明显更像另一个字母，则判错或让用户重写。
        const targetMargin = (target, bestLetter) => {
          // i/l 在印刷体里几乎一样，交给目标词判断。
          if ((target === "i" && bestLetter === "l") || (target === "l" && bestLetter === "i")) return 0.45;
          // 元音之间（尤其 a/o、e/i）很容易因为圆口写法而误判，宁可回退重写，
          // 不把明显的拼写错误自动判对。
          if ("aeiou".includes(target) && "aeiou".includes(bestLetter)) return 0.15;
          return 0.3;
        };
        const targetPlausible = (item) => {
          if (!item.best) return false;
          if (item.target === item.best.letter) return true;
          return item.targetScore <= 1.8 && item.targetScore <= item.best.score + targetMargin(item.target, item.best.letter);
        };
        const clearlyWrong = (item) => {
          if (!item.best) return false;
          return item.best.score <= 1.2 && item.targetScore >= item.best.score + 0.45;
        };
        const allTargetPlausible = results.every(targetPlausible);
        const allClearlyWrong = results.every(clearlyWrong);

        if (correct || allTargetPlausible) {
          finishHandwriting(true, correct ? recognized : hw.entry.w);
          return;
        }
        if (allClearlyWrong) {
          finishHandwriting(false, recognized);
          return;
        }
        showHandwritingResult(recognized);
        if (button) button.disabled = false;
      } catch (error) {
        console.warn("Handwriting recognition failed", error);
        if (status) status.textContent = "识别失败，请重写一次，或改用键盘输入。";
        if (button) button.disabled = false;
      }
    }, 40);
  }

  function openHandwriting() {
    const session = ui.session;
    if (!session || session.answered || session.mode !== "zh2en") return;
    const entry = session.queue[session.index].word;
    const letterCount = entry.w.replace(/[^a-z]/gi, "").length;
    openSheet(`
      ${sheetHead("手写识别", "用印刷体在格子里写，每格一个字母；大写更准")}
      <div class="hw-hint">中文提示：<strong>${esc(shortMeaning(entry.m))}</strong> · 共 ${letterCount} 个字母</div>
      <div class="hw-grid-wrap" id="hwGridWrap">
        <canvas class="hw-grid" id="hwGrid" aria-hidden="true"></canvas>
        <canvas class="hw-ink" id="hwCanvas" aria-label="手写区域"></canvas>
      </div>
      <div class="hw-status" id="hwStatus">正在准备识别…</div>
      <div class="hw-actions">
        <button class="ghost-btn" type="button" data-hw-clear>清空</button>
        <button class="primary-btn" type="button" data-hw-recognize>识别并提交</button>
      </div>
      <div class="hw-result" id="hwResult" hidden>
        <p>识别结果</p>
        <div class="hw-recognized" id="hwRecognized"></div>
        <p>如果上面的字母就是你写的，按识别结果自动判分；如果识别错了，可以重写。</p>
        <div class="hw-result-actions">
          <button class="primary-btn" type="button" data-hw-use>按识别结果判分</button>
          <button class="ghost-btn" type="button" data-hw-rewrite>重写</button>
        </div>
        <button class="text-btn" type="button" data-hw-reveal style="margin-top:8px;font-size:11px">识别总是不准？看答案自评</button>
        <div class="hw-self" id="hwSelf" hidden>
          <button class="primary-btn" type="button" data-hw-correct>我写对了</button>
          <button class="ghost-btn" type="button" data-hw-wrong>写错了</button>
        </div>
      </div>
      <div class="sheet-note">打印体识别是实验功能：每格只写一个字母，尽量分开、不要连笔。识别不准时建议重写，或切换到内置键盘输入。</div>
    `);
    window.setTimeout(initHandwritingGrid, 40);
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

  async function startSession(mode, options = {}) {
    let book = currentBook();
    if (!book) {
      toast("词库正在加载，请稍候…");
      try {
        book = await ensureCurrentBook();
      } catch (error) {
        toast("词库还没有加载成功，请先重试下载", true);
        return;
      }
    }
    if (!book) return;
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

  function useSoftKeyboard() {
    return Boolean(store.settings.softKeyboard);
  }

  function softKeyboardHTML() {
    const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
    return `
      <div class="soft-keyboard" id="softKeyboard" aria-label="内置英文键盘">
        ${rows.map((row) => `
          <div class="sk-row">
            ${Array.from(row).map((letter) => `<button class="sk-key" type="button" data-key="${letter}">${letter}</button>`).join("")}
          </div>`).join("")}
        <div class="sk-row">
          <button class="sk-key special" type="button" data-key="'">'</button>
          <button class="sk-key special" type="button" data-key="-">-</button>
          <button class="sk-key special wide" type="button" data-key="space">空格</button>
          <button class="sk-key special wide" type="button" data-key="backspace" aria-label="删除一个字母">⌫</button>
          <button class="sk-key special wide submit" type="button" data-key="submit">提交</button>
        </div>
      </div>`;
  }

  function pressSoftKey(key) {
    const session = ui.session;
    if (!session || session.answered || session.mode !== "zh2en") return;
    const input = $("#answerInput");
    if (!input) return;
    if (key === "submit") {
      submitSpelling();
      return;
    }
    if (key === "backspace") {
      input.value = input.value.slice(0, -1);
      return;
    }
    if (key === "space") {
      if (input.value && !input.value.endsWith(" ")) input.value += " ";
      return;
    }
    if (input.value.length >= 48) return;
    input.value += key;
  }

  function questionTagsHTML(item) {
    const entry = item.word;
    const library = affiliationFor(entry.w, entry);
    const libraryTag = library
      ? `<span class="lib-tag lib-${escAttr(library.id)}">${esc(library.short)}</span>`
      : "";
    const newTag = item.isNew ? `<span class="new-tag">新词</span>` : "";
    return `<span class="kicker-tags">${libraryTag}${newTag}</span>`;
  }

  function questionHTML(item) {
    const session = ui.session;
    const entry = item.word;
    if (session.mode === "zh2en") {
      return `
        <div class="question-card">
          <div class="question-inner">
            <div class="question-kicker"><span>看中文 · 写英文</span>${questionTagsHTML(item)}</div>
            <div class="prompt-meaning">${posMeaning(entry.m)}</div>
            <div class="prompt-sub">写出对应的英文单词</div>
            <div class="prompt-tools">
              <button class="audio-btn" type="button" data-speak="${escAttr(entry.w)}">${ICONS.speaker} 听发音</button>
              <button class="ghost-chip" type="button" data-handwriting>${ICONS.pencil} 手写板</button>
            </div>
            <div class="word-slots" aria-label="共 ${entry.w.replace(/[^a-z]/gi, "").length} 个字母">${slotsHTML(entry.w)}</div>
            <input class="answer-input ${useSoftKeyboard() ? "is-soft" : ""}" id="answerInput" type="text"
              inputmode="${useSoftKeyboard() && isTouchDevice() ? "none" : "text"}"
              ${useSoftKeyboard() && isTouchDevice() ? "readonly" : ""}
              autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"
              enterkeyhint="done" aria-label="输入英文单词"
              placeholder="${useSoftKeyboard() ? "用下方键盘输入" : "输入或手写这个单词"}">
            <div class="answer-row ${useSoftKeyboard() ? "is-soft" : ""}">
              ${useSoftKeyboard() ? "" : '<button class="primary-btn" type="button" data-submit>提交</button>'}
              <button class="ghost-btn" type="button" data-hint>提示</button>
              <button class="ghost-btn reveal-btn" type="button" data-reveal>不会</button>
            </div>
            <div class="hint-text" id="hintText"></div>
            ${useSoftKeyboard() ? softKeyboardHTML() : ""}
          </div>
        </div>`;
    }

    const options = session.currentOptions || [];
    return `
      <div class="question-card">
        <div class="question-inner">
          <div class="question-kicker"><span>看英文 · 选中文</span>${questionTagsHTML(item)}</div>
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

    const exampleLabel = entry.paper
      ? (entry.cn ? `试卷原句 · 第${entry.cn}题空格` : "试卷原文例句")
      : "例句";
    // 朗读时把空格填进这个词，读出来才自然；屏幕上仍按原卷显示空格。
    const exampleSpeak = entry.cn ? fillClozeGap(entry.e, entry.w) : entry.e;
    const example = entry.e ? `
      <div class="example-box">
        <div class="example-label">
          <span>${exampleLabel} · 点单词可查</span>
          <button class="small-audio" type="button" data-speak="${escAttr(exampleSpeak)}">${ICONS.speaker} 朗读</button>
        </div>
        <div class="example-en">${entry.paper ? renderPaperExample(entry.e) : renderTappable(entry.e)}</div>
        ${entry.t ? `<div class="example-zh">${esc(entry.t)}</div>` : ""}
        ${entry.cn ? `<div class="example-zh">原句按原卷保留空格；这个词是第 ${entry.cn} 题的一个选项。</div>` : ""}
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
          <span class="feedback-score">${points > 0 ? `+${points}` : "已记入错词"}</span>
        </div>
        <div class="feedback-personal">${personalButtonHTML(entry.w)}</div>
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
      loadWordIndex().catch((error) => console.warn("Word index will load on demand", error));
      if (!state.meta.books.some((book) => book.id === store.settings.bookId)) {
        store.settings.bookId = state.meta.books[0].id;
        saveStore();
      }

      // 元数据很小。先进入应用，再异步加载大词库；这样 Safari / 手机网络
      // 即使下载很慢也不会一直卡在启动页。
      hideSplash();
      updateChrome();
      renderCurrent();
      registerServiceWorker();

      const params = new URLSearchParams(location.search);
      const mode = params.get("mode");
      if (mode === "zh2en" || mode === "en2zh") {
        history.replaceState(null, "", location.pathname + location.hash);
      }

      ensureCurrentBook()
        .then((book) => {
          loadDict().catch((error) => console.warn("Dictionary will load on demand", error));
          if (mode === "zh2en" || mode === "en2zh") {
            window.setTimeout(() => startSession(mode), 180);
          }
          return book;
        })
        .catch((error) => {
          console.warn("Book load failed", error);
          toast("词库下载失败，请联网后点“重新加载词库”", true);
        });
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

  function handleServiceWorkerMessage(event) {
    const data = event.data || {};
    if (data.type === "OFFLINE_PROGRESS") {
      ui.swReady = true;
      ui.offlineProgress = Number(data.done) || 0;
      ui.offlineTotal = Number(data.total) || 6;
      if (ui.tab === "settings") renderSettings();
      return;
    }
    if (data.type === "OFFLINE_READY") {
      ui.swReady = true;
      ui.offlineReady = true;
      ui.offlineProgress = Number(data.total) || 6;
      ui.offlineTotal = Number(data.total) || 6;
      if (ui.tab === "settings") renderSettings();
      if (!sessionStorage.getItem("citing.offlineNotified")) {
        sessionStorage.setItem("citing.offlineNotified", "1");
        window.setTimeout(() => toast("全部词库已离线缓存，断网也能查词"), 900);
      }
      return;
    }
    if (data.type === "OFFLINE_STATUS") {
      ui.swReady = true;
      ui.offlineReady = Boolean(data.ready);
      ui.offlineProgress = Number(data.done) || 0;
      ui.offlineTotal = Number(data.total) || 6;
      if (ui.tab === "settings") renderSettings();
      if (!ui.offlineReady) {
        const worker = navigator.serviceWorker.controller;
        if (worker) worker.postMessage({ type: "CACHE_DATA" });
      }
      return;
    }
    if (data.type === "OFFLINE_ERROR") {
      console.warn("Offline cache failed", data.message || "");
      if (ui.tab === "settings") renderSettings();
    }
  }

  async function requestOfflineCache(manual = false) {
    if (location.protocol === "file:" || !("serviceWorker" in navigator)) {
      if (manual) toast("当前打开方式不支持离线缓存", true);
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      ui.swReady = true;
      const worker = registration.active;
      if (!worker) {
        if (manual) toast("离线缓存还没有准备好，请稍后再试", true);
        return;
      }
      if (manual) toast("正在后台缓存离线词库，可以继续使用");
      worker.postMessage({ type: "CACHE_STATUS" });
      worker.postMessage({ type: "CACHE_DATA" });
      if (ui.tab === "settings") renderSettings();
    } catch (error) {
      console.warn("Offline cache request failed", error);
      if (manual) toast("离线缓存请求失败，请检查网络", true);
    }
  }

  async function registerServiceWorker() {
    if (location.protocol === "file:" || !("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register("sw.js", { scope: "./" });
      navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
      navigator.serviceWorker.ready.then(() => {
        ui.swReady = true;
        if (ui.tab === "settings") renderSettings();
        requestOfflineCache();
      }).catch((error) => console.warn("Service worker ready failed", error));
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
        if (document.visibilityState === "visible" && !ui.offlineReady) requestOfflineCache();
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

    $("#topUpload").addEventListener("click", openUploadPicker);

    $$(".tab").forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    $("#sessionClose").addEventListener("click", () => closeSession());
    $("#backdrop").addEventListener("click", closeSheet);

    $("#view").addEventListener("change", (event) => {
      const select = event.target.closest("[data-setting-select]");
      if (!select) return;
      if (select.dataset.settingSelect === "voice") {
        store.settings.voiceURI = select.value;
        saveStore();
        speak("Hello! This is your English reading voice.", { gesture: true });
      }
    });

    $("#view").addEventListener("click", (event) => {
      const target = event.target;
      if (target.closest("[data-retry-book]")) {
        ui.bookError = "";
        ensureCurrentBook().catch(() => {});
        return;
      }
      const bookButton = target.closest("[data-book]");
      if (bookButton) {
        // 个人词汇卡片点开是「管理」：可以直接删掉不想要的词。
        if (bookButton.dataset.book === UPLOAD_BOOK_ID) openUploadManageSheet();
        else selectBook(bookButton.dataset.book);
        return;
      }
      const rangeButton = target.closest("[data-open-range]");
      if (rangeButton) {
        openRangeSheet();
        return;
      }
      if (target.closest("[data-delete-upload]")) {
        clearUpload();
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
        else if (key === "accent") {
          store.settings.accent = value === "uk" ? "uk" : "us";
          // 换口音时回到系统推荐，避免继续使用另一种口音的语音。
          store.settings.voiceURI = "";
        }
        else if (key === "order") store.settings.order = value === "sequence" ? "sequence" : "random";
        else if (key === "soundVolume") {
          const volume = Number(value);
          store.settings.soundVolume = [0.7, 1, 1.5].includes(volume) ? volume : 1.5;
        }
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
        else if (key === "softKeyboard") {
          store.settings.softKeyboard = !store.settings.softKeyboard;
          if (ui.session && ui.session.mode === "zh2en" && !ui.session.answered) {
            const input = $("#answerInput");
            if (input) input.value = "";
          }
        }
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
        } else if (action === "data-transfer") openDataTransferSheet();
        else if (action === "export") exportData();
        else if (action === "import") importData();
        else if (action === "reset") resetData();
        else if (action === "sound-preview") previewFeedbackSound();
        else if (action === "voice-preview") speak("Hello! This is your English reading voice.", { gesture: true });
        else if (action === "refresh-voices") {
          loadVoices();
          renderSettings();
          toast(voices.length ? `已找到 ${voices.length} 个语音` : "还没有加载到语音，请稍后再试", !voices.length);
        }
        else if (action === "cache-offline") requestOfflineCache(true);
        else if (action === "update") checkUpdate();
        else if (action === "upload-file") openUploadPicker();
        else if (action === "manage-upload") openUploadManageSheet();
        return;
      }
    });

    $("#sessionBody").addEventListener("click", (event) => {
      const target = event.target;
      if (target.closest("[data-submit]")) {
        submitSpelling();
        return;
      }
      if (target.closest("[data-personal-toggle]")) {
        const item = ui.session && ui.session.queue[ui.session.index];
        togglePersonalWord(item ? item.word : null, target.closest("[data-personal-toggle]"));
        return;
      }
      if (target.closest("[data-next]")) {
        nextQuestion();
        return;
      }
      const softKey = target.closest("[data-key]");
      if (softKey) {
        event.preventDefault();
        pressSoftKey(softKey.dataset.key);
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
      // 焦点在个人词汇按钮上时，Enter 交给按钮自己处理，不要跳到下一题。
      if (event.target && event.target.closest && event.target.closest("[data-personal-toggle]")) return;
      if (session.answered) {
        event.preventDefault();
        event.stopPropagation();
        nextQuestion();
        return;
      }
      if (event.target && event.target.id === "answerInput") {
        event.preventDefault();
        // 这一下只负责“提交并显示答案”。如果不拦住冒泡，document 上的
        // Enter 处理会紧接着看到 answered=true，又跳到下一题。
        event.stopPropagation();
        submitSpelling();
      }
    });

    $("#sheetContent").addEventListener("click", (event) => {
      const target = event.target;
      if (target.closest("[data-data-export]")) {
        exportData(selectedScopes());
        return;
      }
      if (target.closest("[data-data-import]")) {
        const chosen = selectedScopes();
        if (!chosen.length) {
          toast("先选择要导入的数据范围", true);
          return;
        }
        importData(chosen);
        return;
      }
      if (target.closest("[data-close-sheet]")) {
        closeSheet();
        return;
      }
      if (target.closest("[data-pick-upload]")) {
        openUploadPicker();
        return;
      }
      if (target.closest("[data-upload-all]")) {
        setUploadSelection(true);
        return;
      }
      if (target.closest("[data-upload-none]")) {
        setUploadSelection(false);
        return;
      }
      if (target.closest("[data-upload-confirm]")) {
        confirmUploadSelection();
        return;
      }
      if (target.closest("[data-upload-delete]")) {
        deleteSelectedUploadWords();
        return;
      }
      if (target.closest("[data-upload-practice]")) {
        activateUploadBook();
        return;
      }
      if (target.closest("[data-upload-clear]")) {
        clearUpload();
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
        clearHandwriting();
        return;
      }
      if (target.closest("[data-hw-recognize]")) {
        recognizeHandwriting();
        return;
      }
      if (target.closest("[data-hw-use]")) {
        if (!hwState) return;
        finishHandwriting(isCorrectAnswer(hwState.recognized, hwState.entry.w), hwState.recognized);
        return;
      }
      if (target.closest("[data-hw-rewrite]")) {
        clearHandwriting();
        return;
      }
      if (target.closest("[data-hw-reveal]")) {
        const self = $("#hwSelf");
        const reveal = target.closest("[data-hw-reveal]");
        if (self) self.hidden = false;
        if (reveal) reveal.hidden = true;
        if (hwState) {
          const status = $("#hwStatus");
          if (status) status.textContent = `答案：${hwState.entry.w}。请对照后选择。`;
        }
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

    $("#sheetContent").addEventListener("change", (event) => {
      const scope = event.target.closest("[data-scope]");
      if (scope) {
        if (scope.dataset.scope === "all") {
          for (const box of scopeCheckboxes()) box.checked = scope.checked;
        }
        updateDataTransferUI();
        return;
      }
      const checkbox = event.target.closest("[data-upload-select]");
      if (!checkbox || !ui.uploadDraft) return;
      if (checkbox.checked) ui.uploadDraft.selected.add(checkbox.value);
      else ui.uploadDraft.selected.delete(checkbox.value);
      updateUploadPickCount();
    });

    $("#sheetContent").addEventListener("click", handleUploadPickClick, true);
    $("#sheetContent").addEventListener("pointerdown", beginUploadDrag);
    document.addEventListener("pointermove", moveUploadDrag, { passive: false });
    document.addEventListener("pointerup", endUploadDrag);
    document.addEventListener("pointercancel", endUploadDrag);
    $("#sheetContent").addEventListener("touchmove", moveUploadTouch, { passive: false });
    $("#sheetContent").addEventListener("contextmenu", (event) => {
      if (ui.uploadDrag && ui.uploadDrag.active) event.preventDefault();
    });

    document.addEventListener("click", (event) => {
      const speechButton = event.target.closest("[data-speak]");
      if (speechButton) {
        event.preventDefault();
        speak(speechButton.dataset.speak, { gesture: true });
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
      if (event.defaultPrevented) return;
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
