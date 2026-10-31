#!/usr/bin/env python3
"""Build the compact, offline word books used by 词听.

Source data (kept outside the published site):
  * gaokao.jsonl / ielts.jsonl / cet4.jsonl / kaoyan.jsonl
    KyleBing/english-vocabulary, BSD-3-Clause
  * 3500.txt
    pluto0x0/word3500, MIT

Usage:
  python3 tools/build_data.py --src ./data-src --out ./data
"""
from __future__ import annotations

import argparse
import html
import json
import re
from datetime import date
from pathlib import Path

SINGLE_WORD = re.compile(r"^[a-z][a-z'\-]*$")
POS = {"n", "v", "vt", "vi", "adj", "a", "adv", "ad", "prep", "conj",
       "pron", "num", "art", "int", "aux", "abbr", "phr"}

FUNCTION_WORDS = {
    "the": ("ðə", "art. 这；那（定冠词）"),
    "a": ("ə", "art. 一（个）；每一（个）"),
    "an": ("ən", "art. 一（个）（用于元音前）"),
    "of": ("əv", "prep. ……的；属于"),
    "to": ("tuː", "prep. 向；到；给；conj. 到……为止"),
    "in": ("ɪn", "prep. 在……里；在……期间"),
    "on": ("ɒn", "prep. 在……上；关于；adv. 继续"),
    "at": ("æt", "prep. 在（某处）；在（某时）"),
    "and": ("ænd", "conj. 和；而且"),
    "or": ("ɔː", "conj. 或者；否则"),
    "but": ("bʌt", "conj. 但是；除了"),
    "is": ("ɪz", "v. 是（be 的第三人称单数）"),
    "am": ("æm", "v. 是（be 的第一人称单数）"),
    "are": ("ɑː", "v. 是（be 的复数形式）"),
    "was": ("wɒz", "v. 是（be 的过去式，单数）"),
    "were": ("wɜː", "v. 是（be 的过去式，复数）"),
    "be": ("biː", "v. 是；成为；存在"),
    "been": ("biːn", "v. be 的过去分词"),
    "being": ("ˈbiːɪŋ", "v. be 的现在分词；n. 存在"),
    "this": ("ðɪs", "pron. 这；这个"),
    "that": ("ðæt", "pron. 那；那个；conj. 那；引导从句"),
    "these": ("ðiːz", "pron. 这些"),
    "those": ("ðəʊz", "pron. 那些"),
    "it": ("ɪt", "pron. 它"),
    "its": ("ɪts", "pron. 它的"),
    "he": ("hiː", "pron. 他"),
    "she": ("ʃiː", "pron. 她"),
    "they": ("ðeɪ", "pron. 他们；她们；它们"),
    "we": ("wiː", "pron. 我们"),
    "you": ("juː", "pron. 你；你们"),
    "i": ("aɪ", "pron. 我"),
    "me": ("miː", "pron. 我（宾格）"),
    "him": ("hɪm", "pron. 他（宾格）"),
    "her": ("hɜː", "pron. 她（宾格）；她的"),
    "us": ("ʌs", "pron. 我们（宾格）"),
    "them": ("ðem", "pron. 他们；她们；它们（宾格）"),
    "my": ("maɪ", "pron. 我的"),
    "your": ("jɔː", "pron. 你的；你们的"),
    "his": ("hɪz", "pron. 他的"),
    "their": ("ðeə", "pron. 他们的；她们的；它们的"),
    "our": ("ˈaʊə", "pron. 我们的"),
    "not": ("nɒt", "adv. 不；没有"),
    "no": ("nəʊ", "adv. 不；adj. 没有"),
    "yes": ("jes", "adv. 是；对"),
    "do": ("duː", "v. 做；助动词"),
    "does": ("dʌz", "v. do 的第三人称单数"),
    "did": ("dɪd", "v. do 的过去式"),
    "have": ("hæv", "v. 有；吃；经历；助动词"),
    "has": ("hæz", "v. have 的第三人称单数"),
    "had": ("hæd", "v. have 的过去式和过去分词"),
    "will": ("wɪl", "modal v. 将；会；愿意"),
    "would": ("wʊd", "modal v. 将会；愿意；过去常常"),
    "can": ("kæn", "modal v. 能；可以；n. 罐头"),
    "could": ("kʊd", "modal v. 能；可以（can 的过去式）"),
    "may": ("meɪ", "modal v. 可能；可以"),
    "might": ("maɪt", "modal v. 可能；也许"),
    "must": ("mʌst", "modal v. 必须；一定"),
    "should": ("ʃʊd", "modal v. 应该"),
    "with": ("wɪð", "prep. 和……一起；带有；用"),
    "for": ("fɔː", "prep. 为了；给；因为；持续"),
    "from": ("frɒm", "prep. 从；来自"),
    "by": ("baɪ", "prep. 由；通过；在……旁边"),
    "as": ("æz", "prep. 作为；conj. 当……时；因为"),
    "about": ("əˈbaʊt", "prep. 关于；adv. 大约"),
    "into": ("ˈɪntuː", "prep. 进入；到……里面"),
    "over": ("ˈəʊvə", "prep. 在……上方；超过；adv. 结束"),
    "after": ("ˈɑːftə", "prep. 在……之后；conj. 在……以后"),
    "before": ("bɪˈfɔː", "prep. 在……之前；conj. 在……以前"),
    "up": ("ʌp", "adv. 向上；起来；prep. 沿着"),
    "down": ("daʊn", "adv. 向下；prep. 沿着……向下"),
    "out": ("aʊt", "adv. 出去；向外；prep. 从……出去"),
    "off": ("ɒf", "adv. 离开；关闭；prep. 从……离开"),
    "than": ("ðæn", "conj. 比；prep. 比"),
    "then": ("ðen", "adv. 那时；然后；那么"),
    "there": ("ðeə", "adv. 在那里；那儿"),
    "here": ("hɪə", "adv. 在这里；这儿"),
    "when": ("wen", "adv. 什么时候；conj. 当……时"),
    "where": ("weə", "adv. 在哪里；conj. 在……的地方"),
    "why": ("waɪ", "adv. 为什么"),
    "how": ("haʊ", "adv. 怎样；如何；多么"),
    "what": ("wɒt", "pron. 什么；adj. 什么样的"),
    "which": ("wɪtʃ", "pron. 哪一个；adj. 哪一个的"),
    "who": ("huː", "pron. 谁"),
    "whom": ("huːm", "pron. 谁（宾格）"),
    "whose": ("huːz", "pron. 谁的"),
    "if": ("ɪf", "conj. 如果；是否"),
    "because": ("bɪˈkɒz", "conj. 因为"),
    "so": ("səʊ", "adv. 如此；因此；conj. 所以"),
    "very": ("ˈveri", "adv. 非常；很"),
    "too": ("tuː", "adv. 也；太"),
    "also": ("ˈɔːlsəʊ", "adv. 也；而且"),
    "only": ("ˈəʊnli", "adv. 只；仅仅；adj. 唯一的"),
    "just": ("dʒʌst", "adv. 刚刚；只是；恰好"),
    "more": ("mɔː", "adj. 更多的；adv. 更"),
    "most": ("məʊst", "adj. 最多的；adv. 最"),
    "some": ("sʌm", "adj. 一些；pron. 一些"),
    "any": ("ˈeni", "adj. 任何的；pron. 任何一个"),
    "all": ("ɔːl", "adj. 全部的；pron. 全部"),
    "each": ("iːtʃ", "adj. 每个；pron. 每个"),
    "every": ("ˈevri", "adj. 每一个；每隔"),
    "both": ("bəʊθ", "adj. 两个都；pron. 两者都"),
    "other": ("ˈʌðə", "adj. 其他的；pron. 其他人（物）"),
    "another": ("əˈnʌðə", "adj. 另一个；pron. 另一个"),
    "such": ("sʌtʃ", "adj. 这样的；pron. 这样的人（物）"),
    "own": ("əʊn", "adj. 自己的；v. 拥有"),
    "same": ("seɪm", "adj. 相同的；pron. 同样的人（物）"),
    "one": ("wʌn", "num. 一；pron. 一个人（物）"),
    "two": ("tuː", "num. 二"),
    "first": ("fɜːst", "adj. 第一的；adv. 首先"),
    "last": ("lɑːst", "adj. 最后的；v. 持续"),
    "new": ("njuː", "adj. 新的"),
    "old": ("əʊld", "adj. 老的；旧的"),
    "good": ("ɡʊd", "adj. 好的；n. 好处"),
    "well": ("wel", "adv. 好；adj. 健康的；n. 井"),
    "bad": ("bæd", "adj. 坏的；严重的"),
    "many": ("ˈmeni", "adj. 许多的；pron. 许多"),
    "much": ("mʌtʃ", "adj. 许多的；adv. 非常"),
    "few": ("fjuː", "adj. 很少的；pron. 少数"),
    "little": ("ˈlɪtl", "adj. 小的；少的；adv. 很少"),
    "now": ("naʊ", "adv. 现在；n. 现在"),
    "today": ("təˈdeɪ", "adv. 今天；n. 今天"),
    "tomorrow": ("təˈmɒrəʊ", "adv. 明天；n. 明天"),
    "yesterday": ("ˈjestədeɪ", "adv. 昨天；n. 昨天"),
    "time": ("taɪm", "n. 时间；次数；v. 计时"),
    "people": ("ˈpiːpl", "n. 人；人们；民族"),
    "world": ("wɜːld", "n. 世界；领域"),
    "way": ("weɪ", "n. 方法；道路；方向"),
    "day": ("deɪ", "n. 天；白天"),
    "year": ("jɪə", "n. 年；年份"),
    "thing": ("θɪŋ", "n. 东西；事情"),
    "man": ("mæn", "n. 男人；人类"),
    "woman": ("ˈwʊmən", "n. 女人"),
    "child": ("tʃaɪld", "n. 孩子；儿童"),
    "children": ("ˈtʃɪldrən", "n. child 的复数"),
    "life": ("laɪf", "n. 生活；生命"),
    "work": ("wɜːk", "n. 工作；v. 工作；运转"),
    "school": ("skuːl", "n. 学校"),
    "home": ("həʊm", "n. 家；adv. 在家；回家"),
    "house": ("haʊs", "n. 房子；v. 容纳"),
    "friend": ("frend", "n. 朋友"),
    "family": ("ˈfæməli", "n. 家庭；家人"),
    "water": ("ˈwɔːtə", "n. 水；v. 浇水"),
    "food": ("fuːd", "n. 食物"),
    "book": ("bʊk", "n. 书；v. 预订"),
    "word": ("wɜːd", "n. 单词；话语"),
    "language": ("ˈlæŋɡwɪdʒ", "n. 语言"),
    "english": ("ˈɪŋɡlɪʃ", "n. 英语；adj. 英国的"),
    "china": ("ˈtʃaɪnə", "n. 中国；瓷器"),
    "chinese": ("ˌtʃaɪˈniːz", "n. 中文；中国人；adj. 中国的"),
}


