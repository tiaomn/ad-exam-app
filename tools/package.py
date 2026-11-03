#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Create a clean distributable ZIP (no browser profiles or dev test scripts)."""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT.parent / "release"
STAGE = RELEASE / "ad-exam-app"
ZIP = RELEASE / "ad-exam-app.zip"

DEV_ONLY = {
    "cdp-e2e.mjs",
    "cdp-extra.mjs",
    "cdp-layout.mjs",
    "cdp-preview.mjs",
    "test-logic.mjs",
    "analyze-db.mjs",
    "_check.js",
}


def ignore(directory: str, names: list[str]) -> set[str]:
    ignored = set()
    at_root = Path(directory).resolve() == ROOT
    for name in names:
        if at_root and name in {".chrome", ".chrome-cdp", ".browser", ".browser2", "node_modules", "android", "ios"}:
            ignored.add(name)
        elif name == "__pycache__":
            ignored.add(name)
        if name.endswith(".pyc") or name == ".DS_Store":
            ignored.add(name)
    return ignored


def main() -> None:
    if STAGE.exists():
        shutil.rmtree(STAGE)
    RELEASE.mkdir(parents=True, exist_ok=True)
    shutil.copytree(ROOT, STAGE, ignore=ignore)

    tools = STAGE / "tools"
    for filename in DEV_ONLY:
        path = tools / filename
        if path.exists():
            path.unlink()

    if ZIP.exists():
        ZIP.unlink()
    shutil.make_archive(str(ZIP.with_suffix("")), "zip", root_dir=RELEASE, base_dir="ad-exam-app")
    print(f"ZIP: {ZIP} ({ZIP.stat().st_size / 1024 / 1024:.1f} MB)")
    print(f"STAGE: {STAGE}")


if __name__ == "__main__":
    main()
