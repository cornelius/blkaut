#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Turn a generated candidate into a real level.

    adopt-level.py candidates.json --pick 1 --name Backlot

Writes the level and its solution, then registers it. Par is proven by the
exact search unless that is too slow, in which case it is the best the fast
search found and is labelled as such in the solution file.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from blkaut import Level  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def render(data, ident, name, par):
    lines = [f"const LEVEL_{ident} =", "{",
             f'  "id": "level-{ident}",',
             f'  "name": "{name}",',
             f'  "par": {par},',
             f'  "width": {data["width"]},',
             f'  "height": {data["height"]},',
             '  "walls": ' + json.dumps(data["walls"]) + ",",
             '  "doors": [']
    lines += [
        f'    {{ "side": "{d["side"]}", "from": {d["from"]}, "to": {d["to"]},'
        f' "color": "{d["color"]}" }}' + ("," if n < len(data["doors"]) - 1 else "")
        for n, d in enumerate(data["doors"])
    ]
    lines += ["  ],", '  "blocks": [']
    lines += [
        f'    {{ "id": "{b["id"]}", "color": "{b["color"]}", "x": {b["x"]}, "y": {b["y"]},'
        f' "cells": {json.dumps(b["cells"])} }}' + ("," if n < len(data["blocks"]) - 1 else "")
        for n, b in enumerate(data["blocks"])
    ]
    lines += ["  ]", "}", ";", ""]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("candidates", type=Path)
    parser.add_argument("--pick", type=int, required=True, help="1-based index in the sheet")
    parser.add_argument("--name", required=True)
    parser.add_argument("--fast", action="store_true", help="skip the optimality proof")
    parser.add_argument("--cap", type=int, default=400_000)
    args = parser.parse_args()

    cards = json.loads(args.candidates.read_text())
    data = cards[args.pick - 1]["level"]
    existing = sorted(ROOT.glob("levels/level-*.js"))
    ident = f"{int(existing[-1].stem.split('-')[1]) + 1:02d}" if existing else "01"

    level = Level(data)
    solution, explored = (
        level.solve_fast() if args.fast else level.solve_exact(cap=args.cap)
    )
    proven = not args.fast and isinstance(solution, list)
    if not isinstance(solution, list):
        print(f"exact search {solution} after {explored} states; falling back to fast")
        solution, explored = level.solve_fast()
        proven = False
    if not isinstance(solution, list):
        sys.exit("no solution found; this candidate is not playable")

    (ROOT / f"levels/level-{ident}.js").write_text(
        render(data, ident, args.name, len(solution))
    )
    head = "shortest" if proven else "par"
    body = [f"level-{ident}.js: {len(level.blocks)} blocks, {explored} states explored",
            f"{head} solution: {len(solution)} moves"]
    body += [f"  {n:2}. {label}" for n, label in enumerate(solution, 1)]
    (ROOT / f"levels/level-{ident}.solution.txt").write_text("\n".join(body) + "\n")

    print(f"wrote levels/level-{ident}.js ({args.name}), par {len(solution)}"
          + ("" if proven else " (best found, not proven)"))
    stats = level.measure() or {}
    # measure() screens with the fast solver, so its par is not the one just
    # written; report the real figure rather than two disagreeing numbers
    stats["par"] = len(solution)
    stats["shuffles"] = len(solution) - len(level.blocks)
    for key in ("density", "openings", "par", "shuffles", "branching", "careless", "colors"):
        if key in stats:
            print(f"  {key:10} {stats[key]}")


if __name__ == "__main__":
    main()