def clean_text(value: object) -> str:
    text = html.unescape(str(value or ""))
    text = text.replace("\u00a0", " ").replace("\u3000", " ")
    text = re.sub(r"[\r\n\t]+", " ", text)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


def clean_phonetic(record: dict) -> str:
    raw = clean_text(record.get("us") or record.get("uk") or "")
    raw = raw.strip("/[] ")
    raw = raw.replace("'", "ˈ").replace("`", "ˈ")
    raw = re.sub(r"\s*;\s*", "; ", raw)
    if len(raw) > 56:
        raw = raw.split(";")[0].strip()
    return raw


def clean_meaning(record: dict) -> str:
    out: list[str] = []
    for item in (record.get("translations") or [])[:4]:
        translation = clean_text(item.get("translation"))
        if not translation:
            continue
        pos = clean_text(item.get("type")).lower().strip(".")
        if pos and pos not in translation[:8].lower():
            label = "adj." if pos in {"a", "adj"} else "adv." if pos in {"ad", "adv"} else f"{pos}."
            translation = f"{label} {translation}"
        translation = translation.strip("；;，, ")
        if translation and translation not in out:
            out.append(translation)
        if sum(len(x) for x in out) >= 130:
            break
    text = "；".join(out)
    if len(text) > 180:
        text = text[:177].rstrip("；;，, ") + "…"
    return text


