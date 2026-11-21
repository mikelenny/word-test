/* 词听 · offline vocabulary dictation */
(() => {
  "use strict";

  const APP_VERSION = "2.0.8";
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
  const PERSONAL_COLORS = ["#8a6a3b", "#5f7a5a", "#7a6a9c", "#a4694c", "#4f7288", "#8a5f75"];
  const PERSONAL_NAME_MAX = 16;

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
    search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.4"/><path d="m15.2 15.2 4.3 4.3"/></svg>`,
  };

  const MODE_LABEL = {
    zh2en: "看中文写英文",
    en2zh: "看英文选中文",
    form: "词形变化",
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
    personal: loadPersonal(),
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
    wordSearchToken: 0,
    dictEntries: null,
    dictEntriesFor: null,
    browseBookId: "",
    manageBookId: "",
    uploadTargetId: "",
    manualTargetId: "",
    swUpdating: false,
    swReloadPending: false,
    wrongSelected: new Set(),
    wrongScope: "",
    importDraft: null,
  };

  // 词形变化结果缓存：同一个词 + 同一份释义只算一次。
  const MORPH_CACHE = new Map();

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
      settings.personalTargetId = typeof settings.personalTargetId === "string" ? settings.personalTargetId : "";
      settings.wrongSort = ["time", "alpha", "count"].includes(settings.wrongSort) ? settings.wrongSort : "time";
      if (typeof settings.dictateForms !== "boolean") settings.dictateForms = true;
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
        personalTargetId: "",
        wrongSort: "time",
        dictateForms: true,
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

  /* ---------------- 个人词汇本（可以建多本、自己命名） ---------------- */
  function normalizePersonalWords(list) {
    return (Array.isArray(list) ? list : [])
      .filter((entry) => entry && typeof entry.w === "string" && entry.w)
      .map((entry) => ({
        ...entry,
        w: entry.w.toLowerCase(),
        m: entry.m || "暂无释义",
        p: entry.p || "",
        beyond: Boolean(entry.beyond),
        freq: Number(entry.freq) || 1,
      }));
  }

  function newPersonalBookId() {
    return `pb${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }

  // 个人词汇存在同一个 localStorage 键里：老版本是一本（直接带 words），
  // 新版本是多本（books 数组），读进来时统一成多本结构。
  function loadPersonal() {
    const empty = { version: 2, books: [], lastUsedId: "" };
    try {
      const raw = JSON.parse(localStorage.getItem(UPLOAD_KEY) || "null");
      if (!raw || typeof raw !== "object") return empty;
      if (Array.isArray(raw.words)) {
        const words = normalizePersonalWords(raw.words);
        if (!words.length) return empty;
        const migrated = {
          version: 2,
          lastUsedId: UPLOAD_BOOK_ID,
          books: [{
            id: UPLOAD_BOOK_ID,
            name: "个人词汇",
            createdAt: raw.createdAt || Date.now(),
            updatedAt: raw.updatedAt || raw.createdAt || Date.now(),
            files: Array.isArray(raw.files) ? raw.files.slice(0, 20) : [],
            words,
          }],
        };
        // 迁移一次就落盘，免得每次启动都重算；失败也不影响本次使用。
        try { localStorage.setItem(UPLOAD_KEY, JSON.stringify(migrated)); } catch (error) { /* ignore */ }
        return migrated;
      }
      const books = (Array.isArray(raw.books) ? raw.books : [])
        .filter((book) => book && typeof book === "object")
        .map((book, index) => ({
          id: typeof book.id === "string" && book.id ? book.id : newPersonalBookId(),
          name: String(book.name || `词汇本 ${index + 1}`).trim().slice(0, PERSONAL_NAME_MAX) || `词汇本 ${index + 1}`,
          createdAt: Number(book.createdAt) || Date.now(),
          updatedAt: Number(book.updatedAt) || Date.now(),
          files: Array.isArray(book.files) ? book.files.slice(0, 20) : [],
          words: normalizePersonalWords(book.words),
        }));
      const lastUsedId = books.some((book) => book.id === raw.lastUsedId)
        ? raw.lastUsedId
        : (books[0] ? books[0].id : "");
      return { version: 2, lastUsedId, books };
    } catch (error) {
      console.warn("Failed to load personal vocabulary", error);
      return empty;
    }
  }

  function savePersonal(personal = state.personal) {
    try {
      localStorage.setItem(UPLOAD_KEY, JSON.stringify(personal));
    } catch (error) {
      console.warn("Failed to save personal vocabulary", error);
      throw new Error("保存失败：设备存储空间可能已满，请先清理一些数据。");
    }
  }

  function personalBooks() {
    return (state.personal && state.personal.books) || [];
  }

  function personalBook(id) {
    return personalBooks().find((book) => book.id === id) || null;
  }

  function personalWordTotal() {
    return personalBooks().reduce((sum, book) => sum + book.words.length, 0);
  }

  function activePersonalBook() {
    return personalBook(state.personal.lastUsedId) || personalBooks()[0] || null;
  }

  // 「加入/导入到哪一本」的默认目标：优先本次指定，其次上次用过的。
  function resolvePersonalTarget(preferred = "") {
    return personalBook(preferred)
      || personalBook(store.settings.personalTargetId)
      || personalBook(state.personal.lastUsedId)
      || personalBooks()[0]
      || null;
  }

  function setPersonalTarget(bookId) {
    if (!personalBook(bookId)) return;
    state.personal.lastUsedId = bookId;
    store.settings.personalTargetId = bookId;
    saveStore();
  }

  function personalMeta(book, index) {
    return {
      id: book.id,
      name: book.name,
      short: book.name,
      subtitle: "自己收进来的词",
      description: `${book.name} · ${book.words.length} 词`,
      color: PERSONAL_COLORS[index % PERSONAL_COLORS.length],
      count: book.words.length,
      personal: true,
    };
  }

  function sanitizePersonalName(name, fallback) {
    const cleaned = String(name || "").replace(/\s+/g, " ").trim().slice(0, PERSONAL_NAME_MAX);
    if (!cleaned) return fallback || `词汇本 ${personalBooks().length + 1}`;
    if (personalBooks().some((book) => book.name === cleaned)) throw new Error("已经有同名词汇本，换个名字吧");
    return cleaned;
  }

  function createPersonalBook(name) {
    const clean = sanitizePersonalName(name);
    const now = Date.now();
    const book = {
      id: newPersonalBookId(),
      name: clean,
      createdAt: now,
      updatedAt: now,
      files: [],
      words: [],
    };
    state.personal.books.push(book);
    state.personal.lastUsedId = book.id;
    savePersonal();
    syncUploadBookMeta();
    return book;
  }

  function renamePersonalBook(bookId, name) {
    const book = personalBook(bookId);
    if (!book) throw new Error("词汇本不存在");
    const clean = String(name || "").replace(/\s+/g, " ").trim().slice(0, PERSONAL_NAME_MAX);
    if (!clean) throw new Error("名字不能为空");
    if (personalBooks().some((item) => item.id !== bookId && item.name === clean)) {
      throw new Error("已经有同名词汇本，换个名字吧");
    }
    book.name = clean;
    book.updatedAt = Date.now();
    savePersonal();
    syncUploadBookMeta();
    return book;
  }

  function forgetBookData(bookId) {
    delete store.progress[bookId];
    delete store.settings.ranges[bookId];
    for (const day of Object.values(store.daily)) {
      if (day && day.newByBook) delete day.newByBook[bookId];
    }
    if (store.settings.bookId === bookId) store.settings.bookId = "gaokao";
    if (store.settings.personalTargetId === bookId) store.settings.personalTargetId = "";
  }

  function deletePersonalBook(bookId) {
    const book = personalBook(bookId);
    if (!book) return false;
    state.personal.books = personalBooks().filter((item) => item.id !== bookId);
    if (state.personal.lastUsedId === bookId) {
      state.personal.lastUsedId = personalBooks()[0] ? personalBooks()[0].id : "";
    }
    forgetBookData(bookId);
    invalidateUploadBook(bookId);
    try {
      savePersonal();
    } catch (error) {
      toast(error && error.message ? error.message : "保存失败", true);
    }
    syncUploadBookMeta();
    saveStore();
    return true;
  }

  function uploadStats(upload = activePersonalBook()) {
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

  // 个人词汇本排在固定词库后面（学习范围第二行），共用同一套练习逻辑。
  function syncUploadBookMeta() {
    if (!state.meta || !Array.isArray(state.meta.books)) return;
    const books = state.meta.books.filter((book) => !book.personal);
    for (const [index, book] of personalBooks().entries()) {
      books.push(personalMeta(book, index));
    }
    state.meta.books = books;
  }

  function invalidateUploadBook(bookId = "") {
    if (bookId) {
      delete state.books[bookId];
      delete state.bookPromises[bookId];
      return;
    }
    for (const book of personalBooks()) {
      delete state.books[book.id];
      delete state.bookPromises[book.id];
    }
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
    const personal = personalBook(id);
    if (personal) {
      if (!personal.words.length) throw new Error(`「${personal.name}」还没有词`);
      const meta = state.meta.books.find((book) => book.id === id);
      const data = {
        id,
        name: personal.name,
        color: meta ? meta.color : "#8a6a3b",
        words: personal.words,
        _index: new Map(personal.words.map((entry, index) => [entry.w, index])),
        _examples: personal.words.filter((entry) => entry.e && !entry.cn),
      };
      state.books[id] = data;
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

  /* ---------------- 词形变化 ---------------- */
  // 词条的释义里如果带词性标注，就直接用来判断动词/形容词/名词；
  // 上传或导入的词条常常没有释义，这时回落到离线词典里的同名词条。
  function morphMeaning(word, meaning) {
    const text = String(meaning || "");
    if (/(?:^|[\s（(,，、;；/&+])(?:n|v|vt|vi|adj|adv|ad|a)\./i.test(text)) return text;
    const row = state.dict && state.dict[word];
    if (row && row[1]) return row[1];
    return text;
  }

  function morphForms(word, meaning, options = {}) {
    if (!window.WordMorph) return [];
    const base = String(word || "").toLowerCase();
    if (!base) return [];
    const source = morphMeaning(base, meaning);
    const key = `${base}|${source}${options.keepDuplicates ? "|all" : ""}${options.keepPairs ? "|pairs" : ""}`;
    if (MORPH_CACHE.has(key)) return MORPH_CACHE.get(key);
    let list = [];
    try {
      list = window.WordMorph.forms(base, source, options) || [];
    } catch (error) {
      list = [];
    }
    MORPH_CACHE.set(key, list);
    return list;
  }

  function practiceForms(word, meaning, options = {}) {
    return morphForms(word, meaning, options).filter((form) => {
      const pool = [form.value, ...(form.alt || [])].map((item) => item.toLowerCase().trim());
      return pool.every((item) => item !== String(word || "").toLowerCase());
    });
  }

  // 听写时只顺带考「特殊变化」：加 -ed / -s / -er 这类按规则来的看一眼就会，
  // pay→paid、good→best、child→children 这种不规则的才值得多占一道题。
  function dictatedForms(word, meaning) {
    return practiceForms(word, meaning).filter((form) => form.irregular);
  }

  // 设置页的自检数字：这一本词库里到底有多少词能出特殊变形。
  // 没有它的话，「开关开着但今天这批词恰好没有不规则词」很容易被当成功能坏了。
  const FORM_STATS_CACHE = new Map();
  function bookFormStats(book) {
    if (!book || !Array.isArray(book.words)) return { words: 0, forms: 0 };
    const key = `${book.id}|${book.words.length}`;
    if (FORM_STATS_CACHE.has(key)) return FORM_STATS_CACHE.get(key);
    let words = 0;
    let forms = 0;
    for (const entry of book.words) {
      const list = dictatedForms(entry.w, entry.m);
      if (!list.length) continue;
      words += 1;
      forms += list.length;
    }
    const stats = { words, forms };
    FORM_STATS_CACHE.set(key, stats);
    return stats;
  }

  // 词典里不少词条把过去式/过去分词直接写在释义最前面，例如 find 的
  // "(found, found) vt. 找到…"。听写时这等于把答案印在题面上，先抹掉。
  function cleanDictationMeaning(meaning) {
    return String(meaning || "")
      .replace(/^\(\s*[a-zA-Z]+(?:\s*[,，/、]\s*[a-zA-Z]+)*\s*\)\s*/, "")
      .trim();
  }

  // 变形按词性分组：动词（过去式/过去分词/现在分词/三单）、名词（复数）、
  // 形容词（比较级/最高级）、副词。和独立 form 模式不同，这里规则变化也一起写。
  const FORM_POS_META = {
    past: { pos: "v.", label: "动词" },
    pp: { pos: "v.", label: "动词" },
    ing: { pos: "v.", label: "动词" },
    third: { pos: "v.", label: "动词" },
    plural: { pos: "n.", label: "名词" },
    comp: { pos: "adj.", label: "形容词" },
    sup: { pos: "adj.", label: "形容词" },
    adv: { pos: "adv.", label: "副词" },
  };
  const FORM_POS_ORDER = ["v.", "n.", "adj.", "adv."];

  // 同一行里可以放两个空：过去式 / 过去分词、比较级 / 最高级。
  // 这样 pay→paid / paid 和 do→did / done 都能让学生自己判断两者是否同形。
  const FORM_PAIRS = [
    { first: "past", second: "pp", label: "过去式 / 过去分词" },
    { first: "comp", second: "sup", label: "比较级 / 最高级" },
  ];

  function dictationFormGroups(entry) {
    if (!entry || !entry.w) return [];
    const groups = new Map();
    // 听写卡片按词性分组，跨词性同形（study 的三单/复数都是 studies）也要各占一行。
    // keepPairs 让同形的过去式和过去分词各留一个空，不在词形层合并。
    for (const form of practiceForms(entry.w, entry.m, { keepDuplicates: true, keepPairs: true })) {
      const meta = FORM_POS_META[form.key];
      if (!meta) continue;
      if (!groups.has(meta.pos)) groups.set(meta.pos, { pos: meta.pos, label: meta.label, lines: [] });
      groups.get(meta.pos).lines.push({
        label: form.label,
        target: form.value,
        alt: form.alt || [],
        form,
        cells: [{ label: form.label, target: form.value, alt: form.alt || [], form }],
      });
    }
    for (const group of groups.values()) {
      for (const pair of FORM_PAIRS) {
        const first = group.lines.find((line) => line.form.key === pair.first);
        const second = group.lines.find((line) => line.form.key === pair.second);
        if (!first || !second) continue;
        first.cells = [
          { label: first.form.label, target: first.form.value, alt: first.alt, form: first.form },
          { label: second.form.label, target: second.form.value, alt: second.alt, form: second.form },
        ];
        first.label = pair.label;
        group.lines.splice(group.lines.indexOf(second), 1);
      }
    }
    return FORM_POS_ORDER.filter((pos) => groups.has(pos)).map((pos) => groups.get(pos));
  }

  // 摊平成输入框序列：一行两空会返回两个 cell，顺序和卡片里的 [data-field] 一致。
  function itemFormLines(item) {
    if (!item || !Array.isArray(item.formGroups) || item.skipForms) return [];
    return item.formGroups.reduce(
      (out, group) => out.concat(
        group.lines.reduce((cells, line) => cells.concat(
          line.cells || [{ label: line.label, target: line.target, alt: line.alt, form: line.form }]
        ), []).map((cell) => ({ ...cell, pos: group.pos, posLabel: group.label }))
      ),
      []
    );
  }

  function isMultiFieldItem(item) {
    return Boolean(item && item.word && !item.form && !item.skipForms
      && Array.isArray(item.formGroups) && item.formGroups.length);
  }

  // 听写队列不再把一个词的变形拆成多道题：一道题里原词一行，变形按词性跟在下面。
  // formGroups 始终保留，「只写原词」只是临时收起，随时能切回多行听写。
  function expandFormItems(items) {
    for (const item of items) {
      if (item.form || !item.word) continue;
      item.formGroups = dictationFormGroups(item.word);
    }
    return items;
  }

  function formValueHTML(form) {
    const alt = form.alt && form.alt.length ? ` / ${form.alt.map((item) => esc(item)).join(" / ")}` : "";
    return `${esc(form.value)}${alt}`;
  }

  function morphBlockHTML(word, meaning, options = {}) {
    const list = morphForms(word, meaning);
    if (!list.length) return "";
    const special = list.some((form) => form.irregular);
    const rows = list.map((form) => `
      <span class="morph-item${form.irregular ? " is-irregular" : ""}">
        <em>${esc(form.label)}</em>
        <strong>${formValueHTML(form)}</strong>
      </span>`).join("");
    return `
      <div class="morph-block">
        <div class="morph-head">
          <strong>词形变化</strong>
          <small>${special ? "红色是需要单独记的特殊变化" : "按规则推导"}</small>
        </div>
        <div class="morph-grid">${rows}</div>
        ${options.practice === false ? "" : `<button class="morph-practice" type="button" data-practice-forms="${escAttr(word)}">${ICONS.pencil} 练这几个变形</button>`}
      </div>`;
  }

  function morphLineHTML(word, meaning) {
    const list = morphForms(word, meaning);
    if (!list.length) return "";
    const text = list
      .map((form) => `${form.label} ${form.value}${form.alt && form.alt.length ? `/${form.alt.join("/")}` : ""}`)
      .join(" · ");
    return `<div class="morph-line"><span>变形</span>${esc(text)}</div>`;
  }

  // 变形题的判定：主写法和不规则表里的另一种写法都算对。
  function isCorrectFormAnswer(input, form) {
    if (!form) return false;
    const value = normalizeAnswer(input);
    if (!value) return false;
    const pool = [form.value, ...(form.alt || [])];
    return pool.some((item) => normalizeAnswer(item) === value);
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
    ui.importDraft = null;
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

  // 标题旁边挂一个小按钮（目前用于「改名字」）。
  function sheetHeadEditable(title, subtitle, action) {
    return `
      <div class="sheet-head">
        <div>
          <h2 id="sheetTitle">${esc(title)}${action || ""}</h2>
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
    const manualTarget = resolvePersonalTarget(ui.manualTargetId);
    ui.manualTargetId = manualTarget ? manualTarget.id : "";

    // 第一行固定词库，第二行个人词汇本（可多本、可新建，铅笔进管理页）。
    const bookCard = (meta, action) => {
      const bStats = progressStats(meta);
      const active = meta.id === book.id;
      return `
        <div class="book-card-wrap">
          <button class="book-card ${active ? "is-active" : ""}" type="button" data-book="${escAttr(meta.id)}" style="color:${escAttr(meta.color)}">
            <span class="book-card-top">
              <i class="book-dot" style="background:${escAttr(meta.color)}"></i>
              <strong style="color:var(--ink)">${esc(meta.name)}</strong>
            </span>
            <small>${bStats.total} 词 · 已学 ${bStats.pct}%</small>
            <span class="mini-progress"><i style="width:${bStats.pct}%;background:${escAttr(meta.color)}"></i></span>
          </button>
          ${action}
        </div>`;
    };
    const fixedCards = state.meta.books
      .filter((meta) => !meta.personal)
      .map((meta) => bookCard(meta, `<button class="book-card-action" type="button" data-book-browse="${escAttr(meta.id)}" aria-label="搜索并浏览${escAttr(meta.name)}">${ICONS.search}</button>`))
      .join("");
    const personalCards = personalBooks().map((item) => {
      const meta = state.meta.books.find((entry) => entry.id === item.id) || personalMeta(item, 0);
      return bookCard(meta, `<button class="book-card-action" type="button" data-book-manage="${escAttr(item.id)}" aria-label="管理${escAttr(item.name)}">${ICONS.pencil}</button>`);
    }).join("");

    const heroSub = newCount > target
      ? (due.length ? `已超额 ${newCount - target} 个新词 · 还有 ${due.length} 个待复习` : `已超额 ${newCount - target} 个新词 · 还能继续加练`)
      : targetDone
        ? (due.length ? `今日新词已完成 · 还有 ${due.length} 个待复习` : "今日任务完成 · 还可以继续加练")
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
      <div class="book-strip">${fixedCards}</div>
      <div class="book-row-head">
        <span>我的词汇本</span>
        <button class="text-btn" type="button" data-new-personal-book>${ICONS.plus} 新建</button>
      </div>
      <div class="book-strip personal-strip">
        ${personalCards}
        <div class="book-card-wrap">
          <button class="book-card book-card-add" type="button" data-new-personal-book>
            <span class="book-card-top"><strong style="color:var(--ink)">新建词汇本</strong></span>
            <small>自己命名，分开放</small>
            <span class="book-add-plus">${ICONS.plus}</span>
          </button>
        </div>
      </div>
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
          <span class="mode-head">
            <span class="mode-icon">${ICONS.pencil}</span>
            <strong>看中文写英文</strong>
          </span>
          <small>听发音 · 拼写 · 手写</small>
        </button>
        <button class="mode-card pick" type="button" data-mode="en2zh">
          <span class="mode-head">
            <span class="mode-icon">${ICONS.list}</span>
            <strong>看英文选中文</strong>
          </span>
          <small>四选一 · 快速识词</small>
        </button>
        <button class="mode-card form" type="button" data-mode="form">
          <span class="mode-head">
            <span class="mode-icon">${ICONS.refresh}</span>
            <strong>词形变化</strong>
          </span>
          <small>good → better · go → went</small>
        </button>
      </div>
      <p class="mode-note">每天 ${target} 个新词 · 错词自动重复出现</p>
      <button type="button" class="forms-flag ${store.settings.dictateForms !== false ? "is-on" : "is-off"}"
        data-toggle="dictateForms" aria-pressed="${store.settings.dictateForms !== false}">
        <span class="forms-flag-dot" aria-hidden="true"></span>
        ${store.settings.dictateForms !== false ? "听写顺带特殊变形 · 已开启" : "听写顺带特殊变形 · 已关闭，点此开启"}
      </button>

      ${wrong.length ? `
        <div class="wrong-teaser">
          <span class="wrong-teaser-icon">${ICONS.book}</span>
          <div class="wrong-teaser-copy">
            <strong>错词本里有 ${wrong.length} 个词</strong>
            <small>${due.length ? `${due.length} 个今天该复习了` : "反复练，直到记牢"}</small>
          </div>
          <button class="soft-btn" type="button" data-go-wrong>去复习</button>
        </div>` : ""}

      <div class="manual-add">
        <div class="section-head">
          <h2>手动加词</h2>
          <span class="sub">先选加到哪一本</span>
        </div>
        ${bookChipsHTML(ui.manualTargetId, "manual")}
        ${wordSearchHTML({ mode: "manual", placeholder: "输入英文词，拼错也会给出相近词", button: "手动检录" })}
      </div>

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

  /* ---------------- 词汇搜索下拉（手动检录 / 词库浏览 / 个人词汇管理） ---------------- */
  // 三处共用同一个「输入 → 下拉候选」组件。候选排序：精确 > 前缀 > 包含 > 编辑距离 1–2。
  // 即便拼写完全正确，也会作为第一项显示英文 + 中文对照，不直接加词。
  function wordSearchHTML(options) {
    const { mode, bookId = "", placeholder, button } = options;
    return `
      <div class="word-search" data-word-search="${escAttr(mode)}" data-book-id="${escAttr(bookId)}">
        <form class="word-search-form" data-word-search-form>
          <input class="word-search-input" type="text" data-word-search-input
            autocapitalize="none" autocomplete="off" spellcheck="false"
            placeholder="${escAttr(placeholder)}" aria-label="${escAttr(placeholder)}">
          <button class="soft-btn word-search-go" type="submit" data-word-search-go>${esc(button)}</button>
        </form>
        <div class="word-search-menu" data-word-search-menu hidden></div>
      </div>`;
  }

  function dictEntries() {
    const dict = state.dict || {};
    if (ui.dictEntries && ui.dictEntriesFor === dict) return ui.dictEntries;
    ui.dictEntries = Object.keys(dict).map((w) => ({ w, p: dict[w][0] || "", m: dict[w][1] || "" }));
    ui.dictEntriesFor = dict;
    return ui.dictEntries;
  }

  function searchWordCandidates(raw, entries, limit = 10) {
    const q = String(raw || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!q) return [];
    const seen = new Set();
    const out = [];
    const push = (entry, score) => {
      const w = String((entry && entry.w) || "").toLowerCase();
      if (!w || seen.has(w)) return;
      seen.add(w);
      out.push({ w, p: entry.p || "", m: entry.m || "", score });
    };
    const list = Array.isArray(entries) ? entries : [];
    for (const entry of list) {
      if (String(entry.w || "").toLowerCase() === q) push(entry, 0);
    }
    for (const entry of list) {
      const w = String(entry.w || "").toLowerCase();
      if (w !== q && w.startsWith(q)) push(entry, 1 + (w.length - q.length) * 0.001);
    }
    for (const entry of list) {
      const w = String(entry.w || "").toLowerCase();
      if (!w.startsWith(q) && w.includes(q)) push(entry, 2 + (w.length - q.length) * 0.001);
    }
    if (out.length < limit) {
      const near = [];
      for (const entry of list) {
        const w = String(entry.w || "").toLowerCase();
        if (seen.has(w) || Math.abs(w.length - q.length) > 2) continue;
        const d = editDistanceAtMost(q, w, 2);
        if (d > 0 && d <= 2) near.push({ entry, d, w });
      }
      near.sort((a, b) => a.d - b.d || a.w.localeCompare(b.w));
      for (const item of near) {
        if (out.length >= limit) break;
        push(item.entry, 3 + item.d);
      }
    }
    out.sort((a, b) => a.score - b.score || a.w.localeCompare(b.w));
    return out.slice(0, limit);
  }

  function renderWordOptions(candidates, mode) {
    const target = mode === "manual" ? resolvePersonalTarget(ui.manualTargetId) : null;
    const hint = mode === "manual"
      ? `点右侧按钮，加入或移出${target ? `「${target.name}」` : "词汇本"}`
      : "点词汇定位到下方列表";
    const head = `<p class="word-search-hint">找到 ${candidates.length} 个相近词 · ${hint}</p>`;
    const items = candidates.map(({ w, p, m }) => {
      const meaning = shortMeaning(m) || "暂无释义";
      if (mode === "manual") {
        const added = target ? inBook(target.id, w) : inPersonalWords(w);
        return `<div class="word-option">
          <span class="word-option-copy"><strong>${esc(w)}</strong><small>${esc(meaning)}</small></span>
          <button class="word-option-action${added ? " is-added" : ""}" type="button"
            data-manual-toggle="${escAttr(w)}" data-ph="${escAttr(p)}" data-m="${escAttr(m)}">
            ${added ? `${ICONS.minus} 移出` : `${ICONS.plus} 加入`}
          </button>
        </div>`;
      }
      return `<button class="word-option is-jump" type="button" data-word-jump="${escAttr(w)}">
        <span class="word-option-copy"><strong>${esc(w)}</strong><small>${esc(meaning)}</small></span>
        <span class="word-option-go">${ICONS.arrow}</span>
      </button>`;
    }).join("");
    return `${head}<div class="word-search-list">${items}</div>`;
  }

  async function runWordSearch(root) {
    if (!root) return;
    const input = $("[data-word-search-input]", root);
    const menu = $("[data-word-search-menu]", root);
    if (!input || !menu) return;
    const token = ++ui.wordSearchToken;
    const mode = root.dataset.wordSearch;
    const raw = input.value.trim().toLowerCase().replace(/[^a-z]/g, "");
    if (!raw) {
      menu.hidden = true;
      menu.innerHTML = "";
      return;
    }
    let entries = [];
    if (mode === "manual") {
      // 离线词典还在缓存时先提示，等缓存完成后继续本次搜索。
      if (!state.dict) {
        menu.innerHTML = `<div class="word-search-empty">正在缓存词典，请稍后…</div>`;
        menu.hidden = false;
        try {
          await loadDict();
        } catch (error) {
          if (token === ui.wordSearchToken) menu.innerHTML = `<div class="word-search-empty">词典加载失败，请稍后重试。</div>`;
          return;
        }
        if (token !== ui.wordSearchToken) return;
      }
      entries = dictEntries();
    } else if (mode === "browse") {
      const book = state.books[root.dataset.bookId];
      entries = book ? book.words : [];
    } else if (mode === "manage") {
      const book = personalBook(root.dataset.bookId) || personalBook(ui.manageBookId) || activePersonalBook();
      entries = book ? book.words : [];
    }
    if (token !== ui.wordSearchToken) return;
    const candidates = searchWordCandidates(raw, entries, 10);
    menu.innerHTML = candidates.length
      ? renderWordOptions(candidates, mode)
      : `<div class="word-search-empty">没有找到相近的词汇，换个拼写试试？</div>`;
    menu.hidden = false;
  }

  function hideWordSearchMenus() {
    $$("[data-word-search-menu]").forEach((menu) => { menu.hidden = true; });
  }

  function handleManualToggle(word, button) {
    if (!word || !button) return;
    const entry = { w: word, p: button.dataset.ph || "", m: button.dataset.m || "暂无释义" };
    const target = resolvePersonalTarget(ui.manualTargetId);
    if (!target) addWordToPersonal(entry, null, true);
    else if (inBook(target.id, word)) removeWordFromPersonal(word, null, true, target.id);
    else addWordToPersonal(entry, null, true, target.id);
    const added = target ? inBook(target.id, word) : inPersonalWords(word);
    button.classList.toggle("is-added", added);
    button.innerHTML = added ? `${ICONS.minus} 移出` : `${ICONS.plus} 加入`;
    // 词汇本词数变了，顺手刷新 chips 上的计数。
    const row = $('[data-target-row="manual"]');
    const activeId = (resolvePersonalTarget(ui.manualTargetId) || {}).id || "";
    if (row) row.outerHTML = bookChipsHTML(activeId, "manual");
  }

  function jumpToWordRow(word) {
    const root = $("#sheetContent");
    if (!root) return;
    const rows = $$("[data-word-row]", root);
    const row = rows.find((item) => item.dataset.wordRow === word);
    if (row) {
      row.scrollIntoView({ block: "center", behavior: "smooth" });
      row.classList.add("is-flash");
      window.setTimeout(() => row.classList.remove("is-flash"), 1400);
    }
    const menu = $("[data-word-search-menu]", root);
    if (menu) menu.hidden = true;
  }

  /* ---------------- wrong words ---------------- */
  // 把「上次错在哪」画出来：拼写题高亮写错/漏掉的字母，选择题显示选成了哪个词。
  function spellSplit(input, target) {
    const a = String(input || "").toLowerCase();
    const b = String(target || "").toLowerCase();
    let head = 0;
    while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
    let tail = 0;
    while (
      tail < a.length - head
      && tail < b.length - head
      && a[a.length - 1 - tail] === b[b.length - 1 - tail]
    ) tail += 1;
    return { head, tail };
  }

  function spellDiffHTML(input, target) {
    const typed = String(input || "").trim();
    if (!typed) return "";
    const right = String(target || "").toLowerCase();
    if (typed.toLowerCase() === right) return `<span class="spell-typed">${esc(typed)}</span>`;
    const { head, tail } = spellSplit(typed, right);
    return `<span class="spell-typed">${esc(typed.slice(0, head))}<em>${esc(typed.slice(head, typed.length - tail))}</em>${esc(typed.slice(typed.length - tail))}</span>`;
  }

  // 正确词里把「你漏掉/多写」的那一段标出来，配合上面的错误写法看。
  function spellTargetHTML(input, target) {
    const typed = String(input || "").trim();
    const right = String(target || "");
    if (!typed) return esc(right);
    const { head, tail } = spellSplit(typed, right);
    const headPart = right.slice(0, head);
    const middle = right.slice(head, right.length - tail);
    const tailPart = right.slice(right.length - tail);
    if (!middle) return esc(right);
    return `${esc(headPart)}<em>${esc(middle)}</em>${esc(tailPart)}`;
  }

  function wrongAttemptHTML(item, word) {
    const wrong = item && item.lastWrong;
    if (!wrong) return "";
    if (wrong.revealed) {
      return `<div class="wrong-attempt"><span class="wrong-attempt-label">上次直接看了答案</span></div>`;
    }
    const input = String(wrong.input || "").trim();
    // 变形题（无论是「词形变化」模式还是听写里顺带考的）都记了 expected。
    if (wrong.expected) {
      return `<div class="wrong-attempt">
          <span class="wrong-attempt-label">${esc(wrong.label || "变形")}</span>
          <strong class="wrong-attempt-right">${esc(wrong.expected)}</strong>
          ${input ? `<span class="wrong-attempt-arrow">·</span><span class="wrong-attempt-label">上次写成</span>${spellDiffHTML(input, wrong.expected)}` : ""}
        </div>`;
    }
    if (!input) return "";
    if (wrong.mode === "en2zh") {
      return `<div class="wrong-attempt">
          <span class="wrong-attempt-label">上次选成</span>
          <span class="wrong-attempt-text">${esc(shortMeaning(input) || input)}</span>
        </div>`;
    }
    return `<div class="wrong-attempt">
        <span class="wrong-attempt-label">上次写成</span>
        ${spellDiffHTML(input, word)}
        <span class="wrong-attempt-arrow">→</span>
        <strong class="wrong-attempt-right">${spellTargetHTML(input, word)}</strong>
      </div>`;
  }

  function updateWrongBatchUI() {
    const boxes = $$("#view [data-wrong-select]");
    const selected = ui.wrongSelected;
    const button = $("#view [data-wrong-delete]");
    if (button) {
      button.disabled = selected.size === 0;
      button.textContent = selected.size ? `删除 ${selected.size} 词` : "删除选中";
    }
    const all = $("#view [data-wrong-select-all]");
    if (all) all.checked = boxes.length > 0 && selected.size === boxes.length;
    $$("#view [data-wrong-row]").forEach((row) => {
      row.classList.toggle("is-selected", selected.has(row.dataset.wrongKey));
    });
  }

  function deleteSelectedWrong() {
    if (!ui.wrongSelected.size) return;
    const keys = [...ui.wrongSelected].map((key) => {
      const cut = key.indexOf("|");
      return cut > 0 ? { bookId: key.slice(0, cut), word: key.slice(cut + 1) } : null;
    }).filter(Boolean);
    if (!keys.length) return;
    if (!confirm(`从错词本删除选中的 ${keys.length} 个词？`)) return;
    for (const { bookId, word } of keys) {
      const progress = progressFor(bookId);
      const item = progress[word];
      if (!item) continue;
      item.mastered = true;
      item.wrongCount = 0;
      item.level = 5;
      item.rightStreak = 0;
      item.due = Date.now() + 3650 * DAY;
    }
    saveStore();
    ui.wrongSelected = new Set();
    renderWrong();
    updateChrome();
    toast(`已删除 ${keys.length} 个错词`);
  }

  // 错词散在各本的 progress 里，先按本聚合，好做「切换词汇本 / 所有」。
  function wrongCountFor(bookId) {
    const progress = store.progress[bookId];
    if (!progress || typeof progress !== "object") return 0;
    let count = 0;
    for (const word of Object.keys(progress)) {
      const item = progress[word];
      if (item && (item.wrongCount || 0) > 0 && !item.mastered) count += 1;
    }
    return count;
  }

  function dictEntryFor(word) {
    const row = state.dict && state.dict[word];
    if (row) return { w: word, p: row[0] || "", m: row[1] || "暂无释义" };
    return { w: word, p: "", m: "暂无释义" };
  }

  const WRONG_SORTS = [
    { id: "time", label: "最近出错" },
    { id: "alpha", label: "字母" },
    { id: "count", label: "错误次数" },
  ];

  function wrongTimeOf(row) {
    const item = (row && row.item) || {};
    return Number((item.lastWrong && item.lastWrong.at) || item.last || item.firstSeen || 0);
  }

  // 错词排序：默认最近出错在前，也可以按字母或按错了多少次。
  function wrongSort(a, b) {
    const mode = store.settings.wrongSort;
    if (mode === "alpha") {
      return a.entry.w.localeCompare(b.entry.w) || wrongTimeOf(b) - wrongTimeOf(a);
    }
    if (mode === "count") {
      return (b.item.wrongCount || 0) - (a.item.wrongCount || 0)
        || wrongTimeOf(b) - wrongTimeOf(a)
        || a.entry.w.localeCompare(b.entry.w);
    }
    return wrongTimeOf(b) - wrongTimeOf(a)
      || (b.item.wrongCount || 0) - (a.item.wrongCount || 0)
      || a.entry.w.localeCompare(b.entry.w);
  }

  function wrongSortChipsHTML() {
    const chips = WRONG_SORTS.map((sort) => `
      <button class="wrong-sort ${store.settings.wrongSort === sort.id ? "is-active" : ""}" type="button"
        data-wrong-sort="${sort.id}" aria-pressed="${store.settings.wrongSort === sort.id}">${sort.label}</button>`).join("");
    return `<div class="wrong-sorts"><span class="wrong-sorts-label">排序</span>${chips}</div>`;
  }

  // 某一本的错词。词库还没加载时用离线词典兜底，保证列表不空。
  function wrongListForBook(bookId) {
    const progress = store.progress[bookId] || {};
    const book = state.books[bookId];
    const personal = personalBook(bookId);
    const words = book ? book.words : (personal ? personal.words : []);
    const out = [];
    const seen = new Set();
    for (const entry of words) {
      const item = progress[entry.w];
      if (item && (item.wrongCount || 0) > 0 && !item.mastered) {
        out.push({ bookId, entry, item });
        seen.add(entry.w);
      }
    }
    for (const word of Object.keys(progress)) {
      if (seen.has(word)) continue;
      const item = progress[word];
      if (!item || !(item.wrongCount > 0) || item.mastered) continue;
      out.push({ bookId, entry: dictEntryFor(word), item });
    }
    return out.sort(wrongSort);
  }

  function wrongScopes() {
    return state.meta.books
      .map((meta) => ({ id: meta.id, name: meta.short || meta.name, color: meta.color, count: wrongCountFor(meta.id) }))
      .filter((scope) => scope.count > 0);
  }

  function wrongListForScope(scopeId) {
    const ids = scopeId ? [scopeId] : state.meta.books.map((meta) => meta.id);
    let out = [];
    for (const id of ids) out = out.concat(wrongListForBook(id));
    return out.sort(wrongSort);
  }

  function wrongScopeChipsHTML(scopes, active, total) {
    if (!scopes.length) return "";
    const chips = scopes.map((scope) => `
      <button class="wrong-scope ${scope.id === active ? "is-active" : ""}" type="button" data-wrong-scope="${escAttr(scope.id)}">
        <i class="wrong-scope-dot" style="background:${escAttr(scope.color)}"></i>${esc(scope.name)}<em>${scope.count}</em>
      </button>`).join("");
    return `
      <div class="wrong-scopes">
        <button class="wrong-scope ${active ? "" : "is-active"}" type="button" data-wrong-scope="">
          所有<em>${total}</em>
        </button>
        ${chips}
      </div>`;
  }

  function renderWrong() {
    const book = currentBook();
    if (!book) {
      renderBookGate("wrong");
      return;
    }
    const scopes = wrongScopes();
    // 选中的那一本已经没错了（或已被删掉）就退回「所有」。
    if (ui.wrongScope && !scopes.some((scope) => scope.id === ui.wrongScope)) ui.wrongScope = "";
    const total = scopes.reduce((sum, scope) => sum + scope.count, 0);
    const list = wrongListForScope(ui.wrongScope);
    const scopeMeta = ui.wrongScope ? state.meta.books.find((meta) => meta.id === ui.wrongScope) : null;
    const scopeName = scopeMeta ? scopeMeta.name : "所有词汇本";
    const now = Date.now();
    const due = list.filter(({ item }) => Number(item.due) <= now).length;
    ui.wrongSelected = new Set();

    if (!total) {
      $("#view").innerHTML = `
        <div class="page-head">
          <div><h2>错词本</h2><p>${esc(book.name)} · 反复练，直到记住</p></div>
          <div class="count-badge"><strong>0</strong><span>错词</span></div>
        </div>
        <div class="empty-state">
          <div class="empty-icon">${ICONS.check}</div>
          <h3>还没有错词</h3>
          <p>练习中答错的单词会自动收进这里，并记下当时写错的样子。</p>
          <button class="primary-btn" type="button" data-go-home>去练习</button>
        </div>`;
      return;
    }

    const head = `
      <div class="page-head">
        <div><h2>错词本</h2><p>${esc(scopeName)} · ${due ? `${due} 个今天到期` : "按遗忘规律安排复习"}</p></div>
        <div class="count-badge"><strong>${list.length}</strong><span>错词</span></div>
      </div>
      ${wrongScopeChipsHTML(scopes, ui.wrongScope, total)}`;

    if (!list.length) {
      $("#view").innerHTML = `
        ${head}
        <div class="empty-state">
          <div class="empty-icon">${ICONS.check}</div>
          <h3>这一本还没有错词</h3>
          <p>切到「所有」可以看到其它词汇本的错词。</p>
          <button class="primary-btn" type="button" data-wrong-scope="">看所有错词</button>
        </div>`;
      return;
    }

    const items = list.map(({ entry, item, bookId }) => {
      const key = `${bookId}|${entry.w}`;
      return `
      <article class="wrong-item" data-wrong-row="${escAttr(entry.w)}" data-wrong-key="${escAttr(key)}">
        <input class="wrong-check" type="checkbox" data-wrong-select value="${escAttr(key)}" aria-label="选择 ${escAttr(entry.w)}">
        <div class="wrong-item-top">
          <div>
            <button class="wrong-word" type="button" data-word="${escAttr(entry.w)}">${esc(entry.w)}</button>
            ${entry.p ? `<div class="wrong-phonetic">/${esc(entry.p)}/</div>` : ""}
          </div>
          <button class="mini-btn" type="button" data-speak="${escAttr(entry.w)}" aria-label="朗读 ${escAttr(entry.w)}">${ICONS.speaker}</button>
        </div>
        <div class="wrong-meaning">${esc(entry.m)}</div>
        ${wrongAttemptHTML(item, entry.w)}
        <div class="wrong-foot">
          <small>${ui.wrongScope ? "" : `${esc((state.meta.books.find((meta) => meta.id === bookId) || {}).short || "")} · `}错 ${item.wrongCount || 1} 次 · ${formatWhen(item.last)}</small>
          <div class="mini-actions">
            <button class="mini-btn" type="button" data-word="${escAttr(entry.w)}">${ICONS.eye} 例句</button>
            <button class="mini-btn danger" type="button" data-remove-word="${escAttr(key)}">移除</button>
          </div>
        </div>
      </article>`;
    }).join("");

    $("#view").innerHTML = `
      ${head}
      ${wrongSortChipsHTML()}
      <div class="wrong-actions">
        <button class="primary-btn" type="button" data-wrong-mode="zh2en">写英文复习</button>
        <button class="ghost-btn" type="button" data-wrong-mode="en2zh">选中文</button>
      </div>
      <div class="wrong-batch">
        <label class="wrong-batch-all"><input type="checkbox" data-wrong-select-all> 全选</label>
        <span class="wrong-batch-hint">勾选后可以批量删除</span>
        <button class="mini-btn danger" type="button" data-wrong-delete disabled>删除选中</button>
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
          <div class="setting-copy"><strong>每天复习</strong><small>到期错词和旧词的复习上限，选 0 就是今天不复习</small></div>
          <div class="segmented" role="group" aria-label="每天复习数量">
            ${[0, 10, 20, 30, 50].map((value) => `
              <button type="button" data-setting="dailyReview" data-value="${value}" aria-label="${value === 0 ? "不复习" : `复习 ${value} 个`}" class="${store.settings.dailyReview === value ? "is-active" : ""}">${value}</button>`).join("")}
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
        <div class="setting-row">
          <div class="setting-copy">
            <strong>听写特殊变形${store.settings.dictateForms === false ? "（已关闭）" : ""}</strong>
            <small>开启后听写 pay 会接着考 paid，只加不规则的过去式、复数、比较级。当前词库 ${bookFormStats(currentBook()).words} 个词共 ${bookFormStats(currentBook()).forms} 条特殊变形</small>
          </div>
          <button type="button" class="switch ${store.settings.dictateForms !== false ? "is-on" : ""}" role="switch" aria-checked="${store.settings.dictateForms !== false}" data-toggle="dictateForms" aria-label="听写特殊变形"></button>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-title">词汇本</div>
        <div class="setting-row">
          <div class="setting-copy">
            <strong>个人词汇本</strong>
            <small>${personalBooks().length
              ? `${personalBooks().length} 本 · 共 ${personalWordTotal()} 词 · 答题时点「加入词汇本」或上传试卷都能加进来`
              : "答题时点「加入词汇本」，或上传试卷批量提取"}</small>
          </div>
          <div class="data-actions">
            ${personalBooks().length ? `<button class="mini-btn" type="button" data-action="manage-upload">管理</button>` : ""}
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
          <div class="setting-copy"><strong>检查更新</strong><small>${ui.swReloadPending ? "新版本已就绪，这一组练完自动刷新" : "发现新版本会自动刷新，不用手动重开"}</small></div>
          <div class="data-actions">
            <button class="mini-btn" type="button" data-action="update">${ICONS.refresh} 检查</button>
            <button class="mini-btn" type="button" data-action="hard-reload">强制重载</button>
          </div>
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

  /* ---------------- 数据导入导出（按词汇本拆分） ---------------- */
  // 每个个人词汇本、每个有错词的词库都是一项：可以单独勾一本导出，也可以整组全选。
  function personalScopeId(bookId) {
    return `personal:${bookId}`;
  }

  function wrongScopeId(bookId) {
    return `wrong:${bookId}`;
  }

  function scopeCategory(id) {
    const raw = String(id || "");
    const cut = raw.indexOf(":");
    return cut > 0 ? raw.slice(0, cut) : raw;
  }

  function bookLabel(bookId) {
    const meta = state.meta.books.find((item) => item.id === bookId);
    return meta ? (meta.name || meta.short || bookId) : bookId;
  }

  // 错词散在各个词库的 progress 里，集中抽出来便于单独导出。
  // names 可选：导入别人的备份时用它把旧 id 翻成词汇本名字。
  function wrongWordsFrom(progress, names = null) {
    const out = [];
    const books = progress && typeof progress === "object" ? progress : {};
    for (const bookId of Object.keys(books)) {
      const map = books[bookId];
      if (!map || typeof map !== "object") continue;
      const label = (names && names[bookId]) || bookLabel(bookId);
      for (const word of Object.keys(map)) {
        const item = map[word];
        if (!item || typeof item !== "object") continue;
        if (!(item.wrongCount > 0) || item.mastered) continue;
        out.push({ b: bookId, n: label, w: word, i: item });
      }
    }
    return out;
  }

  function collectWrongWords() {
    return wrongWordsFrom(store.progress);
  }

  function dataExportGroups() {
    const personal = personalBooks().map((book) => ({
      id: personalScopeId(book.id),
      label: book.name,
      hint: `${book.words.length} 词`,
      count: book.words.length,
    }));
    const wrong = state.meta.books
      .map((meta) => ({
        id: wrongScopeId(meta.id),
        label: meta.short || meta.name,
        count: wrongCountFor(meta.id),
      }))
      .filter((row) => row.count > 0)
      .map((row) => ({ ...row, hint: `${row.count} 个待复习` }));
    return { personal, wrong };
  }

  function allScopeIds() {
    const groups = dataExportGroups();
    return [...groups.personal, ...groups.wrong].map((row) => row.id).concat(["records"]);
  }

  function scopeLabel(id) {
    if (id === "records") return "学习记录";
    const cut = id.indexOf(":");
    const cat = id.slice(0, cut);
    const target = id.slice(cut + 1);
    const label = bookLabel(target);
    return cat === "personal" ? label : `${label} 错词`;
  }

  function scopedPayload(scopes) {
    const set = new Set(scopes);
    const payload = {
      app: "词听",
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      scopes: [...set],
    };
    const personalIds = new Set([...set]
      .filter((id) => id.startsWith("personal:"))
      .map((id) => id.slice("personal:".length)));
    const wrongIds = new Set([...set]
      .filter((id) => id.startsWith("wrong:"))
      .map((id) => id.slice("wrong:".length)));
    if (set.has("personal")) personalBooks().forEach((book) => personalIds.add(book.id));
    if (set.has("wrong")) collectWrongWords().forEach((row) => wrongIds.add(row.b));
    if (personalIds.size && personalBooks().length) {
      payload.personal = {
        version: 2,
        books: personalBooks().filter((book) => personalIds.has(book.id)),
        lastUsedId: state.personal.lastUsedId,
      };
    }
    if (wrongIds.size) payload.wrong = collectWrongWords().filter((row) => wrongIds.has(row.b));
    if (set.has("records")) {
      payload.data = store;
      // 个人本的 id 换设备就变了，带上 id→名字 的对照表，导入时才能把进度认回来。
      const names = {};
      for (const meta of state.meta.books) names[meta.id] = meta.name || meta.short || meta.id;
      for (const id of Object.keys(store.progress || {})) if (!names[id]) names[id] = id;
      payload.bookNames = names;
    }
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

  function scopeRowHTML(id, label, hint, child = true) {
    return `
      <label class="scope-row${child ? " is-child" : ""}">
        <input type="checkbox" data-scope="${escAttr(id)}" checked>
        <span class="scope-text">
          <strong>${esc(label)}</strong>
          ${hint ? `<small>${esc(hint)}</small>` : ""}
        </span>
      </label>`;
  }

  function scopeGroupHeadHTML(group, label, hint, meta) {
    return `
      <label class="scope-row is-group">
        <input type="checkbox" data-group="${escAttr(group)}" checked>
        <span class="scope-text"><strong>${esc(label)}</strong><small>${esc(hint)}</small></span>
        <span class="scope-meta">${esc(meta)}</span>
      </label>`;
  }

  function openDataTransferSheet() {
    const groups = dataExportGroups();
    const personalWords = groups.personal.reduce((sum, row) => sum + (row.count || 0), 0);
    const wrongTotal = groups.wrong.reduce((sum, row) => sum + (row.count || 0), 0);
    const personalBlock = groups.personal.length
      ? `${scopeGroupHeadHTML("personal", "个人词汇", "按词汇本分开导出，也可以只勾一本", `${groups.personal.length} 本 · ${personalWords} 词`)}
         ${groups.personal.map((row) => scopeRowHTML(row.id, row.label, row.hint)).join("")}`
      : `<div class="scope-row is-group is-empty">
           <span class="scope-text"><strong>个人词汇</strong><small>还没有词汇本，先自己建一本</small></span>
         </div>`;
    const wrongBlock = groups.wrong.length
      ? `${scopeGroupHeadHTML("wrong", "错词", "每个词库的错词可以分开导出", `${wrongTotal} 个待复习`)}
         ${groups.wrong.map((row) => scopeRowHTML(row.id, row.label, row.hint)).join("")}`
      : `<div class="scope-row is-group is-empty">
           <span class="scope-text"><strong>错词</strong><small>现在没有待复习的错词</small></span>
         </div>`;
    openSheet(`
      ${sheetHead("数据导入导出", "先选范围，再导出或导入")}
      <div class="scope-list">
        <div class="scope-group">${personalBlock}</div>
        <div class="scope-group">${wrongBlock}</div>
        ${scopeRowHTML("records", "学习记录", "全部进度、每日统计、历史与设置", false)}
        <label class="scope-row is-all">
          <input type="checkbox" data-scope-all checked>
          <span class="scope-text"><strong>全部</strong><small>所有词汇本 + 错词 + 学习记录</small></span>
          <span class="scope-meta" data-scope-total>${scopeSize(allScopeIds())}</span>
        </label>
      </div>
      <div class="upload-pick-actions">
        <button class="primary-btn" type="button" data-data-export>${ICONS.download} 导出全部数据</button>
        <button class="ghost-btn" type="button" data-data-import>${ICONS.upload} 选文件导入</button>
      </div>
      <div class="sheet-note">导出一个 JSON 文件，换设备时把它拷过去导入即可。<br>上面勾的只影响导出：只勾一本词汇本，文件里就只有那一本；错词同理。<br>导入时会先列出文件里有什么，再挑要导入的部分；词汇本和错词都按词合并，已有的不会重复。</div>
    `, { focus: false });
    updateDataTransferUI();
  }

  function scopeCheckboxes() {
    return $$("#sheetContent [data-scope]");
  }

  function selectedScopes() {
    return scopeCheckboxes().filter((box) => box.checked).map((box) => box.dataset.scope);
  }

  function syncScopeGroupStates() {
    $$("#sheetContent [data-group]").forEach((group) => {
      const key = group.dataset.group;
      const children = scopeCheckboxes().filter((box) => scopeCategory(box.dataset.scope) === key);
      const on = children.filter((box) => box.checked).length;
      group.checked = children.length > 0 && on === children.length;
      group.indeterminate = on > 0 && on < children.length;
    });
    const allBox = $("#sheetContent [data-scope-all]");
    if (allBox) {
      const chosen = selectedScopes().length;
      const total = allScopeIds().length;
      allBox.checked = chosen > 0 && chosen === total;
      allBox.indeterminate = chosen > 0 && chosen < total;
    }
  }

  function updateDataTransferUI() {
    syncScopeGroupStates();
    const chosen = selectedScopes();
    const button = $("#sheetContent [data-data-export]");
    if (!button) return;
    const total = allScopeIds().length;
    button.disabled = chosen.length === 0;
    if (!chosen.length) button.innerHTML = "请先选择数据";
    else if (chosen.length === total) button.innerHTML = `${ICONS.download} 导出全部数据`;
    else button.innerHTML = `${ICONS.download} 导出所选 ${chosen.length} 项`;
    const totalEl = $("#sheetContent [data-scope-total]");
    if (totalEl) totalEl.textContent = scopeSize(chosen);
  }

  function safeFileName(name) {
    return String(name || "").replace(/[\\/:*?"<>|\s]+/g, "-").slice(0, 24) || "selected";
  }

  function exportData(scopes = allScopeIds()) {
    const chosen = allScopeIds().filter((id) => scopes.includes(id));
    if (!chosen.length) {
      toast("先选择要导出的数据", true);
      return;
    }
    const payload = scopedPayload(chosen);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const total = allScopeIds().length;
    let tag = "selected";
    if (chosen.length === total) tag = "backup";
    else if (chosen.length === 1) {
      const id = chosen[0];
      if (id === "records") tag = "records";
      else if (id.startsWith("personal:")) tag = `personal-${safeFileName(bookLabel(id.slice(9)))}`;
      else tag = `wrong-${safeFileName(bookLabel(id.slice(6)))}`;
    }
    link.href = url;
    link.download = `citing-${tag}-${todayKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    toast(`已导出：${chosen.map(scopeLabel).join("、")}`);
  }

  // 词汇本名字的唯一键：和新建/改名时的清洗规则保持一致，跨设备才能对上。
  function personalNameKey(name, fallback = "个人词汇") {
    return String(name == null ? "" : name).replace(/\s+/g, " ").trim().slice(0, PERSONAL_NAME_MAX) || fallback;
  }

  // 列出文件里到底有什么。id 一律用「名字」而不是本机 id：
  // 换一台机器后 personal:<id> 根本不存在，照着本机 id 去比对永远是空的。
  function fileScopes(parsed) {
    const rows = [];
    const section = parsed && (parsed.personal || parsed.upload || null);
    if (section && typeof section === "object") {
      const books = Array.isArray(section.books)
        ? section.books.filter((book) => book && Array.isArray(book.words))
        : (Array.isArray(section.words) ? [{ name: "个人词汇", words: section.words }] : []);
      const seen = new Set();
      for (const book of books) {
        const name = personalNameKey(book.name);
        if (seen.has(name)) continue;
        seen.add(name);
        rows.push({
          id: `personal:${name}`,
          cat: "personal",
          name,
          label: name,
          hint: `${book.words.length} 词`,
          count: book.words.length,
        });
      }
    }
    const wrongList = Array.isArray(parsed && parsed.wrong)
      ? parsed.wrong
      : wrongWordsFrom(parsed && parsed.data && parsed.data.progress, parsed && parsed.bookNames);
    const byBook = new Map();
    for (const row of wrongList) {
      if (!row || !row.w) continue;
      const label = personalNameKey(row.n || row.b, row.b || "错词");
      const item = byBook.get(label) || { id: `wrong:${label}`, cat: "wrong", name: label, label, count: 0 };
      item.count += 1;
      byBook.set(label, item);
    }
    for (const item of byBook.values()) rows.push({ ...item, hint: `${item.count} 个错词` });
    if (parsed && parsed.data && typeof parsed.data === "object") {
      rows.push({ id: "records", cat: "records", label: "学习记录", hint: "进度、统计、历史与设置" });
    }
    return rows;
  }

  function fileCats(parsed) {
    return new Set(fileScopes(parsed).map((row) => row.cat));
  }

  // 个人本的 id 换设备会变，错词行里带了词汇本名字，可以按名字找回来。
  function resolveWrongBookId(row) {
    const id = row.b;
    if (!id) return "";
    if (state.meta.books.some((meta) => meta.id === id)) return id;
    if (row.n) {
      const key = personalNameKey(row.n, row.n);
      const byName = personalBooks().find((book) => personalNameKey(book.name, book.name) === key);
      if (byName) return byName.id;
      const meta = state.meta.books.find((item) => personalNameKey(item.name || item.short, String(item.id)) === key);
      if (meta) return meta.id;
    }
    return id;
  }

  function mergeWrongWords(list) {
    let added = 0;
    for (const row of list) {
      const bookId = resolveWrongBookId(row);
      if (!bookId || !row.w) continue;
      if (!store.progress[bookId] || typeof store.progress[bookId] !== "object") store.progress[bookId] = {};
      const map = store.progress[bookId];
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

  // 导入个人词汇：新备份按词汇本逐本合并（同名合并、没有名字就新建），
  // 老备份只有一组 words，统一并进「个人词汇」这一本。
  // nameFilter 有值时只导入这几本（对应「只勾了某一本」）。
  function findOrCreatePersonalBook(name) {
    const clean = personalNameKey(name);
    const found = personalBooks().find((book) => book.name === clean);
    if (found) return found;
    try {
      return createPersonalBook(clean);
    } catch (error) {
      const again = personalBooks().find((book) => book.name === clean);
      if (again) return again;
    }
    // 名字被占（截断或大小写不同）时，另建一本带序号的，绝不把词倒进别的本。
    for (let index = 2; index < 50; index += 1) {
      const alt = `${clean.slice(0, Math.max(1, PERSONAL_NAME_MAX - 3))} ${index}`;
      try {
        return createPersonalBook(alt);
      } catch (error) {
        if (personalBooks().some((book) => book.name === alt)) return personalBooks().find((book) => book.name === alt);
      }
    }
    return null;
  }

  function mergePersonalFrom(section, nameFilter = null) {
    if (!section || typeof section !== "object") return 0;
    let incoming = Array.isArray(section.books)
      ? section.books
        .filter((book) => book && Array.isArray(book.words))
        .map((book) => ({
          name: personalNameKey(book.name),
          words: book.words,
          files: book.files,
        }))
      : (Array.isArray(section.words)
        ? [{ name: "个人词汇", words: section.words, files: section.files }]
        : []);
    if (nameFilter) incoming = incoming.filter((item) => nameFilter.has(item.name));
    let total = 0;
    for (const item of incoming) {
      const words = item.words.filter((entry) => entry && entry.w);
      if (!words.length) continue;
      const target = findOrCreatePersonalBook(item.name);
      if (!target) continue;
      const result = mergeUpload(words, "", { manual: true, bookId: target.id });
      const files = Array.isArray(item.files) ? item.files : [];
      if (files.length) {
        const known = new Set((target.files || []).map((file) => `${file.name}|${file.at}`));
        for (const file of files) {
          if (!file || known.has(`${file.name}|${file.at}`)) continue;
          target.files.push(file);
        }
        target.files = target.files.slice(0, 20);
      }
      total += result.added;
    }
    try {
      savePersonal();
    } catch (error) {
      console.warn("Failed to save imported personal vocabulary", error);
    }
    invalidateUploadBook();
    syncUploadBookMeta();
    return total;
  }

  // 把勾选的范围翻译成「导哪几本」。
  function importSelection(scopes) {
    const ids = new Set(scopes);
    const sel = {
      records: ids.has("records"),
      allPersonal: ids.has("personal"),
      allWrong: ids.has("wrong"),
      personalNames: new Set(),
      wrongNames: new Set(),
      wrongIds: new Set(),
    };
    for (const id of ids) {
      const cut = String(id).indexOf(":");
      if (cut < 0) continue;
      const cat = id.slice(0, cut);
      const sub = id.slice(cut + 1);
      if (cat === "personal") {
        // sub 可能是本机 id，也可能是文件里带的词汇本名字，两种都要认。
        const book = personalBook(sub);
        sel.personalNames.add(book ? book.name : personalNameKey(sub));
      } else if (cat === "wrong") {
        const meta = state.meta.books.find((item) => item.id === sub);
        sel.wrongIds.add(sub);
        sel.wrongNames.add(meta ? (meta.name || meta.short) : personalNameKey(sub, sub));
      }
    }
    return sel;
  }

  // 换设备后个人本的 id 会变：把文件里旧 id 的进度并到本机同名那一本上。
  function remapProgressBookIds(names) {
    if (!names || typeof names !== "object") return 0;
    if (!store.progress || typeof store.progress !== "object") store.progress = {};
    let moved = 0;
    for (const from of Object.keys(store.progress)) {
      if (state.meta.books.some((meta) => meta.id === from)) continue;
      const label = names[from];
      if (!label) continue;
      const book = personalBooks().find((item) => personalNameKey(item.name, item.name) === personalNameKey(label, label));
      if (!book || book.id === from) continue;
      const source = store.progress[from] || {};
      const target = store.progress[book.id] || (store.progress[book.id] = {});
      for (const word of Object.keys(source)) {
        const item = source[word];
        if (!item || typeof item !== "object") continue;
        const existing = target[word];
        if (!existing) {
          target[word] = item;
          continue;
        }
        existing.wrongCount = Math.max(Number(existing.wrongCount) || 0, Number(item.wrongCount) || 0);
        existing.level = Math.max(Number(existing.level) || 0, Number(item.level) || 0);
        existing.rightStreak = Math.max(Number(existing.rightStreak) || 0, Number(item.rightStreak) || 0);
        const dueA = Number(existing.due);
        const dueB = Number(item.due);
        if (Number.isFinite(dueB) && (!Number.isFinite(dueA) || dueB < dueA)) existing.due = dueB;
        if (!item.mastered) existing.mastered = false;
      }
      delete store.progress[from];
      moved += 1;
    }
    if (moved) saveStore();
    return moved;
  }

  function applyImport(parsed, scopes) {
    const cats = fileCats(parsed);
    const sel = importSelection(scopes);
    const wantsPersonal = sel.allPersonal || sel.personalNames.size > 0;
    const wantsWrong = sel.allWrong || sel.wrongNames.size > 0;
    const recordsOk = sel.records && cats.has("records");
    const personalOk = wantsPersonal && cats.has("personal");
    const wrongOk = wantsWrong && cats.has("wrong");
    if (!recordsOk && !personalOk && !wrongOk) {
      return { ok: false, message: "文件里没有你选中的数据" };
    }
    const parts = [];
    let recordsApplied = false;
    if (recordsOk) {
      store = loadStoreFrom(parsed.data);
      saveStore();
      recordsApplied = true;
      parts.push("学习记录");
    }
    // 必须先建好词汇本，错词才认得回自己那一本（错词行里存的是名字）。
    if (personalOk) {
      const section = parsed.personal || parsed.upload || null;
      const added = mergePersonalFrom(section, sel.allPersonal ? null : sel.personalNames);
      parts.push(`个人词汇 +${added} 词`);
    }
    if (recordsApplied) remapProgressBookIds(parsed.bookNames);
    // 学习记录里已经带着错词，重复合并没有意义。
    if (!recordsApplied && wrongOk) {
      let list = Array.isArray(parsed.wrong)
        ? parsed.wrong
        : wrongWordsFrom(parsed.data && parsed.data.progress, parsed.bookNames);
      if (!sel.allWrong) {
        list = list.filter((row) => sel.wrongIds.has(row.b)
          || (row.n && sel.wrongNames.has(personalNameKey(row.n, row.n)))
          || sel.wrongNames.has(row.b));
      }
      if (list.length) {
        const added = mergeWrongWords(list);
        parts.push(`错词 ${list.length} 个（新增 ${added}）`);
      }
    }
    if (!parts.length) return { ok: false, message: "选中的内容在文件里是空的" };
    return { ok: true, message: parts.join(" · ") };
  }

  // 导入前先摊开文件里有什么：范围由文件内容决定，跟本机现有词汇本无关。
  function openImportSheet(parsed, fileName) {
    const rows = fileScopes(parsed);
    if (!rows.length) {
      toast("这个文件不是有效的词听备份", true);
      return;
    }
    const row = (item) => `
      <label class="scope-row is-child">
        <input type="checkbox" data-import-scope="${escAttr(item.id)}" data-import-cat="${escAttr(item.cat)}" checked>
        <span class="scope-text">
          <strong>${esc(item.label)}</strong>
          ${item.hint ? `<small>${esc(item.hint)}</small>` : ""}
        </span>
      </label>`;
    const group = (cat, title, unit) => {
      const items = rows.filter((item) => item.cat === cat);
      if (!items.length) return "";
      const total = items.reduce((sum, item) => sum + (item.count || 0), 0) || items.length;
      return `
        <div class="scope-group">
          <label class="scope-row is-group">
            <input type="checkbox" data-import-group="${escAttr(cat)}" checked>
            <span class="scope-text"><strong>${esc(title)}</strong><small>${items.length} 项 · 共 ${total} ${unit}</small></span>
          </label>
          ${items.map(row).join("")}
        </div>`;
    };
    const records = rows.find((item) => item.cat === "records");
    openSheet(`
      ${sheetHead("导入备份", `${fileName || "备份文件"} · 勾选要导入的部分`)}
      <div class="scope-list">
        ${group("personal", "个人词汇", "词")}
        ${group("wrong", "错词", "个")}
        ${records ? row(records) : ""}
        <label class="scope-row is-all">
          <input type="checkbox" data-import-all checked>
          <span class="scope-text"><strong>全部</strong><small>文件里的全部内容</small></span>
        </label>
      </div>
      <div class="upload-pick-actions">
        <button class="primary-btn" type="button" data-import-go>${ICONS.download} 导入所选</button>
      </div>
      <div class="sheet-note">文件里的词汇本按「词」合并，本机已有的词不会重复添加；本机没有这个词汇本时会自动新建一个同名的。<br>勾了「学习记录」会用文件里的进度、统计和设置覆盖本机。</div>
    `, { focus: false });
    ui.importDraft = { parsed, fileName: fileName || "" };
  }

  // 组头、子项、「全部」三级联动。
  function syncImportGroups() {
    const boxes = $$("#sheetContent [data-import-scope]");
    $$("#sheetContent [data-import-group]").forEach((head) => {
      const cat = head.dataset.importGroup;
      const children = boxes.filter((box) => box.dataset.importCat === cat);
      const on = children.filter((box) => box.checked).length;
      head.checked = children.length > 0 && on === children.length;
      head.indeterminate = on > 0 && on < children.length;
    });
    const all = $("#sheetContent [data-import-all]");
    if (!all) return;
    const on = boxes.filter((box) => box.checked).length;
    all.checked = boxes.length > 0 && on === boxes.length;
    all.indeterminate = on > 0 && on < boxes.length;
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
        if (!fileScopes(parsed).length) {
          toast("这个文件不是有效的词听备份", true);
          return;
        }
        openImportSheet(parsed, file.name);
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
    settings.personalTargetId = typeof settings.personalTargetId === "string" ? settings.personalTargetId : "";
    if (typeof settings.dictateForms !== "boolean") settings.dictateForms = true;
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

  // 等新 worker 出现（最多 timeout 毫秒）；没有就说明已经是最新版。
  async function waitForUpdateWorker(registration, timeout) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (registration.waiting) return registration.waiting;
      const installing = registration.installing;
      if (installing) {
        if (installing.state === "installed") return installing;
        await new Promise((resolve) => {
          const done = () => {
            if (installing.state === "installed" || installing.state === "redundant") resolve();
          };
          installing.addEventListener("statechange", done);
          setTimeout(resolve, 1500);
        });
        if (installing.state === "installed") return installing;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return null;
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
      toast("正在检查更新…");
      await registration.update().catch(() => {});
      const worker = await waitForUpdateWorker(registration, 4000);
      if (worker) {
        toast("发现新版本，正在更新…");
        if (navigator.serviceWorker.controller) {
          worker.postMessage({ type: "SKIP_WAITING" });
        } else {
          applyPendingUpdate();
        }
        return;
      }
      toast(`已是最新版本 v${APP_VERSION}`);
    } catch (error) {
      toast("检查更新失败，请稍后再试", true);
    }
  }

  // 兜底：注销 SW、清掉所有缓存再重新加载。学习记录在 localStorage 里，不受影响。
  async function hardReload() {
    if (!window.confirm("清掉离线缓存并重新加载？学习记录不会丢，但重新加载后要联网重新缓存词库。")) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) await registration.unregister();
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch (error) {
      console.warn("Hard reload cleanup failed", error);
    }
    location.reload();
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
    const personal = personalBook(id);
    if (personal && !personal.words.length) {
      toast(`「${personal.name}」还没有词，先加几个再练`);
      return;
    }
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
    const target = personalBook(options.bookId) || activePersonalBook();
    if (!target) throw new Error("还没有词汇本，请先新建一个");
    const byWord = new Map();
    for (const entry of target.words) byWord.set(entry.w, { ...entry });
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
    const files = Array.isArray(target.files) ? target.files.slice() : [];
    // 手动加入的词没有“试卷”来源，不记到 files 里。
    if (!options.manual && fileName) files.unshift({ name: fileName, at: now, added, matched: entries.length });
    target.words = words;
    target.files = files.slice(0, 20);
    target.updatedAt = now;
    target.createdAt = target.createdAt || now;
    return { book: target, added, truncated: all.length > UPLOAD_MAX_WORDS };
  }

  /* ---------------- 单词 → 个人词汇 ---------------- */
  function booksContainingWord(word) {
    const key = String(word || "").toLowerCase();
    if (!key) return [];
    return personalBooks().filter((book) => book.words.some((entry) => entry.w === key));
  }

  function inPersonalWords(word) {
    return booksContainingWord(word).length > 0;
  }

  function inBook(bookId, word) {
    const book = personalBook(bookId);
    const key = String(word || "").toLowerCase();
    return Boolean(book && key && book.words.some((entry) => entry.w === key));
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

  // 反馈卡里的那一个按钮：不在词汇本里就写「加入」，已经在里面就直接写「从词汇本移除」。
  // 注意不要带 data-word：document 上的查词监听会把它当成“点单词查释义”。
  function personalButtonHTML(word) {
    const added = inPersonalWords(word);
    return `<button class="personal-btn${added ? " is-added" : ""}" type="button" data-personal-toggle>${added
      ? `${ICONS.close} 从词汇本移除`
      : `${ICONS.plus} 加入词汇本`}</button>`;
  }

  function setPersonalButtonState(button, added) {
    if (!button) return;
    button.classList.toggle("is-added", Boolean(added));
    button.innerHTML = added ? `${ICONS.close} 从词汇本移除` : `${ICONS.plus} 加入词汇本`;
  }

  function addWordToPersonal(entry, button, skipRender = false, bookId = "") {
    const item = personalEntryFrom(entry);
    if (!item) return;
    let target = personalBook(bookId) || resolvePersonalTarget();
    if (!target) {
      try {
        target = createPersonalBook("个人词汇");
      } catch (error) {
        toast(error && error.message ? error.message : "新建词汇本失败", true);
        return;
      }
    }
    if (inBook(target.id, item.w)) {
      setPersonalButtonState(button, true);
      toast(`「${item.w}」已经在「${target.name}」里了`);
      return;
    }
    try {
      mergeUpload([item], "", { manual: true, bookId: target.id });
      savePersonal();
      state.personal.lastUsedId = target.id;
      store.settings.personalTargetId = target.id;
      // 新词要能进练习范围：范围和词表重排序对不上，直接放开成全部。
      delete store.settings.ranges[target.id];
      saveStore();
      invalidateUploadBook(target.id);
      syncUploadBookMeta();
      if (!skipRender) {
        if (store.settings.bookId === target.id) ensureBook(target.id).catch(() => {});
        else if (!ui.session) renderCurrent();
      }
      setPersonalButtonState(button, true);
      toast(`「${item.w}」已加入「${target.name}」 · 共 ${target.words.length} 词`);
    } catch (error) {
      console.warn("Failed to add personal word", error);
      toast(error && error.message ? error.message : "加入词汇本失败", true);
    }
  }

  function removeWordFromPersonal(word, button, skipRender = false, bookId = "") {
    const key = String(word || "").toLowerCase();
    const target = personalBook(bookId) || resolvePersonalTarget();
    if (!key || !target) return;
    const remaining = target.words.filter((item) => item.w !== key);
    if (remaining.length === target.words.length) {
      setPersonalButtonState(button, false);
      return;
    }
    const progress = store.progress[target.id];
    if (progress) delete progress[key];

    target.words = remaining;
    target.updatedAt = Date.now();
    try {
      savePersonal();
    } catch (error) {
      toast(error && error.message ? error.message : "保存失败", true);
      return;
    }
    invalidateUploadBook(target.id);
    syncUploadBookMeta();
    // 变空的那一本不再自动删除（可能是用户自己命名的），但当前正在练它就先退回高考。
    if (!remaining.length && store.settings.bookId === target.id) {
      store.settings.bookId = "gaokao";
    }
    saveStore();
    if (!skipRender) {
      if (store.settings.bookId === target.id) ensureBook(target.id).catch(() => {});
      else if (!ui.session) renderCurrent();
    }
    setPersonalButtonState(button, inPersonalWords(key));
    toast(`「${key}」已从「${target.name}」移出 · 还剩 ${remaining.length} 词`);
  }

  function togglePersonalWord(entry, button) {
    const word = String((entry && entry.w) || "").toLowerCase();
    if (!word) return;
    const books = personalBooks();
    // 有多个词汇本时先让用户选加到哪一本（也可以新建）。
    if (books.length > 1) {
      openAddToBookSheet(entry);
      return;
    }
    if (!books.length) {
      addWordToPersonal(entry, button);
      return;
    }
    if (inBook(books[0].id, word)) removeWordFromPersonal(word, button, false, books[0].id);
    else addWordToPersonal(entry, button, false, books[0].id);
  }

  // 多个词汇本时，答题/查词处的「加入词汇本」先问加到哪一本，也能就地新建。
  // 已经在某一本里的，那一行直接显示「移除」。
  function openAddToBookSheet(entry) {
    const item = personalEntryFrom(entry);
    if (!item) return;
    ui.addBookWord = item;
    const rows = personalBooks().map((book) => {
      const added = inBook(book.id, item.w);
      return `
        <button class="book-row ${added ? "is-added" : ""}" type="button" data-add-to-book="${escAttr(book.id)}">
          <span class="book-row-main">
            <strong>${esc(book.name)}</strong>
            <small>${book.words.length} 词${added ? " · 已在这本里" : ""}</small>
          </span>
          <span class="book-row-state">${added ? `${ICONS.close} 移除` : `${ICONS.plus} 加入`}</span>
        </button>`;
    }).join("");
    openSheet(`
      ${sheetHead("加入词汇本", `${item.w} · ${shortMeaning(item.m) || "暂无释义"}`)}
      <div class="add-book-list">
        ${rows || `<div class="word-search-empty">还没有词汇本，在下面新建一个就能直接加进来。</div>`}
      </div>
      <form class="book-create-form" data-add-book-form>
        <input class="word-search-input" type="text" maxlength="${PERSONAL_NAME_MAX}"
          autocapitalize="none" autocomplete="off" placeholder="新建词汇本，例如：作文常用"
          aria-label="新建词汇本名称" data-add-book-name>
        <button class="soft-btn" type="submit">新建并加入</button>
      </form>
      <div class="sheet-note">显示「加入」的点一下加进这一本，显示「移除」的点一下从这一本拿掉。</div>
    `, { focus: false });
  }

  function handleAddToBook(bookId) {
    const item = ui.addBookWord;
    if (!item) return;
    if (inBook(bookId, item.w)) removeWordFromPersonal(item.w, null, false, bookId);
    else addWordToPersonal(item, null, false, bookId);
    const button = $("[data-personal-toggle]");
    if (button) setPersonalButtonState(button, inPersonalWords(item.w));
    openAddToBookSheet(item);
  }

  function handleAddToNewBook(name) {
    const item = ui.addBookWord;
    let book = null;
    try {
      book = createPersonalBook(name);
    } catch (error) {
      toast(error && error.message ? error.message : "新建失败", true);
      return;
    }
    if (item) addWordToPersonal(item, null, false, book.id);
    toast(`已新建「${book.name}」`);
    if (item) openAddToBookSheet(item);
    else closeSheet();
  }

  // 「加到哪一本」的 chips：手动检录和导入选择页共用。
  function bookChipsHTML(activeId, scope) {
    const books = personalBooks();
    const active = books.some((book) => book.id === activeId) ? activeId : (books[0] ? books[0].id : "");
    const chips = books.map((book) => `
      <button class="target-chip ${book.id === active ? "is-active" : ""}" type="button"
        data-target-book="${escAttr(book.id)}" data-target-scope="${escAttr(scope)}">
        ${esc(book.name)}<i>${book.words.length}</i>
      </button>`).join("");
    return `
      <div class="target-chips" data-target-row="${escAttr(scope)}">
        <span class="target-label">${books.length ? "加入" : "还没有词汇本"}</span>
        ${chips}
        <button class="target-chip is-new" type="button" data-new-book="${escAttr(scope)}">${ICONS.plus} 新建</button>
      </div>`;
  }

  function personalTargetForScope(scope) {
    return scope === "upload" ? ui.uploadTargetId : ui.manualTargetId;
  }

  function setPersonalTargetForScope(scope, bookId) {
    if (scope === "upload") ui.uploadTargetId = bookId;
    else ui.manualTargetId = bookId;
    setPersonalTarget(bookId);
    const row = $(`[data-target-row="${scope}"]`);
    if (row) row.outerHTML = bookChipsHTML(bookId, scope);
  }

  function openNewBookSheet(scope) {
    openSheet(`
      ${sheetHead("新建词汇本", "自己取个名字，比如：作文常用 / 阅读生词")}
      <form class="book-create-form" data-new-book-form data-scope="${escAttr(scope)}">
        <input class="word-search-input" type="text" maxlength="${PERSONAL_NAME_MAX}"
          autocapitalize="none" autocomplete="off" placeholder="词汇本名称" aria-label="词汇本名称" data-new-book-name>
        <button class="soft-btn" type="submit">创建</button>
      </form>
      <div class="sheet-note">建好后会自动切到这一本；以后手动加词、导入、听写加词都可以选它。</div>
    `);
    const input = $("#sheetContent [data-new-book-name]");
    if (input) window.setTimeout(() => input.focus(), 120);
  }

  function handleNewBookForm(form) {
    const scope = form.dataset.scope || "manual";
    const input = $("[data-new-book-name]", form);
    let book = null;
    try {
      book = createPersonalBook(input ? input.value : "");
    } catch (error) {
      toast(error && error.message ? error.message : "新建失败", true);
      return;
    }
    setPersonalTarget(book.id);
    if (scope === "upload") {
      // closeSheet 会清掉 ui.uploadDraft，先把选择状态抓在手里，等弹层关掉再恢复。
      const draft = ui.uploadDraft;
      ui.uploadTargetId = book.id;
      closeSheet();
      resumeUploadSelection(draft);
    } else if (scope === "lookup") {
      // 查词页新建：建完就把这个词加进去，再回到这个词的查词页。
      const item = ui.addBookWord;
      ui.addBookWord = null;
      const word = item ? item.w : "";
      if (item) addWordToPersonal(item, null, true, book.id);
      closeSheet();
      if (word) openWordSheet(word);
      else renderCurrent();
    } else {
      ui.manualTargetId = book.id;
      closeSheet();
      renderHome();
    }
    toast(`已新建「${book.name}」`);
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

  function showUploadSelection(entries, fileName, keepSelected = null) {
    const target = resolvePersonalTarget(ui.uploadTargetId);
    ui.uploadTargetId = target ? target.id : "";
    const existing = new Set(((target && target.words) || []).map((entry) => entry.w));
    for (const entry of entries) entry.existing = existing.has(entry.w);
    const selected = keepSelected instanceof Set && keepSelected.size
      ? new Set(entries.filter((entry) => keepSelected.has(entry.w)).map((entry) => entry.w))
      : new Set(entries.map((entry) => entry.w));
    ui.uploadDraft = { entries, fileName, selected, anchorIndex: null };
    const count = entries.length;
    openSheet(`
      ${sheetHead("选择要加入的词", `${fileName} · 识别到 ${count} 词`)}
      ${bookChipsHTML(ui.uploadTargetId, "upload")}
      <div class="upload-pick-bar">
        <span class="upload-pick-count" id="uploadPickCount"><strong>${selected.size}</strong> / ${count} 词</span>
        <span class="upload-pick-tools">
          <button class="mini-btn" type="button" data-upload-all>全选</button>
          <button class="mini-btn" type="button" data-upload-none>全不选</button>
        </span>
      </div>
      <div class="sheet-note">先选加到哪一本（可新建），再取消勾选不想加入的词。Shift 连选；按住拖动可批量勾选。</div>
      <div class="upload-pick-actions">
        <button class="primary-btn" type="button" data-upload-confirm>加入 ${selected.size} 词</button>
        <button class="ghost-btn" type="button" data-pick-upload>换一个文件</button>
      </div>
      <div class="upload-pick-scroll">
        ${uploadPickSectionsHTML(entries, selected)}
      </div>
    `, { maximized: true, focus: false });
    updateUploadPickCount();
  }

  // 新建词汇本后重新打开选择页，保留刚才勾选的词。
  function resumeUploadSelection(draft = ui.uploadDraft) {
    if (!draft) {
      renderHome();
      return;
    }
    const entries = draft.entries.map(({ existing, ...entry }) => entry);
    showUploadSelection(entries, draft.fileName, draft.selected);
  }

  // 学习范围里点「个人词汇」卡片：列出已加入的词，勾选要删的那几个。
  function uploadManageItemHTML(entry, checked) {
    const library = affiliationFor(entry.w, entry);
    return `
      <label class="upload-pick-item" data-word-row="${escAttr(entry.w)}">
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
    const upload = personalBook(ui.manageBookId) || activePersonalBook();
    if (!draft || draft.mode !== "delete" || !upload || !draft.selected.size) return;
    const remove = draft.selected;
    const remaining = upload.words.filter((entry) => !remove.has(entry.w));
    const removed = upload.words.length - remaining.length;
    const progress = store.progress[upload.id];
    if (progress) for (const word of remove) delete progress[word];
    closeSheet();

    upload.words = remaining;
    upload.updatedAt = Date.now();
    try {
      savePersonal();
    } catch (error) {
      toast(error && error.message ? error.message : "保存失败", true);
      return;
    }
    invalidateUploadBook(upload.id);
    // 删空了就把当前词库退回高考，但保留这个词汇本本身（可以继续加词或改名）。
    if (!remaining.length && store.settings.bookId === upload.id) store.settings.bookId = "gaokao";
    syncUploadBookMeta();
    saveStore();
    renderCurrent();
    ensureCurrentBook().catch(() => {});
    toast(remaining.length ? `已删除 ${removed} 个词` : `已删除 ${removed} 个词，「${upload.name}」空了`);
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
      let target = resolvePersonalTarget(ui.uploadTargetId);
      if (!target) target = createPersonalBook("个人词汇");
      const result = mergeUpload(entries, draft.fileName, { bookId: target.id });
      savePersonal();
      setPersonalTarget(target.id);
      ui.uploadTargetId = target.id;
      invalidateUploadBook(target.id);
      syncUploadBookMeta();
      store.settings.bookId = target.id;
      delete store.settings.ranges[target.id];
      saveStore();
      ui.uploadDraft = null;
      await ensureBook(target.id);
      renderCurrent();
      showUploadResult(target, result.added, draft.fileName, result.truncated, entries.length);
    } catch (error) {
      console.warn("Upload save failed", error);
      toast(error && error.message ? error.message : "保存词汇本失败", true);
    } finally {
      ui.uploadBusy = false;
    }
  }

  function uploadWordHTML(entry) {
    const library = affiliationFor(entry.w, entry);
    return `
      <button class="upload-word" type="button" data-word="${escAttr(entry.w)}" data-word-row="${escAttr(entry.w)}">
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
        <button class="primary-btn" type="button" data-upload-practice>用这个词汇本练习</button>
        <button class="ghost-btn" type="button" data-pick-upload>继续上传</button>
      </div>
      <div class="sheet-note">已加入「${esc(upload.name)}」，学习范围第二行就能看到它。题目右上角显示词汇类别；同一词同时属于多个词库时，只显示最基础的归属。</div>
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

  // 学习范围里点词库右上角的放大镜：只读浏览该词库全部词汇，顶部可搜索定位。
  async function openBookBrowseSheet(bookId) {
    const meta = state.meta.books.find((item) => item.id === bookId);
    if (!meta) return;
    let book = state.books[bookId];
    if (!book) {
      toast("正在加载词库…");
      try {
        book = await ensureBook(bookId);
      } catch (error) {
        toast("词库加载失败，请稍候再试", true);
        return;
      }
    }
    ui.browseBookId = bookId;
    openSheet(`
      ${sheetHead(meta.name, `共 ${book.words.length} 词 · 点单词可查释义`)}
      ${wordSearchHTML({ mode: "browse", bookId, placeholder: "输入英文词，下拉显示相近词汇", button: "搜索" })}
      <div class="sheet-note">只读词库列表，没有增删功能；顶部搜索框可快速定位到某个词。</div>
      <div class="upload-pick-scroll" data-browse-scroll>
        ${uploadSectionsHTML({ words: book.words })}
      </div>
    `, { maximized: true, focus: false });
  }

  // 管理页顶部：多本时可以直接切到另一本去管理，不用退回去点卡片。
  function manageBookChipsHTML(activeId) {
    const books = personalBooks();
    if (books.length < 2) return "";
    const chips = books.map((book) => `
      <button class="target-chip ${book.id === activeId ? "is-active" : ""}" type="button" data-manage-book="${escAttr(book.id)}">
        ${esc(book.name)}<i>${book.words.length}</i>
      </button>`).join("");
    return `<div class="target-chips"><span class="target-label">管理</span>${chips}</div>`;
  }

  function openUploadManageSheet(bookId = "") {
    // 明确指定了某一本就必须管理那一本，找不到时不要悄悄换成别的本。
    const wanted = personalBook(bookId);
    if (!wanted && bookId) {
      toast("这个词汇本已经不在了", true);
      renderCurrent();
      return;
    }
    const book = wanted || activePersonalBook();
    if (!book) {
      openSheet(`
        ${sheetHead("个人词汇", "还没有词汇本")}
        <div class="empty-state" style="padding:22px 12px 16px">
          <div class="empty-icon">${ICONS.upload}</div>
          <h3>先建一个词汇本</h3>
          <p>可以自己命名，比如「作文常用」「阅读生词」；也可以上传试卷，提取后选一本加进去。</p>
          <button class="primary-btn" type="button" data-new-personal-book>新建词汇本</button>
          <button class="ghost-btn" type="button" data-pick-upload>上传试卷</button>
        </div>
      `);
      return;
    }
    ui.manageBookId = book.id;
    const stats = uploadStats(book);
    const files = (book.files || []).length;
    const words = book.words;
    const subtitle = words.length
      ? (files ? `${stats.total} 词 · 来自 ${files} 份试卷` : `${stats.total} 词 · 手动/答题时加入`)
      : "这一本还是空的";
    // 这个弹层同时是「管理」：勾选词条就能删掉不想要的词。
    ui.uploadDraft = { mode: "delete", entries: words, selected: new Set(), anchorIndex: null };
    openSheet(`
      ${sheetHeadEditable(book.name, subtitle, `<button class="title-edit" type="button" data-rename-book aria-label="修改词汇本名称">${ICONS.pencil}</button>`)}
      ${manageBookChipsHTML(book.id)}
      ${wordSearchHTML({ mode: "manage", bookId: book.id, placeholder: "输入英文词，下拉显示这一本的词", button: "搜索" })}
      ${uploadSummaryHTML(stats)}
      <div class="upload-actions">
        <button class="primary-btn" type="button" data-upload-practice>开始练习</button>
        <button class="ghost-btn" type="button" data-pick-upload>继续上传</button>
      </div>
      <div class="book-manage-tools">
        <button class="mini-btn" type="button" data-rename-book>重命名</button>
        <button class="mini-btn danger" type="button" data-delete-book>删除这本</button>
        <button class="mini-btn danger" type="button" data-upload-clear>清空词汇</button>
      </div>
      ${words.length ? `
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
        </div>` : `
        <div class="sheet-note">用上面的搜索框能把词加进来，或者点「继续上传」导入试卷。</div>`}
    `, { maximized: true, focus: false });
    updateUploadPickCount();
  }

  function openRenameBookSheet(bookId = ui.manageBookId) {
    const book = personalBook(bookId);
    if (!book) return;
    openSheet(`
      ${sheetHead("重命名词汇本", `${book.words.length} 词`)}
      <form class="book-create-form" data-rename-book-form data-book-id="${escAttr(book.id)}">
        <input class="word-search-input" type="text" maxlength="${PERSONAL_NAME_MAX}" value="${escAttr(book.name)}"
          autocomplete="off" aria-label="词汇本名称" data-rename-book-name>
        <button class="soft-btn" type="submit">保存</button>
      </form>
      <div class="sheet-note">只改名字，里面的词和练习进度都不变。</div>
    `);
    const input = $("#sheetContent [data-rename-book-name]");
    if (input) window.setTimeout(() => { input.focus(); input.select(); }, 120);
  }

  function handleRenameBookForm(form) {
    const bookId = form.dataset.bookId;
    const input = $("[data-rename-book-name]", form);
    try {
      const book = renamePersonalBook(bookId, input ? input.value : "");
      saveStore();
      renderCurrent();
      toast(`已改名为「${book.name}」`);
      openUploadManageSheet(book.id);
    } catch (error) {
      toast(error && error.message ? error.message : "改名失败", true);
    }
  }

  async function activateUploadBook() {
    const book = personalBook(ui.manageBookId) || activePersonalBook();
    if (!book || !book.words.length) {
      toast("这个词汇本还是空的");
      return;
    }
    syncUploadBookMeta();
    store.settings.bookId = book.id;
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

  function clearUpload(bookId = ui.manageBookId) {
    const book = personalBook(bookId) || activePersonalBook();
    if (!book || !book.words.length) return;
    if (!confirm(`确定清空「${book.name}」吗？里面的词和这一本的练习进度都会删除，词汇本本身会保留。`)) return;
    book.words = [];
    book.updatedAt = Date.now();
    try {
      savePersonal();
    } catch (error) {
      toast(error && error.message ? error.message : "保存失败", true);
      return;
    }
    invalidateUploadBook(book.id);
    delete store.progress[book.id];
    delete store.settings.ranges[book.id];
    for (const day of Object.values(store.daily)) {
      if (day && day.newByBook) delete day.newByBook[book.id];
    }
    if (store.settings.bookId === book.id) store.settings.bookId = "gaokao";
    saveStore();
    syncUploadBookMeta();
    closeSheet();
    renderCurrent();
    ensureCurrentBook().catch(() => {});
    toast(`已清空「${book.name}」`);
  }

  /* ---------------- lookup ---------------- */
  // 查词页的「加入词汇本」：不占一整行的大按钮，直接把各本列出来点一下就加。
  function lookupBookPicksHTML(word) {
    const books = personalBooks();
    const chips = books.map((book) => {
      const added = inBook(book.id, word);
      return `
        <button class="book-pick ${added ? "is-added" : ""}" type="button" data-lookup-book="${escAttr(book.id)}">
          <span class="book-pick-name">${esc(book.name)}</span>
          <small>${book.words.length}</small>
          <i class="book-pick-mark">${added ? "移除" : "加入"}</i>
        </button>`;
    }).join("");
    return `
      <div class="lookup-personal" data-lookup-personal>
        <div class="lookup-personal-head">
          <strong>加入词汇本</strong>
          <small>${books.length ? "在里面的显示「移除」，不在的显示「加入」" : "还没有词汇本，先建一本"}</small>
        </div>
        <div class="book-picks">
          ${chips}
          <button class="book-pick is-new" type="button" data-lookup-new-book>${ICONS.plus}<span class="book-pick-name">新建</span></button>
        </div>
      </div>`;
  }

  function handleLookupBookPick(bookId) {
    const word = String((ui.currentLookup && ui.currentLookup.base) || "").toLowerCase();
    if (!word) return;
    const lookup = ui.currentLookup || {};
    const entry = lookup.entry || { w: word, p: lookup.phonetic || "", m: lookup.meaning || "" };
    if (inBook(bookId, word)) {
      removeWordFromPersonal(word, null, true, bookId);
      const book = personalBook(bookId);
      if (book) toast(`已从「${book.name}」移出`);
    } else {
      addWordToPersonal(entry, null, true, bookId);
      const book = personalBook(bookId);
      if (book) toast(`已加入「${book.name}」`);
    }
    const box = $("[data-lookup-personal]");
    if (box) box.outerHTML = lookupBookPicksHTML(word);
    const toggle = $("[data-personal-toggle]");
    if (toggle) setPersonalButtonState(toggle, inPersonalWords(word));
  }

  async function openWordSheet(raw) {
    const query = String(raw || "").toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "");
    if (!query) return;
    const token = ++ui.lookupToken;
    // 离线词典还在缓存中（已发起加载但还没完成）时，查词暂时用不了，明确提示用户。
    const caching = Boolean(!state.dict && state.dictPromise);
    openSheet(`
      ${sheetHead("查词", caching ? "正在缓存词典，请稍后…" : "正在查找离线词库…")}
      <div class="empty-state" style="padding:24px 10px 30px">
        <div class="empty-icon">${ICONS.book}</div>
        <p>${caching ? "离线词典正在缓存中，请稍候再查词。" : `正在查找 ${esc(query)}…`}</p>
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

    ui.currentLookup = {
      base: result.base,
      phonetic: result.phonetic || "",
      meaning: result.meaning || "",
      entry: found ? found.entry : null,
    };
    openSheet(`
      ${sheetHead("查词", exact ? "音标 · 释义 · 例句" : `原形：${result.base}`)}
      <div class="lookup-word">${esc(query)}</div>
      <div class="lookup-phonetic">
        ${result.phonetic ? `<span>/${esc(result.phonetic)}/</span>` : "<span>暂无音标</span>"}
        <button class="audio-btn" type="button" data-speak="${escAttr(query)}">${ICONS.speaker} 朗读</button>
      </div>
      <div class="lookup-meaning">${posMeaning(result.meaning)}</div>
      ${morphBlockHTML(result.base, result.meaning)}
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
      ${lookupBookPicksHTML(result.base)}
      <div class="lookup-actions lookup-actions-stack">
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

  function removeWrongWord(key) {
    const raw = String(key || "");
    const cut = raw.indexOf("|");
    const bookId = cut > 0 ? raw.slice(0, cut) : (currentBook() || {}).id;
    const word = cut > 0 ? raw.slice(cut + 1) : raw;
    if (!bookId || !word) return;
    const progress = progressFor(bookId);
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
    // 变形题可能是多词形态（more beautiful），格子系统装不下，只保留键盘输入。
    if (session.queue[session.index].form) return;
    const entry = session.queue[session.index].word;
    const letterCount = entry.w.replace(/[^a-z]/gi, "").length;
    openSheet(`
      ${sheetHead("手写识别", "用印刷体在格子里写，每格一个字母；大写更准")}
      <div class="hw-hint">中文提示：<strong>${esc(shortMeaning(entry.m))}</strong></div>
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
  // 一次练习拆成三轮：一轮新词、一轮错词重写、一轮复习。每轮开头给一条提示，不混在一起。
  const ROUND_META = {
    new: { title: "新词练习", hint: "先把今天的新词过一遍" },
    wrong: { title: "错词重写", hint: "刚才写错的词，再写一遍" },
    review: { title: "复习", hint: "到期的旧词，看看还记得多少" },
    free: { title: "自由练习", hint: "从学过的词里随便抽一组" },
    single: { title: "练习", hint: "" },
  };

  // 三轮练习里同一个词不在同一轮插队重写：写错的词统一进第 2 轮，保证「一轮练习、一轮错词、一轮复习」
  // 的题号是干净的（5 个新词错 3 个，第 6 题就是错词、第 9 题就是复习）。自由练习/单轮练习仍保留插队。
  const ROUND_RETRY_LIMIT = { new: 0, wrong: 0, review: 0, free: 2, single: 2 };

  // dailyPlan：把今天的任务拆成「新词」和「复习」两批，错词那一轮等练完再生成。
  // bypassQuota：今天的额度用完了还要继续练时，再给一批新词，不再卡在额度上。
  function dailyPlan(book, bypassQuota = false) {
    const progress = progressFor(book.id);
    const words = rangeWords(book);
    const unseen = words.filter((entry) => !progress[entry.w]);
    const due = dueWords(book)
      .slice(0, Math.max(0, store.settings.dailyReview))
      .map(({ entry }) => entry);
    const newLimit = bypassQuota
      ? Math.max(10, store.settings.dailyNew)
      : Math.max(0, store.settings.dailyNew - todayNew(book.id));
    const randomOrder = store.settings.order === "random";
    const freshGroups = randomOrder
      ? selectRelatedGroups(unseen, newLimit, book)
      : unseen.slice(0, newLimit).map((entry) => [entry]);
    return {
      fresh: freshGroups.reduce((out, group) => out.concat(group), []),
      review: randomOrder ? arrangeRelated(due, book) : due,
    };
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

  // 变形练习：优先挑学过的、错过的、带特殊变化的词；每个词抽一个变形来考。
  const FORM_LIMIT = 12;

  function formQueue(book, limit = FORM_LIMIT) {
    const progress = progressFor(book.id);
    const pool = [];
    for (const entry of rangeWords(book)) {
      const forms = practiceForms(entry.w, entry.m);
      if (!forms.length) continue;
      const record = progress[entry.w];
      let score = 0;
      if (record) score += 3;
      if (record && (record.wrongCount || 0) > 0 && !record.mastered) score += 3;
      if (forms.some((form) => form.irregular)) score += 2;
      pool.push({ entry, forms, score });
    }
    if (!pool.length) return [];
    const shuffled = shuffle(pool);
    shuffled.sort((a, b) => b.score - a.score);
    return shuffled.slice(0, limit).map(({ entry, forms }) => {
      const special = forms.filter((form) => form.irregular);
      const pickFrom = special.length && Math.random() < 0.8 ? special : forms;
      const form = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      return { word: entry, isNew: false, form };
    });
  }

  // 查词页的「练这几个变形」：把这个词的每个变形都做成一道题。
  async function startFormPractice(word, entry) {
    const base = String(word || "").toLowerCase();
    const meaning = entry && entry.m ? entry.m : ((state.dict && state.dict[base] && state.dict[base][1]) || "");
    const forms = practiceForms(base, meaning);
    if (!forms.length) {
      toast("这个词暂时没有可练的变形");
      return;
    }
    const book = currentBook();
    const target = entry || {
      w: base,
      p: (state.dict && state.dict[base] && state.dict[base][0]) || "",
      m: meaning || "暂无释义",
    };
    closeSheet();
    await startSession("form", {
      items: forms.map((form) => ({ entry: target, bookId: book ? book.id : "", form })),
    });
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
    if (!["zh2en", "en2zh", "form"].includes(mode)) mode = "zh2en";
    // 听写（看中文写英文）时顺带考不规则变形；选择题没有对应题型，不加。
    const useForms = mode === "zh2en" && store.settings.dictateForms !== false;
    const expand = (items) => (useForms ? expandFormItems(items) : items);

    let rounds = [];
    if (Array.isArray(options.items) && options.items.length) {
      // 跨词库练习（例如「所有错词」）：每条自带所属词库，进度写回各自那一本。
      const singleItems = options.items.map(({ entry, bookId, form, formGroups, skipForms }) => ({
        word: entry,
        isNew: false,
        bookId: bookId || book.id,
        form,
        formGroups,
        skipForms,
      }));
      rounds = [{ key: "single", items: useForms ? expandFormItems(singleItems) : singleItems }];
    } else if (Array.isArray(options.entries) && options.entries.length) {
      rounds = [{
        key: "single",
        items: expand(arrangeRelated(options.entries, book).map((entry) => ({ word: entry, isNew: false }))),
      }];
    } else if (options.source === "wrong") {
      const entries = wrongEntries(book).slice(0, 30).map(({ entry }) => entry);
      rounds = [{ key: "single", items: arrangeRelated(entries, book).map((entry) => ({ word: entry, isNew: false })) }];
    } else if (mode === "form" || options.source === "form") {
      const items = formQueue(book);
      if (!items.length) {
        toast("当前范围还没有可以练的变形，换个词库试试");
        return;
      }
      rounds = [{ key: "single", items }];
    } else if (options.source === "free") {
      rounds = [{ key: "free", items: expand(pickFreeQueue(book)) }];
    } else {
      // 每天的主流程：第 1 轮新词、第 2 轮错词（练完才生成）、第 3 轮复习。
      let plan = dailyPlan(book);
      if (!plan.fresh.length) {
        // 今日新词额度用完后再点「开始练习」，就继续往下加练，不把人挡在外面。
        const extra = dailyPlan(book, true);
        if (extra.fresh.length) {
          plan = extra;
          toast("今日新词额度已满，这一轮继续加练新词");
        }
      }
      if (plan.fresh.length) {
        rounds.push({ key: "new", items: expand(plan.fresh.map((entry) => ({ word: entry, isNew: true }))) });
      }
      // 复习量设成 0 就是「今天不复习」，连这一轮都不出现，两轮练完直接收工。
      if (plan.review.length) {
        rounds.push({ key: "review", items: expand(plan.review.map((entry) => ({ word: entry, isNew: false }))) });
      }
      if (!rounds.length && store.settings.dailyReview > 0) {
        const free = pickFreeQueue(book);
        if (free.length) rounds.push({ key: "free", items: expand(free) });
      }
      if (!rounds.length) {
        toast(store.settings.dailyReview === 0
          ? "这一范围的新词都练过了；复习数量设成 0，去设置里调大就能复习旧词"
          : "当前范围还没有可练习的单词");
        return;
      }
    }

    if (!rounds.length || !rounds[0].items.length) {
      toast("当前范围还没有可练习的单词");
      return;
    }

    // 跨词汇本练习时标题不能写成当前词库，按队列实际来源标一下。
    const allQueued = rounds.reduce((out, round) => out.concat(round.items), []);
    const queueBookIds = new Set(allQueued.map((item) => item.bookId).filter(Boolean));
    let sessionLabel = book.name;
    if (queueBookIds.size === 1) {
      const only = bookById([...queueBookIds][0]);
      if (only) sessionLabel = only.name;
    } else if (queueBookIds.size > 1) {
      sessionLabel = "跨词汇本";
    }

    ui.session = {
      mode,
      bookId: book.id,
      label: sessionLabel,
      rounds,
      roundIndex: 0,
      queue: rounds[0].items,
      index: 0,
      done: 0,
      showRoundNotice: true,
      wrongRoundReady: false,
      attempts: 0,
      correct: 0,
      score: 0,
      startedAt: Date.now(),
      answered: false,
      finished: false,
      newCount: 0,
      wrongSet: new Set(),
      wrongItems: [],
      wrongKeys: new Set(),
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

  // 三轮里所有题目摊平，进度条和「6 / 28」都按总数算。
  function sessionItems(session) {
    if (!session) return [];
    if (!session.rounds) return session.queue || [];
    return session.rounds.reduce((out, round) => out.concat(round.items), []);
  }

  function currentRound(session) {
    if (!session || !session.rounds) return null;
    return session.rounds[session.roundIndex] || null;
  }

  function currentRoundKey(session) {
    const round = currentRound(session);
    return round ? round.key : "single";
  }

  function roundNumberFor(session, round) {
    if (!session || !session.rounds) return 1;
    const filled = session.rounds.filter((item) => item.items.length);
    const position = filled.indexOf(round);
    return position >= 0 ? position + 1 : 1;
  }

  function sessionRoundLabel(session) {
    const round = currentRound(session);
    if (!round || round.key === "single" || round.key === "free") return "";
    return `第 ${roundNumberFor(session, round)} 轮`;
  }

  function updateSessionHeader() {
    const session = ui.session;
    if (!session) return;
    const book = bookById(session.bookId);
    const label = session.label || (book ? book.name : "练习");
    $("#sessionBook").textContent = `${label} · ${MODE_LABEL[session.mode]}`;

    const total = Math.max(1, sessionItems(session).length);
    const done = session.done || 0;
    const current = clamp(done + (session.answered ? 0 : 1), 1, total);
    $("#sessionCount").textContent = `${current} / ${total}`;

    const roundEl = $("#sessionRound");
    if (roundEl) {
      const roundLabel = sessionRoundLabel(session);
      roundEl.textContent = roundLabel;
      roundEl.hidden = !roundLabel;
    }

    $("#sessionScore").textContent = session.score;
    const pct = clamp(Math.round((done / total) * 100), 0, 100);
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
    if (!session || session.answered || session.mode === "en2zh") return;
    // 多输入行时跟着当前光标走；没聚焦就落到第一行。
    const active = document.activeElement;
    const input = active && active.matches && active.matches("[data-field], #answerInput")
      ? active
      : ($("[data-field]", $("#sessionBody")) || $("#answerInput"));
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
    // 听写里顺带考的变形题标一下，别让人以为题目跳词了。
    const formTag = item.form && ui.session && ui.session.mode !== "form"
      ? `<span class="new-tag form-tag">变形</span>`
      : "";
    return `<span class="kicker-tags">${libraryTag}${formTag}${newTag}</span>`;
  }

  // 拼写题的输入区（字母格、输入框、提交/提示/不会、软键盘），变形题和听写共用。
  function spellingInputHTML(options = {}) {
    const kb = useSoftKeyboard();
    const slotsLabel = options.slots || "请写出变形";
    const aria = options.aria || "输入变形后的单词";
    const placeholder = options.placeholder || (kb ? "用下方键盘输入" : "写出这个变形");
    return `
            <div class="word-slots" id="wordSlots" aria-label="${escAttr(slotsLabel)}"><span class="slots-line"></span></div>
            <input class="answer-input ${kb ? "is-soft" : ""}" id="answerInput" type="text"
              inputmode="${kb && isTouchDevice() ? "none" : "text"}"
              ${kb && isTouchDevice() ? "readonly" : ""}
              autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"
              enterkeyhint="done" aria-label="${escAttr(aria)}"
              placeholder="${escAttr(placeholder)}">
            <div class="answer-row ${kb ? "is-soft" : ""}">
              ${kb ? "" : '<button class="primary-btn" type="button" data-submit>提交</button>'}
              <button class="ghost-btn" type="button" data-hint>提示</button>
              <button class="ghost-btn reveal-btn" type="button" data-reveal>不会</button>
            </div>
            <div class="hint-text" id="hintText"></div>
            ${kb ? softKeyboardHTML() : ""}`;
  }

  // 听写途中遇到的变形题：中文释义当听写提示，再点名要写哪个变形。
  function dictationFormHTML(item) {
    const entry = item.word;
    const form = item.form || { label: "变形", value: "" };
    const dictRow = state.dict && state.dict[entry.w];
    const meaning = entry.m && entry.m !== "暂无释义"
      ? entry.m
      : ((dictRow && dictRow[1]) || entry.m || "");
    return `
        <div class="question-card">
          <div class="question-inner">
            <div class="question-kicker"><span>听写 · 写变形</span>${questionTagsHTML(item)}</div>
            <div class="prompt-meaning">${meaning ? posMeaning(cleanDictationMeaning(meaning)) : "暂无释义"}</div>
            <div class="form-ask">写出 <strong>${esc(entry.w)}</strong>${entry.p ? `<small>/${esc(entry.p)}/</small>` : ""} 的 <em>${esc(form.label)}</em></div>
            <div class="prompt-tools">
              <button class="audio-btn" type="button" data-speak="${escAttr(entry.w)}">${ICONS.speaker} 听原词</button>
            </div>
            ${spellingInputHTML({ slots: "请写出它的变形", aria: "输入变形后的单词", placeholder: "写出它的变形" })}
          </div>
        </div>`;
  }

  // 一张卡片写完原词和它的所有变形：第一行原词，下面按词性一行为一个变形。
  function multiFieldDictationHTML(item) {
    const entry = item.word;
    const kb = useSoftKeyboard();
    const dictRow = state.dict && state.dict[entry.w];
    const raw = entry.m && entry.m !== "暂无释义"
      ? entry.m
      : ((dictRow && dictRow[1]) || entry.m || "");
    const meaning = cleanDictationMeaning(raw);
    const groups = item.formGroups || [];

    // 原词固定 0 号，变形从 1 起；模板字符串先算 groupRows，索引不能靠调用顺序猜。
    let fieldIndex = 1;
    const inputHTML = (label, index) => `
            <input class="answer-input dict-input ${kb ? "is-soft" : ""}" id="dictField${index}" data-field="${index}"
              type="text" inputmode="${kb && isTouchDevice() ? "none" : "text"}"
              ${kb && isTouchDevice() ? "readonly" : ""}
              autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"
              enterkeyhint="done" aria-label="${escAttr(label)}"
              placeholder="${kb ? "用下方键盘输入" : ""}">`;
    const fieldHTML = (label, index, extraClass = "") => `
          <div class="dict-field ${extraClass}">
            <label class="dict-field-label" for="dictField${index}">${esc(label)}</label>${inputHTML(label, index)}
          </div>`;

    const lineHTML = (line) => {
      const cells = line.cells || [{ label: line.label }];
      if (cells.length < 2) return fieldHTML(cells[0].label, fieldIndex++);
      // 成对变形：左边一个统一的行名，右边两个空并排，和其它行一样左对齐。
      return `
          <div class="dict-line is-pair">
            <div class="dict-field-label dict-pair-label">${esc(line.label)}</div>
            <div class="dict-pair-fields">
              ${cells.map((cell) => inputHTML(cell.label, fieldIndex++)).join("")}
            </div>
          </div>`;
    };

    const groupRows = groups.map((group) => `
          <div class="dict-group">
            <div class="dict-group-title"><span class="dict-pos">${esc(group.pos)}</span>${esc(group.label)}</div>
            ${group.lines.map(lineHTML).join("")}
          </div>`).join("");

    return `
        <div class="question-card is-multifield">
          <div class="question-inner">
            <div class="question-kicker"><span>看中文 · 写英文和变形</span>${questionTagsHTML(item)}</div>
            <div class="prompt-meaning">${meaning ? posMeaning(meaning) : "暂无释义"}</div>
            <div class="prompt-sub">先写原词，再按词性写变形 · 过去式/过去分词、比较级/最高级各占两个空 · 有一空写错，整题算错</div>
            <div class="prompt-tools">
              <button class="audio-btn" type="button" data-speak="${escAttr(entry.w)}">${ICONS.speaker} 听发音</button>
              <button class="ghost-chip" type="button" data-skip-forms>只写原词</button>
            </div>
            <div class="dict-fields">
              ${fieldHTML("原词", 0, "is-base")}
              ${groupRows}
            </div>
            <div class="answer-row ${kb ? "is-soft" : ""}">
              ${kb ? "" : '<button class="primary-btn" type="button" data-submit>提交</button>'}
              <button class="ghost-btn" type="button" data-hint>提示</button>
              <button class="ghost-btn reveal-btn" type="button" data-reveal>不会</button>
            </div>
            <div class="hint-text" id="hintText"></div>
            ${kb ? softKeyboardHTML() : ""}
          </div>
        </div>`;
  }

  function questionHTML(item) {
    const session = ui.session;
    const entry = item.word;
    if (session.mode === "form") {
      const form = item.form || { label: "变形", value: "" };
      // 上传/导入的词条常常没有释义，题目里就用离线词典的释义兜底。
      const dictRow = state.dict && state.dict[entry.w];
      const meaning = entry.m && entry.m !== "暂无释义"
        ? entry.m
        : ((dictRow && dictRow[1]) || entry.m || "");
      return `
        <div class="question-card">
          <div class="question-inner">
            <div class="question-kicker"><span>词形变化 · 写变形</span>${questionTagsHTML(item)}</div>
            <div class="form-base">
              <strong>${esc(entry.w)}</strong>
              ${entry.p ? `<small>/${esc(entry.p)}/</small>` : ""}
            </div>
            <div class="form-ask">写出它的 <em>${esc(form.label)}</em></div>
            <div class="form-meaning">${meaning ? posMeaning(cleanDictationMeaning(meaning)) : "暂无释义"}</div>
            <div class="prompt-tools">
              <button class="audio-btn" type="button" data-speak="${escAttr(entry.w)}">${ICONS.speaker} 听原词</button>
            </div>
            ${spellingInputHTML()}
          </div>
        </div>`;
    }
    if (item.form) return dictationFormHTML(item);
    if (session.mode === "zh2en") {
      // 新版听写：原词 + 分行的变形都在同一张卡片里。
      if (isMultiFieldItem(item)) return multiFieldDictationHTML(item);
      // 只写原词时保留切回入口，避免学生一点「只写原词」就再也回不来。
      const canToggleForms = Boolean(!item.form && Array.isArray(item.formGroups) && item.formGroups.length);
      return `
        <div class="question-card">
          <div class="question-inner">
            <div class="question-kicker"><span>看中文 · 写英文</span>${questionTagsHTML(item)}</div>
            <div class="prompt-meaning">${posMeaning(cleanDictationMeaning(entry.m))}</div>
            <div class="prompt-sub">写出对应的英文单词${canToggleForms ? " · 也可以做词形变化拼写" : ""}</div>
            <div class="prompt-tools">
              <button class="audio-btn" type="button" data-speak="${escAttr(entry.w)}">${ICONS.speaker} 听发音</button>
              ${canToggleForms ? '<button class="ghost-chip" type="button" data-skip-forms>词形变化拼写</button>' : ""}
              <button class="ghost-chip" type="button" data-handwriting>${ICONS.pencil} 手写板</button>
            </div>
            <div class="word-slots" id="wordSlots" aria-label="请写出这个单词"></div>
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

  // 每一轮开头的那条提示：告诉用户这一轮是练习、错词重写还是复习。
  function roundNoticeHTML(session) {
    const round = currentRound(session);
    if (!round || round.key === "single" || round.key === "free" || !session.showRoundNotice) return "";
    const meta = ROUND_META[round.key] || ROUND_META.single;
    const number = roundNumberFor(session, round);
    const count = round.items.length;
    // 新版一题里带多行变形，所以统计的是「行数」而不是「题数」。
    const formCount = round.items.reduce(
      (total, item) => total + (item.form ? 1 : itemFormLines(item).length), 0
    );
    let hint = meta.hint;
    if (round.key === "new") {
      if (formCount) hint = `今天 ${count} 个新词，每个词下面还有 ${formCount} 个变形空`;
      else if (store.settings.dictateForms === false) hint = `今天 ${count} 个新词，只写原词 · 变形听写已关闭`;
      else hint = `今天 ${count} 个新词，这批词没有变形`;
    } else if (round.key === "wrong") {
      hint = formCount
        ? `刚才写错的 ${count} 个词，连同 ${formCount} 个变形空再写一遍`
        : `刚才写错的 ${count} 个词，再写一遍`;
    } else if (round.key === "review") {
      hint = formCount
        ? `${count} 个到期的旧词，连同 ${formCount} 个变形空`
        : `${count} 个到期的旧词，看看还记得多少`;
    } else if (round.key === "free") hint = `${count} 个学过的词，随便练练`;
    return `
      <div class="round-notice is-${escAttr(round.key)}">
        <span class="round-badge">第 ${number} 轮</span>
        <div class="round-copy">
          <strong>${esc(meta.title)}</strong>
          <small>${esc(hint)}</small>
        </div>
      </div>`;
  }

  // 第 1 轮写错的词单独凑成第 2 轮，不插到新词里面。
  function wrongRoundItems(session) {
    return (session.wrongItems || []).map(({ word, bookId, form, formGroups, skipForms }) => ({
      word,
      isNew: false,
      bookId: bookId || session.bookId,
      form,
      formGroups,
      skipForms,
    }));
  }

  function hasMoreRounds(session) {
    if (!session || !session.rounds) return false;
    const round = currentRound(session);
    // 第 1 轮刚练完时第 2 轮还没生成，靠错词数量预判一下。
    if (round && round.key === "new" && !session.wrongRoundReady && session.wrongSet.size) return true;
    return session.rounds.some((item, index) => index > session.roundIndex && item.items.length);
  }

  function advanceRound() {
    const session = ui.session;
    if (!session) return;
    const round = currentRound(session);
    if (round && round.key === "new" && !session.wrongRoundReady) {
      session.wrongRoundReady = true;
      const items = wrongRoundItems(session);
      if (items.length) {
        session.rounds.splice(session.roundIndex + 1, 0, { key: "wrong", items });
      } else if (session.rounds.some((item) => item.key === "review" && item.items.length)) {
        toast("这一轮全对，直接进入复习");
      }
    }
    let next = session.roundIndex + 1;
    while (next < session.rounds.length && !session.rounds[next].items.length) next += 1;
    if (next >= session.rounds.length) {
      finishSession();
      return;
    }
    session.roundIndex = next;
    session.queue = session.rounds[next].items;
    session.index = 0;
    session.answered = false;
    session.showRoundNotice = true;
    renderSession(true);
    const body = $("#sessionBody");
    if (body) body.scrollTop = 0;
  }

  function renderSession(shouldSpeak = false) {
    const session = ui.session;
    if (!session) return;
    if (session.index >= session.queue.length) {
      advanceRound();
      return;
    }
    const item = session.queue[session.index];
    const book = bookById(item.bookId || session.bookId) || bookById(session.bookId);
    if (!book) {
      closeSession(true);
      return;
    }
    session.answered = false;
    session.currentOptions = session.mode === "en2zh" ? buildOptions(item.word, book) : null;
    session.selectedIndex = null;
    session.hintUsed = false;
    const body = $("#sessionBody");
    body.innerHTML = `${roundNoticeHTML(session)}${questionHTML(item)}`;
    // 「只写原词」和多行听写来回切时，已经写进去的内容不能丢。
    if (isMultiFieldItem(item) && Array.isArray(item.draftFields)) {
      $$("[data-field]", body).forEach((field, index) => {
        field.value = item.draftFields[index] || "";
      });
    } else if (typeof item.draftAnswer === "string") {
      const answer = $("#answerInput");
      if (answer) answer.value = item.draftAnswer;
    }
    session.showRoundNotice = false;
    body.scrollTop = 0;
    updateSessionHeader();

    if (session.mode !== "en2zh" && !isTouchDevice()) {
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
    const item = session.queue[session.index];

    // 多输入行：原词 + 每一行变形一起判，任何一行写错整题算错。
    if (isMultiFieldItem(item) && session.mode === "zh2en") {
      const fields = $$("[data-field]", $("#sessionBody"));
      if (!fields.length) return;
      const lines = itemFormLines(item);
      const results = [];
      for (const field of fields) {
        const value = field.value.trim();
        if (!value) {
          toast("每一行都要写，写完再提交");
          field.focus();
          return;
        }
        const index = Number(field.dataset.field);
        const line = index > 0 ? lines[index - 1] : null;
        const ok = index === 0
          ? isCorrectAnswer(value, item.word.w)
          : isCorrectFormAnswer(value, line ? line.form : null);
        results.push({
          label: index === 0 ? "原词" : (line ? line.label : "变形"),
          expected: line ? line.target : item.word.w,
          input: value,
          ok,
        });
      }
      session.fieldResults = results;
      const wrongOne = results.find((result) => !result.ok);
      handleAnswer(results.every((result) => result.ok), wrongOne ? wrongOne.input : "", null);
      return;
    }

    const input = $("#answerInput");
    if (!input) return;
    const value = input.value.trim();
    if (!value) {
      toast("先写下这个单词，再提交");
      input.focus();
      return;
    }
    const correct = item.form
      ? isCorrectFormAnswer(value, item.form)
      : isCorrectAnswer(value, item.word.w);
    handleAnswer(correct, value, null);
  }

  function chooseOption(index) {
    const session = ui.session;
    if (!session || session.answered || session.mode !== "en2zh") return;
    const selected = session.currentOptions[index];
    if (!selected) return;
    const entry = session.queue[session.index].word;
    session.lastPickedWord = selected.w;
    handleAnswer(selected.w === entry.w, selected.m, index);
  }

  function showHint() {
    const session = ui.session;
    if (!session || session.answered) return;
    const item = session.queue[session.index];
    if (isMultiFieldItem(item) && session.mode === "zh2en") {
      session.hintUsed = true;
      const hint = $("#hintText");
      if (hint) {
        const lines = [{ label: "原词", target: item.word.w }].concat(
          itemFormLines(item).map((line) => ({ label: line.label, target: line.target }))
        );
        hint.textContent = "提示：" + lines.map((line) => {
          const pattern = Array.from(line.target).map((char, index) =>
            (index === 0 ? char : /[a-z]/i.test(char) ? "·" : char)).join("");
          return `${line.label} ${pattern}（${line.target.replace(/[^a-z]/gi, "").length} 字母）`;
        }).join(" · ");
      }
      return;
    }
    const target = item.form ? item.form.value : item.word.w;
    session.hintUsed = true;
    const hint = $("#hintText");
    if (hint) {
      const pattern = Array.from(target).map((char, index) => (index === 0 ? char : /[a-z]/i.test(char) ? "·" : char)).join(" ");
      hint.textContent = `提示：${pattern} · 共 ${target.replace(/[^a-z]/gi, "").length} 个字母`;
    }
    // 字母数 / 字母格默认不显示，点“提示”后才出现。
    const slots = $("#wordSlots");
    if (slots) slots.innerHTML = slotsHTML(target);
  }

  function revealAnswer() {
    const session = ui.session;
    if (!session || session.answered || session.mode === "en2zh") return;
    const item = session.queue[session.index];
    if (isMultiFieldItem(item) && session.mode === "zh2en") {
      const fields = $$("[data-field]", $("#sessionBody"));
      const targets = [item.word.w].concat(itemFormLines(item).map((line) => line.target));
      fields.forEach((field, index) => {
        field.value = targets[index] || "";
        field.disabled = true;
      });
      handleAnswer(false, "", null, true);
      return;
    }
    const target = item.form ? item.form.value : item.word.w;
    const input = $("#answerInput");
    if (input) {
      input.value = target;
      input.disabled = true;
    }
    handleAnswer(false, "", null, true);
  }

  function handleAnswer(isCorrect, userAnswer, selectedIndex = null, revealed = false) {
    const session = ui.session;
    if (!session || session.answered) return;
    const item = session.queue[session.index];
    const entry = item.word;
    const bookId = item.bookId || session.bookId;

    session.answered = true;
    session.selectedIndex = selectedIndex;
    session.attempts += 1;
    session.done = (session.done || 0) + 1;
    const today = getToday();
    today.attempts += 1;
    store.totals.attempts += 1;

    const progress = progressFor(bookId);
    const isNew = !progress[entry.w];
    // 变形题只考词形，不替这个词本身记「学会」，也不占今天的新词额度。
    const formDrill = Boolean(item.form);
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
      if (!formDrill) {
        session.newCount += 1;
        today.newByBook[bookId] = (today.newByBook[bookId] || 0) + 1;
      }
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
      if (!formDrill) {
        record.level = Math.min(5, (record.level || 0) + 1);
        record.due = now + REVIEW_DAYS[record.level] * DAY;
        if (record.level >= 5) record.mastered = true;
      }
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
      // 记下这次是怎么错的：拼写题记写了什么，选择题记选了哪个词，直接看答案也标出来。
      const picked = session.mode === "en2zh"
        ? String(session.lastPickedWord || "")
        : String(userAnswer || "");
      const wrongField = (session.fieldResults || []).find((result) => !result.ok);
      record.lastWrong = {
        input: revealed ? "" : picked.trim().slice(0, 40),
        mode: session.mode,
        at: now,
        revealed: Boolean(revealed),
        expected: formDrill && item.form ? item.form.value : (wrongField ? wrongField.expected : ""),
        label: formDrill && item.form ? item.form.label : (wrongField ? wrongField.label : ""),
      };
      session.wrongSet.add(entry.w);
      // 错词重写要按「词 + 变形」记：写错 paid 就重写 paid，而不是再听写一遍 pay。
      const wrongKey = `${entry.w}|${item.form ? item.form.key : ""}`;
      if (!session.wrongKeys) session.wrongKeys = new Set();
      if (!session.wrongKeys.has(wrongKey)) {
        session.wrongKeys.add(wrongKey);
        if (!session.wrongItems) session.wrongItems = [];
        session.wrongItems.push({
          word: entry,
          bookId,
          form: item.form,
          formGroups: item.formGroups,
          skipForms: item.skipForms,
        });
      }
      // 第 1 轮写错的词不插队重写，留到下一轮「错词重写」；其它轮按各自的次数插队。
      const roundKey = currentRoundKey(session);
      const retryLimit = ROUND_RETRY_LIMIT[roundKey] === undefined ? 2 : ROUND_RETRY_LIMIT[roundKey];
      const retryCount = item.retryCount || 0;
      if (retryCount < retryLimit) {
        const retryItem = {
          word: entry,
          isNew: false,
          retry: true,
          retryCount: retryCount + 1,
          bookId: item.bookId,
          round: roundKey,
          form: item.form,
          formGroups: item.formGroups,
          skipForms: item.skipForms,
        };
        const position = Math.min(session.index + 3, session.queue.length);
        session.queue.splice(position, 0, retryItem);
      }
    }

    saveStore();
    updateWrongDot();
    playFeedback(isCorrect);

    if (session.mode !== "en2zh") {
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

    const item = session.queue[session.index];
    const formLine = item.form
      ? `<div class="feedback-form"><span>${esc(item.form.label)}</span><strong>${formValueHTML(item.form)}</strong></div>`
      : "";
    const fieldResults = session.fieldResults || [];
    const fieldResultHTML = fieldResults.length
      ? `<div class="dict-results">${fieldResults.map((result) => `
          <div class="dict-result ${result.ok ? "is-ok" : "is-bad"}">
            <span>${esc(result.label)}</span>
            <strong>${esc(result.expected)}</strong>
            <em>${result.ok ? "✓" : "×"}</em>
          </div>`).join("")}</div>`
      : "";
    const morphBlock = fieldResults.length ? "" : (session.mode === "form" || item.form
      ? morphBlockHTML(entry.w, entry.m, { practice: false })
      : morphLineHTML(entry.w, entry.m));
    // 开关关掉时，反馈里仍然会列出变形，很容易让人以为「只显示不考」。
    // 这里直接给个开启入口，把「为什么没出变形题」当场解释清楚。
    const hiddenForms = !item.form && session.mode === "zh2en" && store.settings.dictateForms === false
      ? dictatedForms(entry.w, entry.m)
      : [];
    const formsOffHint = hiddenForms.length
      ? `<button class="morph-off-hint" type="button" data-enable-forms>听写变形已关闭 · 点此开启，下次接着考 ${hiddenForms.map((form) => esc(form.value)).join(" / ")}</button>`
      : "";

    const roundDone = session.index + 1 >= session.queue.length;
    const nextLabel = !roundDone ? "下一题" : hasMoreRounds(session) ? "进入下一轮" : "查看结果";
    const answerLabel = item.form ? "变形" : "";
    const headText = isCorrect
      ? (answerLabel ? `${answerLabel}答对了` : isNew ? "新词答对了" : "答对了")
      : revealed
        ? "看过答案，再记一遍"
        : answerLabel
          ? `${answerLabel}写错了，看看正确形式`
          : "答错了，看看正确答案";

    const feedback = `
      <div class="feedback ${isCorrect ? "correct" : "wrong"}" id="feedback">
        <div class="feedback-head">
          <span class="feedback-icon">${isCorrect ? "✓" : "×"}</span>
          <span>${esc(headText)}</span>
          <span class="feedback-score">${points > 0 ? `+${points}` : "已记入错词"}</span>
        </div>
        <div class="feedback-personal">${personalButtonHTML(entry.w)}</div>
        <div class="feedback-word-row">
          <button class="feedback-word tapword" type="button" data-word="${escAttr(entry.w)}">${esc(entry.w)}</button>
          ${entry.p ? `<span class="phonetic">/${esc(entry.p)}/</span>` : ""}
          <button class="mini-btn" type="button" data-speak="${escAttr(entry.w)}">${ICONS.speaker}</button>
        </div>
        <div class="feedback-meaning">${posMeaning(entry.m)}</div>
        ${formLine}
        ${yourAnswer}
        ${fieldResultHTML}
        ${morphBlock}
        ${formsOffHint}
        ${example}
        <div class="answer-actions">
          <button class="primary-btn" type="button" data-next>${nextLabel}</button>
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
    session.fieldResults = null;
    // 这一轮答完就换下一轮；最后一轮答完才出结果。
    if (session.index >= session.queue.length) {
      advanceRound();
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

    $("#sessionBook").textContent = `${session.label || (book ? book.name : "练习")} · ${MODE_LABEL[session.mode]}`;
    $("#sessionCount").textContent = `${session.attempts} 题`;
    const roundEl = $("#sessionRound");
    if (roundEl) roundEl.hidden = true;
    $("#sessionBar").style.width = "100%";

    const wrongList = Array.from(session.wrongSet).slice(0, 30);
    const title = accuracy >= 90 ? "漂亮，完成！" : accuracy >= 70 ? "完成，继续保持" : "完成，再练一轮";
    const wrongChips = wrongList.map((word) => `
      <button class="result-wrong-word" type="button" data-word="${escAttr(word)}">${esc(word)}</button>`).join("");
    // 三轮练习的结果里标一下每轮各练了多少，方便回看这一组是怎么走完的。
    const roundLine = session.rounds && session.rounds.length > 1
      ? session.rounds
        .filter((round) => round.items.length)
        .map((round) => `${(ROUND_META[round.key] || ROUND_META.single).title} ${round.items.length}`)
        .join(" · ")
      : "";

    $("#sessionBody").innerHTML = `
      <div class="result">
        <div class="result-mark">${ICONS.spark}</div>
        <h2>${title}</h2>
        <p class="result-sub">${esc(session.label || (book ? book.name : ""))} · ${esc(MODE_LABEL[session.mode])}${session.newCount ? ` · 新词 ${session.newCount} 个` : ""}</p>
        ${roundLine ? `<p class="result-rounds">${esc(roundLine)}</p>` : ""}
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
    // 练习中收到的「新版本」留到这里再刷新，免得答题答到一半被打断。
    if (ui.swReloadPending) {
      toast("新版本已生效，正在刷新…");
      setTimeout(() => location.reload(), 500);
      return;
    }
    renderCurrent();
  }

  function retryWrongWords() {
    const session = ui.session;
    if (!session) return;
    const items = [];
    const seen = new Set();
    for (const row of (session.wrongItems || [])) {
      const key = `${row.word.w}|${row.form ? row.form.key : ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        entry: row.word,
        bookId: row.bookId || session.bookId,
        form: row.form,
        formGroups: row.formGroups,
        skipForms: row.skipForms,
      });
    }
    if (!items.length) {
      toast("这次没有错词");
      return;
    }
    const mode = session.mode;
    startSession(mode, { items });
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
      if (mode === "zh2en" || mode === "en2zh" || mode === "form") {
        history.replaceState(null, "", location.pathname + location.hash);
      }

      ensureCurrentBook()
        .then((book) => {
          loadDict().catch((error) => console.warn("Dictionary will load on demand", error));
          if (mode === "zh2en" || mode === "en2zh" || mode === "form") {
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
    if (data.type === "APP_UPDATED") {
      applyPendingUpdate();
      return;
    }
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

  // 新版本装上后直接接管；不在练习中时自动刷新，免得装在主屏幕后一直跑旧缓存。
  function applyPendingUpdate() {
    if (ui.swReloadPending) return;
    ui.swReloadPending = true;
    if (ui.session) {
      toast("新版本已就绪，这一组练完会自动更新");
      return;
    }
    toast("新版本已生效，正在刷新…");
    setTimeout(() => location.reload(), 700);
  }

  async function registerServiceWorker() {
    if (location.protocol === "file:" || !("serviceWorker" in navigator)) return;
    try {
      // 首次安装时 clients.claim() 也会触发 controllerchange，那次不该刷新页面。
      const hadController = Boolean(navigator.serviceWorker.controller);
      const registration = await navigator.serviceWorker.register("sw.js", { scope: "./" });
      navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController) return;
        applyPendingUpdate();
      });
      navigator.serviceWorker.ready.then(() => {
        ui.swReady = true;
        if (ui.tab === "settings") renderSettings();
        requestOfflineCache();
      }).catch((error) => console.warn("Service worker ready failed", error));
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state !== "installed") return;
          // 没有 controller 说明是第一次安装，不用提醒也不要刷新。
          if (!navigator.serviceWorker.controller) return;
          // 主动接管，页面收到 controllerchange 后会自己刷新。
          worker.postMessage({ type: "SKIP_WAITING" });
        });
      });
      // 每次启动都问一次，别等浏览器 24 小时才自动检查。
      registration.update().catch(() => {});
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
      const box = event.target.closest("[data-wrong-select]");
      if (box) {
        if (box.checked) ui.wrongSelected.add(box.value);
        else ui.wrongSelected.delete(box.value);
        updateWrongBatchUI();
        return;
      }
      const all = event.target.closest("[data-wrong-select-all]");
      if (all) {
        $$("#view [data-wrong-select]").forEach((input) => {
          input.checked = all.checked;
          if (all.checked) ui.wrongSelected.add(input.value);
          else ui.wrongSelected.delete(input.value);
        });
        updateWrongBatchUI();
        return;
      }
    });

    $("#view").addEventListener("change", (event) => {
      const select = event.target.closest("[data-setting-select]");
      if (!select) return;
      if (select.dataset.settingSelect === "voice") {
        store.settings.voiceURI = select.value;
        saveStore();
        speak("Hello! This is your English reading voice.", { gesture: true });
      }
    });

    const runWordSearchForm = (event) => {
      const form = event.target.closest("[data-word-search-form]");
      if (!form) return;
      event.preventDefault();
      const root = form.closest("[data-word-search]");
      if (root) runWordSearch(root);
    };
    $("#view").addEventListener("submit", runWordSearchForm);
    $("#sheetContent").addEventListener("submit", runWordSearchForm);

    $("#sheetContent").addEventListener("submit", (event) => {
      const addForm = event.target.closest("[data-add-book-form]");
      if (addForm) {
        event.preventDefault();
        const input = $("[data-add-book-name]", addForm);
        handleAddToNewBook(input ? input.value : "");
        return;
      }
      const newForm = event.target.closest("[data-new-book-form]");
      if (newForm) {
        event.preventDefault();
        handleNewBookForm(newForm);
        return;
      }
      const renameForm = event.target.closest("[data-rename-book-form]");
      if (renameForm) {
        event.preventDefault();
        handleRenameBookForm(renameForm);
      }
    });

    const onWordSearchInput = (event) => {
      const input = event.target.closest("[data-word-search-input]");
      if (!input) return;
      const root = input.closest("[data-word-search]");
      if (!root) return;
      clearTimeout(input._wdSearchTimer);
      input._wdSearchTimer = window.setTimeout(() => runWordSearch(root), 140);
    };
    $("#view").addEventListener("input", onWordSearchInput);
    $("#sheetContent").addEventListener("input", onWordSearchInput);

    $("#view").addEventListener("click", (event) => {
      const target = event.target;
      if (target.closest("[data-retry-book]")) {
        ui.bookError = "";
        ensureCurrentBook().catch(() => {});
        return;
      }
      const browseButton = target.closest("[data-book-browse]");
      if (browseButton) {
        openBookBrowseSheet(browseButton.dataset.bookBrowse);
        return;
      }
      if (target.closest("[data-book-manage]")) {
        openUploadManageSheet(target.closest("[data-book-manage]").dataset.bookManage);
        return;
      }
      if (target.closest("[data-new-personal-book]")) {
        openNewBookSheet("manual");
        return;
      }
      const targetChip = target.closest("[data-target-book]");
      if (targetChip) {
        setPersonalTargetForScope(targetChip.dataset.targetScope || "manual", targetChip.dataset.targetBook);
        return;
      }
      const newBookChip = target.closest("[data-new-book]");
      if (newBookChip) {
        openNewBookSheet(newBookChip.dataset.newBook || "manual");
        return;
      }
      const bookButton = target.closest("[data-book]");
      if (bookButton) {
        // 卡片主体（非右上角功能键）一律直接切换词库，个人词汇也一样。
        selectBook(bookButton.dataset.book);
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
      const manualToggle = target.closest("[data-manual-toggle]");
      if (manualToggle) {
        handleManualToggle(manualToggle.dataset.manualToggle, manualToggle);
        return;
      }
      const wrongScopeBtn = target.closest("[data-wrong-scope]");
      if (wrongScopeBtn) {
        ui.wrongScope = wrongScopeBtn.dataset.wrongScope || "";
        renderWrong();
        return;
      }
      const wrongSortBtn = target.closest("[data-wrong-sort]");
      if (wrongSortBtn) {
        const next = wrongSortBtn.dataset.wrongSort;
        if (WRONG_SORTS.some((sort) => sort.id === next)) {
          store.settings.wrongSort = next;
          saveStore();
          renderWrong();
        }
        return;
      }
      const wrongMode = target.closest("[data-wrong-mode]");
      if (wrongMode) {
        // 练当前选中的范围（某一本或所有），每条带上自己的词库。
        const scopeList = wrongListForScope(ui.wrongScope).slice(0, 30);
        if (!scopeList.length) {
          toast("这个范围还没有错词");
          return;
        }
        startSession(wrongMode.dataset.wrongMode, {
          items: scopeList.map(({ entry, bookId }) => ({ entry, bookId })),
        });
        return;
      }
      const removeButton = target.closest("[data-remove-word]");
      if (removeButton) {
        removeWrongWord(removeButton.dataset.removeWord);
        return;
      }
      if (target.closest("[data-wrong-delete]")) {
        deleteSelectedWrong();
        return;
      }
      const settingButton = target.closest("[data-setting]");
      if (settingButton) {
        const key = settingButton.dataset.setting;
        const value = settingButton.dataset.value;
        if (key === "dailyNew") store.settings.dailyNew = clamp(parseInt(value, 10) || 20, 5, 100);
        else if (key === "dailyReview") {
          // 0 是合法值（今天不复习），不能被 `|| 20` 吃掉。
          const review = parseInt(value, 10);
          store.settings.dailyReview = clamp(Number.isFinite(review) ? review : 20, 0, 100);
        }
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
        else if (key === "dictateForms") {
          store.settings.dictateForms = store.settings.dictateForms === false;
          toast(store.settings.dictateForms !== false
            ? "已开启：听写时会接着考不规则变形"
            : "已关闭：只听写原词，变形只在查词页显示");
        }
        else if (key === "sound") store.settings.sound = !store.settings.sound;
        else if (key === "softKeyboard") {
          store.settings.softKeyboard = !store.settings.softKeyboard;
          if (ui.session && ui.session.mode !== "en2zh" && !ui.session.answered) {
            const input = $("#answerInput");
            if (input) input.value = "";
          }
        }
        saveStore();
        // 首页也有这个开关（听写变形状态条），所以不能只刷设置页。
        renderCurrent();
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
        else if (action === "hard-reload") hardReload();
        else if (action === "upload-file") openUploadPicker();
        else if (action === "manage-upload") openUploadManageSheet();
        return;
      }
    });

    $("#sessionBody").addEventListener("click", (event) => {
      const target = event.target;
      // 反馈页那个「变形听写已关闭」的补救按钮，点了当场开启。
      const enableForms = target.closest("[data-enable-forms]");
      if (enableForms) {
        store.settings.dictateForms = true;
        saveStore();
        enableForms.disabled = true;
        enableForms.textContent = "已开启，下一组练习就会接着考";
        toast("已开启：下一组练习会接着考不规则变形");
        return;
      }
      if (target.closest("[data-submit]")) {
        submitSpelling();
        return;
      }
      const skipForms = target.closest("[data-skip-forms]");
      if (skipForms) {
        const current = ui.session && ui.session.queue[ui.session.index];
        if (current && !ui.session.answered) {
          // 切换前后都把手写内容存下来，来回切不会清空输入框。
          const fields = $$("[data-field]", $("#sessionBody"));
          if (fields.length) {
            current.draftFields = fields.map((field) => field.value);
            current.draftAnswer = current.draftFields[0] || "";
          } else {
            const answer = $("#answerInput");
            current.draftAnswer = answer ? answer.value : "";
            current.draftFields = current.draftAnswer ? [current.draftAnswer] : [];
          }
          current.skipForms = !current.skipForms;
          renderSession();
          toast(current.skipForms ? "这一题只写原词" : "词形变化拼写已开启");
        }
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
      const typing = event.target && (event.target.id === "answerInput"
        || (typeof event.target.matches === "function" && event.target.matches("[data-field]")));
      if (typing) {
        event.preventDefault();
        // 这一下只负责“提交并显示答案”。如果不拦住冒泡，document 上的
        // Enter 处理会紧接着看到 answered=true，又跳到下一题。
        event.stopPropagation();
        submitSpelling();
      }
    });

    $("#sheetContent").addEventListener("click", (event) => {
      const target = event.target;
      const jumpButton = target.closest("[data-word-jump]");
      if (jumpButton) {
        jumpToWordRow(jumpButton.dataset.wordJump);
        return;
      }
      if (target.closest("[data-data-export]")) {
        exportData(selectedScopes());
        return;
      }
      const practiceButton = target.closest("[data-practice-forms]");
      if (practiceButton) {
        const word = practiceButton.dataset.practiceForms;
        const lookup = ui.currentLookup && ui.currentLookup.base === word ? ui.currentLookup : null;
        startFormPractice(word, lookup ? lookup.entry : null);
        return;
      }
      if (target.closest("[data-data-import]")) {
        importData();
        return;
      }
      if (target.closest("[data-import-go]")) {
        const draft = ui.importDraft;
        if (!draft) {
          toast("请重新选择文件", true);
          return;
        }
        const scopes = $$("#sheetContent [data-import-scope]")
          .filter((box) => box.checked)
          .map((box) => box.dataset.importScope);
        if (!scopes.length) {
          toast("先勾选要导入的内容", true);
          return;
        }
        if (scopes.includes("records")
          && !confirm("导入「学习记录」会用文件里的进度、统计和设置覆盖本机，确定继续吗？")) return;
        const result = applyImport(draft.parsed, scopes);
        if (!result.ok) {
          toast(result.message, true);
          return;
        }
        ui.importDraft = null;
        toast(`导入成功：${result.message}，正在重新打开…`);
        setTimeout(() => location.reload(), 800);
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
        clearUpload(ui.manageBookId);
        return;
      }
      const addToBook = target.closest("[data-add-to-book]");
      if (addToBook) {
        handleAddToBook(addToBook.dataset.addToBook);
        return;
      }
      const manageBookBtn = target.closest("[data-manage-book]");
      if (manageBookBtn) {
        openUploadManageSheet(manageBookBtn.dataset.manageBook);
        return;
      }
      if (target.closest("[data-rename-book]")) {
        openRenameBookSheet(ui.manageBookId);
        return;
      }
      if (target.closest("[data-delete-book]")) {
        const book = personalBook(ui.manageBookId);
        if (book && confirm(`删除「${book.name}」？里面的词和这一本的练习进度都会删掉。`)) {
          deletePersonalBook(book.id);
          closeSheet();
          renderCurrent();
          ensureCurrentBook().catch(() => {});
          toast(`已删除「${book.name}」`);
        }
        return;
      }
      const targetChipSheet = target.closest("[data-target-book]");
      if (targetChipSheet) {
        setPersonalTargetForScope(targetChipSheet.dataset.targetScope || "upload", targetChipSheet.dataset.targetBook);
        return;
      }
      const newBookChipSheet = target.closest("[data-new-book]");
      if (newBookChipSheet) {
        openNewBookSheet(newBookChipSheet.dataset.newBook || "upload");
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
      const lookupBookBtn = target.closest("[data-lookup-book]");
      if (lookupBookBtn) {
        handleLookupBookPick(lookupBookBtn.dataset.lookupBook);
        return;
      }
      if (target.closest("[data-lookup-new-book]")) {
        // 记住当前查的词，建完本直接加进去再回到查词页。
        const lookup = ui.currentLookup || {};
        const word = String(lookup.base || "").toLowerCase();
        ui.addBookWord = lookup.entry || (word ? { w: word, p: lookup.phonetic || "", m: lookup.meaning || "" } : null);
        openNewBookSheet("lookup");
        return;
      }
      const personalLookupBtn = target.closest("[data-personal-word]");
      if (personalLookupBtn) {
        const word = personalLookupBtn.dataset.personalWord;
        const lookup = ui.currentLookup || {};
        const entry = lookup.entry || { w: word, p: lookup.phonetic || "", m: lookup.meaning || "" };
        togglePersonalWord(entry, personalLookupBtn);
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
          if (status) status.textContent = `答案：${hwState.entry.w}（共 ${hwState.entry.w.replace(/[^a-z]/gi, "").length} 个字母）。请对照后选择。`;
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
      if (event.target.closest("[data-import-all]")) {
        const all = $("#sheetContent [data-import-all]");
        for (const box of $$("#sheetContent [data-import-scope]")) box.checked = all.checked;
        syncImportGroups();
        return;
      }
      const importGroup = event.target.closest("[data-import-group]");
      if (importGroup) {
        const cat = importGroup.dataset.importGroup;
        for (const box of $$("#sheetContent [data-import-scope]")) {
          if (box.dataset.importCat === cat) box.checked = importGroup.checked;
        }
        syncImportGroups();
        return;
      }
      if (event.target.closest("[data-import-scope]")) {
        syncImportGroups();
        return;
      }
      const group = event.target.closest("[data-group]");
      if (group) {
        // 组头：一键勾选/取消这一组的所有词汇本。
        const key = group.dataset.group;
        for (const box of scopeCheckboxes()) {
          if (scopeCategory(box.dataset.scope) === key) box.checked = group.checked;
        }
        updateDataTransferUI();
        return;
      }
      if (event.target.closest("[data-scope-all]")) {
        const all = $("#sheetContent [data-scope-all]");
        for (const box of scopeCheckboxes()) box.checked = all.checked;
        updateDataTransferUI();
        return;
      }
      const scope = event.target.closest("[data-scope]");
      if (scope) {
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

    // 点搜索框/下拉以外的地方，收起所有词汇搜索下拉。
    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-word-search]")) hideWordSearchMenus();
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
