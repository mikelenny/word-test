/*!
 * 词形变化引擎（morphology）—— 纯离线、零依赖、无构建。
 *
 * 输入：英文单词 + 词典释义（释义里的 n. / v. / adj. / ad. 之类标注用来判断词性）
 * 输出：规则推导出的变形 + 常见不规则表里的特殊变化。
 *
 * 暴露 window.WordMorph：
 *   posTags(meaning)            -> ["v","adj",...]
 *   guessTags(word)             -> 没有词性标注时按后缀猜
 *   forms(word, meaning)        -> [{ key, label, value, alt, irregular }]
 *        irregular=true 表示教学意义上的「不规则变化」，听写会额外考这些：
 *        查表命中、-man→-men（gentleman → gentlemen）、-f/-fe→-ves（leaf → leaves）。
 *        city → cities、potato → potatoes 这类按拼写规则来的仍算规则变化。
 *   hasForms(word, meaning)     -> boolean
 *   practiceTargets(word, meaning) -> 适合听写的变形（去掉与原形同形的）
 */
(function (global) {
  "use strict";

  /* ---------------- 词性 ---------------- */
  const POS_RE = new RegExp(
    "(?:^|[\\s（(,，、;；/&+])(n|v|vt|vi|adj|adv|ad|a|prep|conj|pron|num|art|int|aux|modal|abbr)\\.",
    "gi"
  );
  const POS_ALIAS = { vt: "v", vi: "v", aux: "v", modal: "v", a: "adj", ad: "adv" };

  function posTags(meaning) {
    const tags = new Set();
    // vt&n. / adj&adv. 这种合写先拆成两个标注。
    const text = String(meaning || "").replace(/([a-z]{1,5})&(?=[a-z]{1,5}\.)/gi, "$1. ");
    if (!text) return tags;
    let match;
    POS_RE.lastIndex = 0;
    while ((match = POS_RE.exec(text))) {
      let tag = String(match[1] || "").toLowerCase();
      tag = POS_ALIAS[tag] || tag;
      if (tag === "n" || tag === "v" || tag === "adj" || tag === "adv") tags.add(tag);
    }
    return tags;
  }

  // 没有词性标注时（比如只上传了词表），按后缀做一个保守猜测。
  function guessTags(word) {
    const w = String(word || "").toLowerCase();
    const tags = new Set();
    if (!w || /[^a-z]/.test(w)) return tags;
    if (/(tion|sion|ment|ness|ity|ance|ence|ship|hood|ism|ist|age|ure)$/.test(w)) tags.add("n");
    if (/(ous|ful|ive|able|ible|less|ish|ary|ant|ent|al|ic)$/.test(w)) tags.add("adj");
    if (/(ing|ed|ise|ize|ify|ate)$/.test(w)) tags.add("v");
    if (/ly$/.test(w) && w.length > 4) tags.add("adv");
    return tags;
  }

  /* ---------------- 不规则表 ---------------- */
  // 动词：[过去式, 过去分词]，用 / 分隔可接受的另一种写法。
  const IRREGULAR_VERBS = {
    arise: ["arose", "arisen"],
    awake: ["awoke", "awoken"],
    be: ["was/were", "been"],
    backslide: ["backslid", "backslid"],
    bear: ["bore", "borne/born"],
    beat: ["beat", "beaten"],
    become: ["became", "become"],
    begin: ["began", "begun"],
    bend: ["bent", "bent"],
    bet: ["bet", "bet"],
    bid: ["bid", "bid"],
    bind: ["bound", "bound"],
    bite: ["bit", "bitten"],
    bleed: ["bled", "bled"],
    blow: ["blew", "blown"],
    break: ["broke", "broken"],
    breed: ["bred", "bred"],
    bring: ["brought", "brought"],
    broadcast: ["broadcast", "broadcast"],
    build: ["built", "built"],
    burn: ["burnt/burned", "burnt/burned"],
    burst: ["burst", "burst"],
    buy: ["bought", "bought"],
    cast: ["cast", "cast"],
    catch: ["caught", "caught"],
    choose: ["chose", "chosen"],
    cling: ["clung", "clung"],
    come: ["came", "come"],
    cost: ["cost", "cost"],
    creep: ["crept", "crept"],
    cut: ["cut", "cut"],
    deal: ["dealt", "dealt"],
    dig: ["dug", "dug"],
    dive: ["dived/dove", "dived"],
    do: ["did", "done"],
    draw: ["drew", "drawn"],
    dream: ["dreamt/dreamed", "dreamt/dreamed"],
    drink: ["drank", "drunk"],
    drive: ["drove", "driven"],
    dwell: ["dwelt/dwelled", "dwelt/dwelled"],
    eat: ["ate", "eaten"],
    fall: ["fell", "fallen"],
    feed: ["fed", "fed"],
    feel: ["felt", "felt"],
    fight: ["fought", "fought"],
    find: ["found", "found"],
    flee: ["fled", "fled"],
    fling: ["flung", "flung"],
    fly: ["flew", "flown"],
    forbid: ["forbade", "forbidden"],
    forecast: ["forecast", "forecast"],
    foresee: ["foresaw", "foreseen"],
    forget: ["forgot", "forgotten"],
    forgive: ["forgave", "forgiven"],
    freeze: ["froze", "frozen"],
    get: ["got", "got/gotten"],
    give: ["gave", "given"],
    go: ["went", "gone"],
    grind: ["ground", "ground"],
    grow: ["grew", "grown"],
    hang: ["hung/hanged", "hung/hanged"],
    have: ["had", "had"],
    hear: ["heard", "heard"],
    hide: ["hid", "hidden"],
    hit: ["hit", "hit"],
    hold: ["held", "held"],
    hurt: ["hurt", "hurt"],
    keep: ["kept", "kept"],
    kneel: ["knelt/kneeled", "knelt/kneeled"],
    knit: ["knitted/knit", "knitted/knit"],
    know: ["knew", "known"],
    lay: ["laid", "laid"],
    lead: ["led", "led"],
    lean: ["leant/leaned", "leant/leaned"],
    leap: ["leapt/leaped", "leapt/leaped"],
    learn: ["learnt/learned", "learnt/learned"],
    leave: ["left", "left"],
    lend: ["lent", "lent"],
    let: ["let", "let"],
    lie: ["lay", "lain"],
    light: ["lit/lighted", "lit/lighted"],
    lose: ["lost", "lost"],
    make: ["made", "made"],
    mean: ["meant", "meant"],
    meet: ["met", "met"],
    mistake: ["mistook", "mistaken"],
    overcome: ["overcame", "overcome"],
    pay: ["paid", "paid"],
    plead: ["pleaded/pled", "pleaded/pled"],
    prove: ["proved", "proved/proven"],
    put: ["put", "put"],
    quit: ["quit", "quit"],
    read: ["read", "read"],
    rid: ["rid", "rid"],
    ride: ["rode", "ridden"],
    ring: ["rang", "rung"],
    rise: ["rose", "risen"],
    run: ["ran", "run"],
    say: ["said", "said"],
    see: ["saw", "seen"],
    seek: ["sought", "sought"],
    sell: ["sold", "sold"],
    send: ["sent", "sent"],
    set: ["set", "set"],
    sew: ["sewed", "sewn/sewed"],
    shake: ["shook", "shaken"],
    shave: ["shaved", "shaved/shaven"],
    shed: ["shed", "shed"],
    shine: ["shone/shined", "shone/shined"],
    shoot: ["shot", "shot"],
    show: ["showed", "shown/showed"],
    shrink: ["shrank", "shrunk"],
    shut: ["shut", "shut"],
    sing: ["sang", "sung"],
    sink: ["sank", "sunk"],
    sit: ["sat", "sat"],
    sleep: ["slept", "slept"],
    slide: ["slid", "slid"],
    slit: ["slit", "slit"],
    smell: ["smelt/smelled", "smelt/smelled"],
    sow: ["sowed", "sown/sowed"],
    speak: ["spoke", "spoken"],
    speed: ["sped/speeded", "sped/speeded"],
    spell: ["spelt/spelled", "spelt/spelled"],
    spend: ["spent", "spent"],
    spill: ["spilt/spilled", "spilt/spilled"],
    spin: ["spun", "spun"],
    spit: ["spat", "spat"],
    split: ["split", "split"],
    spread: ["spread", "spread"],
    spring: ["sprang", "sprung"],
    stand: ["stood", "stood"],
    steal: ["stole", "stolen"],
    stick: ["stuck", "stuck"],
    sting: ["stung", "stung"],
    stink: ["stank", "stunk"],
    stride: ["strode", "stridden"],
    strike: ["struck", "struck"],
    string: ["strung", "strung"],
    strive: ["strove", "striven"],
    swear: ["swore", "sworn"],
    sweep: ["swept", "swept"],
    swell: ["swelled", "swollen/swelled"],
    swim: ["swam", "swum"],
    swing: ["swung", "swung"],
    take: ["took", "taken"],
    teach: ["taught", "taught"],
    tear: ["tore", "torn"],
    tell: ["told", "told"],
    think: ["thought", "thought"],
    throw: ["threw", "thrown"],
    thrust: ["thrust", "thrust"],
    thrive: ["thrived/throve", "thrived/thriven"],
    undergo: ["underwent", "undergone"],
    understand: ["understood", "understood"],
    undertake: ["undertook", "undertaken"],
    uphold: ["upheld", "upheld"],
    wake: ["woke", "woken"],
    wear: ["wore", "worn"],
    weave: ["wove", "woven"],
    weep: ["wept", "wept"],
    wet: ["wet/wetted", "wet/wetted"],
    win: ["won", "won"],
    wind: ["wound", "wound"],
    withdraw: ["withdrew", "withdrawn"],
    withhold: ["withheld", "withheld"],
    withstand: ["withstood", "withstood"],
    write: ["wrote", "written"],
  };

  // 形容词：[比较级, 最高级]
  const IRREGULAR_ADJ = {
    good: ["better", "best"],
    well: ["better", "best"],
    bad: ["worse", "worst"],
    far: ["farther/further", "farthest/furthest"],
    little: ["less", "least"],
    many: ["more", "most"],
    much: ["more", "most"],
    old: ["older/elder", "oldest/eldest"],
  };

  // 形容词 → 副词的特殊形式（不规则或同形）。
  const IRREGULAR_ADV = {
    good: "well",
    fast: "fast",
    hard: "hard",
    early: "early",
    late: "late",
    high: "high",
    low: "low",
    long: "long",
    near: "near",
    far: "far",
    little: "little",
    much: "much",
    straight: "straight",
    right: "right",
    wrong: "wrong",
    well: "well",
  };

  const IRREGULAR_NOUNS = {
    child: "children",
    man: "men",
    woman: "women",
    foot: "feet",
    tooth: "teeth",
    goose: "geese",
    mouse: "mice",
    louse: "lice",
    person: "people",
    ox: "oxen",
    sheep: "sheep",
    deer: "deer",
    fish: "fish",
    series: "series",
    species: "species",
    aircraft: "aircraft",
    means: "means",
    analysis: "analyses",
    axis: "axes",
    basis: "bases",
    crisis: "crises",
    diagnosis: "diagnoses",
    emphasis: "emphases",
    thesis: "theses",
    hypothesis: "hypotheses",
    oasis: "oases",
    phenomenon: "phenomena",
    criterion: "criteria",
    datum: "data",
    medium: "media",
    bacterium: "bacteria",
    curriculum: "curricula",
    memorandum: "memoranda",
    stimulus: "stimuli",
    fungus: "fungi",
    nucleus: "nuclei",
    syllabus: "syllabi",
    alumnus: "alumni",
    cactus: "cacti",
    appendix: "appendices",
    formula: "formulae/formulas",
    larva: "larvae",
    antenna: "antennae/antennas",
    radius: "radii",
    genus: "genera",
  };

  // 已经是变形结果的词，不再往下推（查 better 不该出现 betterer）。
  const DERIVED = new Set([
    "better", "best", "worse", "worst", "more", "most", "less", "least",
    "further", "furthest", "farther", "farthest", "elder", "eldest",
    "children", "men", "women", "feet", "teeth", "geese", "mice", "people",
    "went", "gone", "been", "was", "were", "is", "am", "are",
  ]);

  // 双写末尾辅音的常用多音节动词（prefer → preferred）。
  const DOUBLE_FINAL = new Set([
    "prefer", "refer", "occur", "regret", "admit", "permit", "commit",
    "control", "patrol", "equip", "compel", "expel", "begin", "forget",
    "upset", "transfer", "submit", "omit", "deter", "incur",
  ]);

  const VOWEL = /[aeiou]/;

  /* ---------------- 规则工具 ---------------- */
  function syllables(word) {
    const w = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!w) return 0;
    const groups = w.match(/[aeiouy]+/g) || [];
    let n = groups.length;
    // 结尾不发音的 e：make / take / hope，少算一个音节。
    if (/[^aeiouy]e$/.test(w) && !/[aeiouy]{2}e$/.test(w)) n -= 1;
    return Math.max(1, n);
  }

  function endsWithCVC(word) {
    return /[^aeiou][aeiou][^aeiouwxy]$/.test(word);
  }

  function shouldDouble(word) {
    if (DOUBLE_FINAL.has(word)) return true;
    return syllables(word) === 1 && endsWithCVC(word);
  }

  function splitForm(value) {
    const parts = String(value || "")
      .split("/")
      .map((item) => item.trim())
      .filter(Boolean);
    return { value: parts[0] || "", alt: parts.slice(1) };
  }

  /* ---------------- 动词 ---------------- */
  function thirdPerson(word) {
    const special = { be: "is", have: "has", do: "does", go: "goes" };
    if (special[word]) return special[word];
    if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
    if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
    if (/o$/.test(word)) return `${word}es`;
    return `${word}s`;
  }

  function ingForm(word) {
    if (word === "be") return "being";
    if (/ie$/.test(word)) return `${word.slice(0, -2)}ying`;
    if (/[^e]e$/.test(word)) return `${word.slice(0, -1)}ing`;
    if (shouldDouble(word)) return `${word}${word.slice(-1)}ing`;
    return `${word}ing`;
  }

  function regularPast(word) {
    if (/e$/.test(word)) return `${word}d`;
    if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ied`;
    if (/c$/.test(word)) return `${word}ked`;
    if (shouldDouble(word)) return `${word}${word.slice(-1)}ed`;
    return `${word}ed`;
  }

  // travel / cancel / model 这类 -l 结尾的词，英式会双写（travelled）。
  const L_DOUBLE = /(travel|cancel|model|label|signal|level|marvel|fuel|quarrel|worship|kidnap|handicap)$/;

  function verbForms(word) {
    const out = [];
    const irregular = IRREGULAR_VERBS[word];
    const third = thirdPerson(word);
    const ing = ingForm(word);
    if (irregular) {
      const past = splitForm(irregular[0]);
      const pp = splitForm(irregular[1]);
      out.push({ key: "past", label: "过去式", value: past.value, alt: past.alt, irregular: true });
      out.push({ key: "pp", label: "过去分词", value: pp.value, alt: pp.alt, irregular: true });
    } else {
      const past = regularPast(word);
      const alt = L_DOUBLE.test(word) ? [past.replace(/([^aeiou])ed$/, "$1$1ed")].filter((item) => item !== past) : [];
      // 规则动词的过去式和过去分词同形，也要生成两条：听写时两个空分别考。
      // 普通展示场景由 forms() 再把它们合并回「过去式 / 过去分词」一条。
      out.push({ key: "past", label: "过去式", value: past, alt: alt.slice(), irregular: false });
      out.push({ key: "pp", label: "过去分词", value: past, alt: alt.slice(), irregular: false });
    }
    out.push({ key: "ing", label: "现在分词", value: ing, alt: [], irregular: false });
    out.push({ key: "third", label: "第三人称单数", value: third, alt: [], irregular: false });
    return out;
  }

  /* ---------------- 形容词 / 副词 ---------------- */
  function adjForms(word) {
    const out = [];
    const irregular = IRREGULAR_ADJ[word];
    if (irregular) {
      const comp = splitForm(irregular[0]);
      const sup = splitForm(irregular[1]);
      out.push({ key: "comp", label: "比较级", value: comp.value, alt: comp.alt, irregular: true });
      out.push({ key: "sup", label: "最高级", value: sup.value, alt: sup.alt, irregular: true });
      return out;
    }
    // 三个音节以上，或常见的“长”后缀，用 more / most。
    const longBySuffix = /(ful|ous|ive|less|ing|ed|al|ic|ish|ant|ent|ary|able|ible|ern|en|er|est)$/.test(word);
    if (NO_COMPARE.has(word)) return [];
    // 双音节 -e 结尾（polite / sincere / extreme）习惯用 more / most，短词除外。
    const shortE = /^(nice|large|simple|gentle|safe|wide|fine|close|late|huge|loose|wise|pale|rude|brave|free|strange)$/.test(word);
    if (syllables(word) >= 3 || longBySuffix || (syllables(word) >= 2 && /e$/.test(word) && !shortE)) {
      out.push({ key: "comp", label: "比较级", value: `more ${word}`, alt: [], irregular: false });
      out.push({ key: "sup", label: "最高级", value: `most ${word}`, alt: [], irregular: false });
      return out;
    }
    let comp;
    let sup;
    if (/[^aeiou]y$/.test(word)) {
      comp = `${word.slice(0, -1)}ier`;
      sup = `${word.slice(0, -1)}iest`;
    } else if (/e$/.test(word)) {
      comp = `${word}r`;
      sup = `${word}st`;
    } else if (shouldDouble(word)) {
      const last = word.slice(-1);
      comp = `${word}${last}er`;
      sup = `${word}${last}est`;
    } else {
      comp = `${word}er`;
      sup = `${word}est`;
    }
    out.push({ key: "comp", label: "比较级", value: comp, alt: [], irregular: false });
    out.push({ key: "sup", label: "最高级", value: sup, alt: [], irregular: false });
    return out;
  }

  function adverbForm(word) {
    if (IRREGULAR_ADV[word]) return IRREGULAR_ADV[word];
    if (/whole$/.test(word)) return "wholly";
    if (/ly$/.test(word)) return "";
    if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ily`;
    if (/[^aeiou]le$/.test(word)) return `${word.slice(0, -1)}y`;
    if (/ic$/.test(word)) return `${word}ally`;
    if (/ll$/.test(word)) return `${word}y`;
    if (/ue$/.test(word)) return `${word.slice(0, -1)}ly`;
    return `${word}ly`;
  }

  /* ---------------- 名词 ---------------- */
  const F_TO_VES = /(leaf|life|knife|wife|wolf|half|shelf|thief|self|loaf|calf|elf|scarf)$/;
  // 这些 -o 结尾的外来词只加 s，其余 -o 结尾加 es（potato / hero / go）。
  const O_KEEP_S = /(photo|piano|radio|video|zoo|memo|kilo|logo|solo|auto|studio|disco|tobacco|buffalo|casino|portfolio|embryo)$/;

  // -man 结尾的复合词（gentleman / policeman / fisherman）复数要把 man 变 men。
  const MAN_COMPOUND = /man$/;
  const MAN_KEEP_S = /(human|german|roman|shaman|walkman|talisman|ottoman)$/;
  // ch 发 /k/ 的词只加 s（stomachs / monarchs），不能写 stomaches。
  const CH_KEEP_S = /(stomach|monarch|epoch|patriarch|matriarch|hierarch|eunuch|oligarch)$/;

  function isManCompound(word) {
    return MAN_COMPOUND.test(word) && !MAN_KEEP_S.test(word);
  }

  function pluralForm(word) {
    if (IRREGULAR_NOUNS[word]) return IRREGULAR_NOUNS[word];
    if (isManCompound(word)) return `${word.slice(0, -3)}men`;
    if (/(s|x|z|ch|sh)$/.test(word) && !CH_KEEP_S.test(word)) return `${word}es`;
    if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
    // -fe 去两个字母（wife → wives），-f 去一个字母（leaf → leaves）。
    if (F_TO_VES.test(word)) return `${word.slice(0, /fe$/.test(word) ? -2 : -1)}ves`;
    if (/o$/.test(word)) return O_KEEP_S.test(word) ? `${word}s` : `${word}es`;
    return `${word}s`;
  }

  // 教学上算「不规则复数」的：查表命中、-man→-men、-f/-fe→-ves。
  function isIrregularPlural(word) {
    return Boolean(IRREGULAR_NOUNS[word]) || isManCompound(word) || F_TO_VES.test(word);
  }

  /* ---------------- 汇总 ---------------- */
  const ORDER = ["past", "pp", "ing", "third", "comp", "sup", "adv", "plural"];

  // 这些形容词没有常用的 -ly 副词，别硬造（bigly / smallly）。
  const NO_ADVERB = new Set([
    "big", "small", "tall", "short", "long", "young", "old", "hot", "cold",
    "warm", "cool", "fat", "thin", "thick", "huge", "vast", "ill", "glad",
    "afraid", "alone", "alive", "asleep", "awake", "aware", "worth", "bound",
    "other", "either", "neither", "later", "former", "latter", "inner",
    "outer", "upper", "lower", "super", "prior", "major", "minor", "chief",
    "elder", "mere", "daily", "weekly", "monthly", "yearly", "dead", "extra",
    "only", "own", "same", "half",
  ]);

  // 表语形容词 / 本身已经表示极限的，不讲比较级最高级。
  const NO_COMPARE = new Set([
    "afraid", "alone", "alive", "asleep", "awake", "aware", "glad", "ill",
    "worth", "whole", "dead", "main", "only", "own", "same", "total",
    "extra", "former", "latter", "daily", "monthly", "weekly", "yearly", "bound",
    "either", "neither", "other", "another", "later", "outer", "inner", "upper",
    "lower", "super", "prior", "major", "minor", "chief", "elder", "mere",
    "Chinese", "English", "true", "full", "empty", "unique", "perfect", "half",
  ]);

  // 本身就只有复数形式的名词，不再加 -s。
  const PLURAL_ONLY = new Set([
    "clothes", "goods", "scissors", "trousers", "jeans", "pants", "shorts",
    "glasses", "police", "cattle", "people", "headquarters", "surroundings",
    "archives", "outskirts", "remains", "thanks", "savings", "belongings",
    "earnings", "riches", "congratulations", "premises", "whereabouts",
    "lodgings", "stairs", "valuables",
  ]);

  // 不可数名词不加复数。
  const UNCOUNTABLE = new Set([
    "information", "advice", "furniture", "equipment", "knowledge", "news",
    "homework", "housework", "money", "water", "music", "luggage", "baggage",
    "bread", "rice", "milk", "traffic", "weather", "progress", "research",
    "evidence", "education", "health", "happiness", "courage", "patience",
    "pollution", "rubbish", "garbage", "scenery", "machinery", "jewellery",
    "clothing", "accommodation", "software", "hardware", "fun", "little",
    "blood", "garlic", "salt", "sugar", "sand", "soil", "oxygen", "electricity",
    "cotton", "wool", "steel", "gold", "silver", "iron", "behalf", "wildlife",
  ]);

  function forms(word, meaning, options = {}) {
    const base = String(word || "").toLowerCase().trim();
    if (!base || /[^a-z]/.test(base) || base.length < 2) return [];
    if (DERIVED.has(base)) return [];
    let tags = posTags(meaning);
    if (!tags.size) tags = guessTags(base);
    if (!tags.size) return [];

    let list = [];
    if (tags.has("v")) list.push(...verbForms(base));
    if (tags.has("adj")) {
      list.push(...adjForms(base));
      const adv = adverbForm(base);
      // 词典本身已经把副词义收在同一个词条里（quick 的 ad.）就不再重复。
      // ivory / daily 这类既是名词又是形容词的词，别再硬造 ivorily。
      const nounAdjective = tags.has("n") && /y$/.test(base);
      if (adv && adv !== base && !tags.has("adv") && !NO_ADVERB.has(base) && !nounAdjective) {
        list.push({ key: "adv", label: "副词", value: adv, alt: [], irregular: Boolean(IRREGULAR_ADV[base]) });
      }
    }
    const pluralOnly = PLURAL_ONLY.has(base) || /[(（【]\s*pl/i.test(meaning || "");
    if (tags.has("n") && !UNCOUNTABLE.has(base) && !pluralOnly) {
      const plural = pluralForm(base);
      list.push({
        key: "plural",
        label: "复数",
        value: plural,
        alt: [],
        irregular: isIrregularPlural(base),
      });
    }

    // cut / pay 这类过去式和过去分词同形的，展示和独立 form 练习合成一条；
    // 多行听写要两个空分别考，传 keepPairs 时保留两个独立词条。
    const past = list.find((form) => form.key === "past");
    const pp = list.find((form) => form.key === "pp");
    if (!options.keepPairs && past && pp && past.value === pp.value) {
      past.label = "过去式 / 过去分词";
      past.alt = Array.from(new Set([...(past.alt || []), ...(pp.alt || [])]));
      list = list.filter((form) => form !== pp);
    }

    // 同一个写法只保留一次（go 的第三人称和复数都是 goes），按 ORDER 排。
    const seen = new Set([base]);
    const out = [];
    for (const key of ORDER) {
      for (const form of list) {
        if (form.key !== key) continue;
        const value = String(form.value || "").trim();
        if (!value || value === base) continue;
        // 听写的多行卡片要按词性分组，study 的三单和复数都是 studies，也得各占一行。
        const probe = options.keepDuplicates || options.keepPairs
          ? `${form.key}|${value}|${form.alt.join("/")}`
          : `${value}|${form.alt.join("/")}`;
        if (seen.has(probe)) continue;
        seen.add(probe);
        out.push({ ...form, value, alt: form.alt.filter(Boolean) });
      }
    }
    return out;
  }

  function practiceTargets(word, meaning) {
    return forms(word, meaning).filter((form) => {
      const all = [form.value, ...form.alt].map((item) => item.toLowerCase().replace(/\s+/g, " "));
      return all.every((item) => item !== String(word || "").toLowerCase());
    });
  }

  global.WordMorph = {
    posTags,
    guessTags,
    forms,
    practiceTargets,
    hasForms: (word, meaning) => forms(word, meaning).length > 0,
  };
})(typeof window !== "undefined" ? window : globalThis);