def clean_sentence(text: object) -> str:
    value = clean_text(text)
    value = value.strip('"“”')
    value = re.sub(r"\s+([,.;:!?])", r"\1", value)
    return value


def pick_example(record: dict) -> tuple[str, str]:
    candidates = []
    for item in record.get("sentences") or []:
        en = clean_sentence(item.get("sentence"))
        zh = clean_sentence(item.get("translation"))
        if not en or not zh:
            continue
        if not (6 <= len(en) <= 230):
            continue
        if not re.search(r"[A-Za-z]", en):
            continue
        score = 0
        if 20 <= len(en) <= 120:
            score += 2
        if len(zh) <= 120:
            score += 1
        if re.search(r"[.!?]$", en):
            score += 1
        candidates.append((score, en, zh))
    if not candidates:
        return "", ""
    candidates.sort(key=lambda x: -x[0])
    _, en, zh = candidates[0]
    return en, zh


def parse_3500(path: Path) -> dict[str, dict]:
    lines = [line.strip() for line in path.read_text(encoding="utf-8-sig").splitlines()]
    entries: dict[str, dict] = {}
    i = 0
    while i < len(lines) - 2:
        head, phonetic, meaning = lines[i], lines[i + 1], lines[i + 2]
        if head and not head.startswith("[") and phonetic.startswith("["):
            word = head.split("=")[0].strip()
            word = re.sub(r"\(.*?\)", "", word).strip()
            word = re.split(r"[,，;；/]", word)[0].strip().replace("--", "-").lower()
            if SINGLE_WORD.fullmatch(word) and word not in entries:
                entries[word] = {
                    "word": word,
                    "phonetic": phonetic.strip("[] "),
                    "meaning": clean_text(meaning),
                }
            i += 3
        else:
            i += 1
    return entries


