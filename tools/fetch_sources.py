#!/usr/bin/env python3
"""Download the raw word-book sources needed by build_data.py.

The raw files are about 30 MB and are intentionally not committed to the
repository. They are written to data-src/ (git-ignored).

Usage:
  python3 tools/fetch_sources.py
  python3 tools/fetch_sources.py --out ./data-src
"""
from __future__ import annotations

import argparse
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

RAW = "https://raw.githubusercontent.com/KyleBing/english-vocabulary/master/"
SENTENCE = RAW + "full_line_jsonl/sentence/" + urllib.parse.quote("正序") + "/"

SOURCES = [
    # (output name, url, expected bytes)
    ("gaokao.jsonl", SENTENCE + urllib.parse.quote("高中") + ".jsonl", 6428647),
    ("ielts.jsonl", SENTENCE + urllib.parse.quote("雅思") + ".jsonl", 5324365),
    ("cet4.jsonl", SENTENCE + urllib.parse.quote("四级") + ".jsonl", 7403986),
    ("kaoyan.jsonl", SENTENCE + urllib.parse.quote("考研") + ".jsonl", 8627487),
    (
        "3500.txt",
        "https://raw.githubusercontent.com/pluto0x0/word3500/master/3500.txt",
        192481,
    ),
]

USER_AGENT = "citing-word-drill/1.0 (+https://github.com/KyleBing/english-vocabulary)"


def download(url: str, target: Path, expected: int) -> None:
    if target.exists() and target.stat().st_size == expected:
        print(f"  skip {target} (already {expected} bytes)")
        return

    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(target.suffix + ".part")
    for attempt in range(1, 5):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=90) as response:
                total = int(response.headers.get("Content-Length") or expected)
                done = 0
                with partial.open("wb") as handle:
                    while True:
                        chunk = response.read(1024 * 128)
                        if not chunk:
                            break
                        handle.write(chunk)
                        done += len(chunk)
                        if total:
                            pct = done * 100 // total
                            print(f"\r  {target.name}: {pct:3d}%", end="", flush=True)
                print()
            actual = partial.stat().st_size
            if actual != expected:
                raise ValueError(f"size mismatch: got {actual}, expected {expected}")
            partial.replace(target)
            return
        except Exception as error:  # noqa: BLE001 - retry any network error
            print(f"\n  attempt {attempt} failed for {target.name}: {error}")
            partial.unlink(missing_ok=True)
            if attempt < 4:
                time.sleep(2 * attempt)
    raise SystemExit(f"Could not download {url}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="data-src", help="output directory (default: data-src)")
    args = parser.parse_args()
    out = Path(args.out)

    print("Downloading raw sources (about 30 MB) ...")
    for name, url, expected in SOURCES:
        print(f"- {name}")
        download(url, out / name, expected)
    print(f"Done. Sources are in {out.resolve()}")
    print("Next: python3 tools/build_data.py --src data-src --out data")


if __name__ == "__main__":
    sys.exit(main())
