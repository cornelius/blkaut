#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Rewrite the three places that list the levels, from what is in app/levels/.

Adding a level should be writing one file, not remembering three edits.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"


def names():
    found = sorted(APP.glob("levels/level-*.js"))
    return [p.stem for p in found]


def swap(path, opener, closer, body):
    text = path.read_text()
    pattern = re.compile(re.escape(opener) + r".*?" + re.escape(closer), re.S)
    if not pattern.search(text):
        sys.exit(f"{path}: no {opener} ... {closer} block to fill in")
    path.write_text(pattern.sub(opener + "\n" + body + "\n" + closer, text))


def main():
    levels = names()
    if not levels:
        sys.exit("no levels found")
    constant = [f"LEVEL_{n.split('-')[1]}" for n in levels]

    swap(APP / "index.html", "<!-- levels -->", "<!-- /levels -->",
         "\n".join(f'<script src="levels/{n}.js"></script>' for n in levels))
    swap(APP / "game.js", "/* levels */", "/* /levels */",
         "  const LEVELS = [" + ", ".join(constant) + "];")
    swap(ROOT / "tools/replay-test.js", "/* levels */", "/* /levels */",
         "const LEVELS = [" + ", ".join(f'"{n}"' for n in levels) + "];")
    print(f"registered {len(levels)} levels: {', '.join(levels)}")


if __name__ == "__main__":
    main()
