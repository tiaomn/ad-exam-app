#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the self-contained www/index.html from src/index.template.html."""
from __future__ import annotations

import base64
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "src" / "index.template.html"
QUESTIONS = ROOT / "src" / "questions.json"
DINO = ROOT / "www" / "assets" / "dino.webp"
OUT = ROOT / "www" / "index.html"
SINGLE = ROOT / "广告设计师三级-离线刷题.html"


def main() -> None:
    if not TEMPLATE.exists():
        raise SystemExit(f"缺少模板：{TEMPLATE}")
    if not QUESTIONS.exists():
        raise SystemExit(f"缺少题库：{QUESTIONS}")
    if not DINO.exists():
        raise SystemExit(f"缺少恐龙图片：{DINO}\n请先运行 python tools/generate_icons.py")

    questions = json.loads(QUESTIONS.read_text("utf8"))
    # JSON is valid JavaScript. Escape '<' so a question can never close the script tag.
    db_js = json.dumps(questions, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    dino_uri = "data:image/webp;base64," + base64.b64encode(DINO.read_bytes()).decode("ascii")

    build_date = date.today().isoformat()
    html = TEMPLATE.read_text("utf8")
    html = html.replace("__QUESTION_DB__", db_js)
    html = html.replace("__DINO_URI__", dino_uri)
    html = html.replace("__BUILD_DATE__", build_date)
    OUT.write_text(html, "utf8")

    # A truly single-file copy: drop PWA-only links so it works when opened
    # directly from a phone/computer without the www folder next to it.
    standalone = html
    for link in (
        '<link rel="manifest" href="./manifest.webmanifest">',
        '<link rel="apple-touch-icon" href="./assets/apple-touch-icon.png">',
        '<link rel="icon" href="./assets/favicon.png" type="image/png">',
    ):
        standalone = standalone.replace(link, "")
    SINGLE.write_text(standalone, "utf8")

    sw_path = ROOT / "www" / "sw.js"
    if sw_path.exists():
        sw = sw_path.read_text("utf8").replace("__BUILD_DATE__", build_date)
        sw_path.write_text(sw, "utf8")

    print(f"Built {OUT} ({len(html.encode('utf-8')) / 1024:.1f} KB, {len(questions)} questions)")


if __name__ == "__main__":
    main()
