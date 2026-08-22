#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Smoke test for the level tools, which nothing else exercises.

A broken generator is invisible to the game's own tests, so this runs a small
batch and checks the levels it produces are ones the game could actually load.
"""

import subprocess
import sys
import tempfile
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from blkaut import Level, load_level  # noqa: E402

failures = []


def check(condition, description):
    if not condition:
        failures.append(description)


with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "candidates.json"
    sheet = Path(tmp) / "sheet.html"
    run = subprocess.run(
        [str(ROOT / "tools/generate-levels.py"), "--count", "4", "--tries", "40",
         "--seed", "5", "--out", str(out), "--preview", str(sheet)],
        capture_output=True, text=True,
    )
    check(run.returncode == 0, f"generator failed: {run.stderr.strip()[-300:]}")
    if run.returncode == 0:
        cards = json.loads(out.read_text())
        check(len(cards) > 0, "generator produced no candidates")
        check(sheet.exists() and sheet.stat().st_size > 0, "preview sheet is empty")
        for n, card in enumerate(cards, 1):
            data = card["level"]
            claimed = {}
            for door in data["doors"]:
                for at in range(door["from"], door["to"] + 1):
                    held = claimed.setdefault((door["side"], at), door["color"])
                    check(held == door["color"],
                          f"candidate {n}: {held} and {door['color']} doors share a square")
            colours = {b["color"] for b in data["blocks"]}
            for colour in colours:
                check(any(d["color"] == colour for d in data["doors"]),
                      f"candidate {n}: {colour} blocks have no door at all")
            level = Level(data)
            solution, _, _ = level.solve_best(allow_exact=False)
            check(isinstance(solution, list), f"candidate {n} does not solve")

# the difficulty filter has to actually bite
with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "hard.json"
    run = subprocess.run(
        [str(ROOT / "tools/generate-levels.py"), "--count", "2", "--tries", "40",
         "--seed", "21", "--min-shuffles", "2", "--out", str(out)],
        capture_output=True, text=True,
    )
    check(run.returncode == 0, f"filtered run failed: {run.stderr.strip()[-300:]}")
    if run.returncode == 0 and out.exists():
        for n, card in enumerate(json.loads(out.read_text()), 1):
            check(card["stats"]["shuffles"] >= 2,
                  f"--min-shuffles 2 let through a candidate with {card['stats']['shuffles']}")

# the shipped levels must agree with what is recorded for them
for path in sorted(ROOT.glob("levels/level-*.js")):
    data = load_level(path)
    recorded = len([
        line for line in
        path.with_suffix(".solution.txt").read_text().splitlines()
        if line.strip()[:1].isdigit()
    ])
    check(data["par"] == recorded,
          f"{path.name}: par {data['par']} but the solution file has {recorded} moves")

if failures:
    for failure in failures:
        print("FAIL  " + failure)
    sys.exit(1)
print("pass: generator produces loadable levels, shipped levels match their solutions")