def parse_source(path: Path) -> dict[str, dict]:
    records: dict[str, dict] = {}
    if not path.exists():
        return records
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            word = clean_text(record.get("word")).lower()
            if not SINGLE_WORD.fullmatch(word):
                continue
            if word not in records or (not clean_meaning(records[word]) and clean_meaning(record)):
                records[word] = record
    return records


def exam_meaning(text: str) -> str:
    text = clean_text(text)
    text = re.sub(r"(^|[；;]\s*)a\.\s*", r"\1adj. ", text)
    text = re.sub(r"(^|[；;]\s*)ad\.\s*", r"\1adv. ", text)
    text = re.sub(r"(^|[；;]\s*)vt\.\s*", r"\1v. ", text)
    text = re.sub(r"(^|[；;]\s*)vi\.\s*", r"\1v. ", text)
    return text.strip("；;，, ")


def make_entry(word: str, record: dict, fallback: dict | None = None) -> dict:
    phonetic = clean_phonetic(record) if record else ""
    meaning = clean_meaning(record) if record else ""
    if fallback:
        # The exam syllabus definition is more concise and exam-oriented.
        phonetic = clean_text(fallback.get("phonetic")) or phonetic
        phonetic = phonetic.strip("/[] ").replace("'", "ˈ")
        meaning = exam_meaning(fallback.get("meaning")) or meaning
    example, example_zh = pick_example(record) if record else ("", "")
    entry = {"w": word, "p": phonetic, "m": meaning or "暂无释义"}
    if example:
        entry["e"] = example
        entry["t"] = example_zh
    return entry


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    path.write_text(text + "\n", encoding="utf-8")
    print(f"  {path}  {len(text) / 1024 / 1024:.2f} MB")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", default="data-src")
    parser.add_argument("--out", default="data")
    args = parser.parse_args()

    src = Path(args.src)
    out = Path(args.out)
    core = parse_3500(src / "3500.txt")

    source_files = {
        "gaokao": src / "gaokao.jsonl",
        "ielts": src / "ielts.jsonl",
        "cet4": src / "cet4.jsonl",
        "kaoyan": src / "kaoyan.jsonl",
    }
    parsed = {key: parse_source(path) for key, path in source_files.items()}
    for key, records in parsed.items():
        print(f"{key}: {len(records)} source entries")

    # Extra examples for any core word missing from the high-school file.
    all_records: dict[str, dict] = {}
    for key in ("gaokao", "cet4", "ielts", "kaoyan"):
        for word, record in parsed[key].items():
            all_records.setdefault(word, record)

    book_specs = [
        {
            "id": "gaokao",
            "name": "高考 3500",
            "short": "高考",
            "subtitle": "高中核心词汇",
            "description": "依据高考英语 3500 词整理，含音标、释义与双语例句。",
            "color": "#2f6b50",
            "words": [
                make_entry(word, parsed["gaokao"].get(word) or all_records.get(word), core[word])
                for word in core
            ],
        },
        {
            "id": "ielts",
            "name": "雅思核心",
            "short": "雅思",
            "subtitle": "IELTS 听说读写",
            "description": "雅思常见学术与生活词汇，适合听说读写综合备考。",
            "color": "#b45a35",
            "words": [make_entry(word, record) for word, record in parsed["ielts"].items()],
        },
        {
            "id": "cet4",
            "name": "四级词汇",
            "short": "四级",
            "subtitle": "大学英语四级",
            "description": "大学英语四级常见词汇，兼顾基础与进阶。",
            "color": "#3f5f8a",
            "words": [make_entry(word, record) for word, record in parsed["cet4"].items()],
        },
        {
            "id": "kaoyan",
            "name": "考研词汇",
            "short": "考研",
            "subtitle": "硕士研究生入学",
            "description": "考研英语常见词汇，覆盖阅读与写作高频词。",
            "color": "#70508e",
            "words": [make_entry(word, record) for word, record in parsed["kaoyan"].items()],
        },
    ]

    books_meta = []
    dictionary: dict[str, list[str]] = {}
    # 合并索引：一个词属于哪些词库，用位掩码表示。
    # 1=高考，2=四级，4=雅思，8=考研。前端用它判断“最基础归属”。
    level_bits = {"gaokao": 1, "cet4": 2, "ielts": 4, "kaoyan": 8}
    word_index: dict[str, int] = {}

    for spec in book_specs:
        # Keep source order, drop duplicates and empty definitions.
        seen: set[str] = set()
        words = []
        for entry in spec["words"]:
            word = entry["w"]
            if word in seen or not entry.get("m"):
                continue
            seen.add(word)
            words.append(entry)
        spec["words"] = words
        if not words:
            print(f"skip empty book: {spec['id']}")
            continue
        write_json(out / "books" / f"{spec['id']}.json", {
            "id": spec["id"],
            "name": spec["name"],
            "words": words,
        })
        books_meta.append({
            "id": spec["id"],
            "name": spec["name"],
            "short": spec["short"],
            "subtitle": spec["subtitle"],
            "description": spec["description"],
            "color": spec["color"],
            "count": len(words),
        })
        bit = level_bits.get(spec["id"], 0)
        for entry in words:
            dictionary.setdefault(entry["w"], [entry.get("p", ""), entry["m"]])
            if bit:
                key = entry["w"].lower()
                word_index[key] = word_index.get(key, 0) | bit

    for word, (phonetic, meaning) in FUNCTION_WORDS.items():
        dictionary.setdefault(word, [phonetic, meaning])

    write_json(out / "word-index.json", word_index)
    write_json(out / "dict.json", dictionary)
    write_json(out / "meta.json", {
        "version": date.today().strftime("%Y%m%d"),
        "app": "词听",
        "books": books_meta,
        "dictCount": len(dictionary),
    })
    print(f"done: {sum(b['count'] for b in books_meta)} book entries, {len(dictionary)} dictionary words")


if __name__ == "__main__":
    main()
