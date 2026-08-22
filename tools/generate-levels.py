#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Shake out candidate levels and keep a varied handful.

Screening uses the fast solver, so a candidate costs about a second rather than
the minutes an optimality proof costs. Selection maximises spread across the
measurements rather than ranking by any one of them: a good set of levels
differs from one another, and need not climb.

    generate-levels.py --count 8 --tries 400 --preview sheet.html
"""

import argparse
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from blkaut import DIRS, Level  # noqa: E402

COLORS = ["red", "blue", "green", "yellow"]
SMALL = [((0, 0),), ((0, 0), (1, 0)), ((0, 0), (0, 1))]
CHUNKY = SMALL + [((0, 0), (1, 0), (0, 1), (1, 1)), ((0, 0), (1, 0), (0, 1), (1, 1))]
AXES = ["density", "openings", "shuffles", "branching", "careless", "blocks", "size"]


def pack(rng):
    """One random board: size, crowding, shapes and doors all varied."""
    size = rng.choice([5, 6, 6, 7, 7])
    coverage = rng.uniform(0.45, 0.78)
    shapes = rng.choice([SMALL, CHUNKY, CHUNKY])
    palette = COLORS[: rng.choice([2, 3, 3, 4, 4])]
    walls = set()
    for _ in range(rng.choice([0, 1, 2, 2, 3])):
        walls.add((rng.randrange(size), rng.randrange(size)))

    used = set(walls)
    blocks = []
    target = int(size * size * coverage)
    spots = [(x, y) for y in range(size) for x in range(size)]
    rng.shuffle(spots)
    for (x, y) in spots:
        if len(used) - len(walls) >= target:
            break
        if (x, y) in used:
            continue
        for shape in sorted(shapes, key=lambda s: -len(s)):
            w = max(c[0] for c in shape) + 1
            h = max(c[1] for c in shape) + 1
            if x + w > size or y + h > size:
                continue
            cells = {(x + ox, y + oy) for ox, oy in shape}
            if cells & used:
                continue
            used |= cells
            blocks.append({"id": "", "color": None, "x": x, "y": y,
                           "cells": [list(c) for c in shape]})
            break
    if len(blocks) < 5:
        return None

    rng.shuffle(blocks)
    for i, block in enumerate(blocks):
        block["color"] = palette[i % len(palette)]
    for i, block in enumerate(blocks):
        block["id"] = f"{block['color'][0]}{i}"

    # a colour's doors have to be wide enough for its widest block, or those
    # blocks can never leave and the level is dead on arrival
    doors = []
    for color in palette:
        mine = [b for b in blocks if b["color"] == color]
        span = max(max(max(c[0] for c in b["cells"]), max(c[1] for c in b["cells"])) + 1
                   for b in mine)
        for _ in range(rng.choice([1, 1, 1, 2])):
            width = max(span, rng.choice([1, 2]))
            if width > size:
                continue
            for _ in range(12):
                side = rng.choice(["top", "right", "bottom", "left"])
                start = rng.randrange(size - width + 1)
                span = set(range(start, start + width))
                clash = any(
                    d["side"] == side and span & set(range(d["from"], d["to"] + 1))
                    for d in doors
                )
                if clash:
                    continue  # two doors on the same wall squares read as one
                doors.append({"side": side, "from": start, "to": start + width - 1,
                              "color": color})
                break
    return {"width": size, "height": size, "walls": [list(w) for w in walls],
            "doors": doors, "blocks": blocks}


def spread(candidates, count):
    """Pick the set whose measurements sit furthest apart."""
    if len(candidates) <= count:
        return candidates
    ranges = {}
    for axis in AXES:
        values = [c["stats"][axis] for c in candidates]
        low, high = min(values), max(values)
        ranges[axis] = (low, (high - low) or 1)

    def place(candidate):
        return [
            (candidate["stats"][axis] - ranges[axis][0]) / ranges[axis][1]
            for axis in AXES
        ]

    def apart(a, b):
        return sum((p - q) ** 2 for p, q in zip(a, b))

    points = {id(c): place(c) for c in candidates}
    picked = [max(candidates, key=lambda c: c["stats"]["shuffles"])]
    while len(picked) < count:
        nxt = max(
            (c for c in candidates if c not in picked),
            key=lambda c: min(apart(points[id(c)], points[id(p)]) for p in picked),
        )
        picked.append(nxt)
    return picked


PREVIEW_HEAD = """<meta charset="utf-8"><title>level candidates</title><style>
:root { --red:#e8564f; --blue:#3d8bf2; --green:#35b87c; --yellow:#edad2b; }
body { background:#12141a; color:#e6e9f0; font:13px ui-sans-serif,system-ui,sans-serif;
  display:flex; flex-wrap:wrap; gap:22px; padding:22px; margin:0; }
.card { width:300px; }
.board { position:relative; background:#2b3140; border-radius:10px; padding:10px; }
.field { position:relative; background:#191d26; }
.cell { position:absolute; border-radius:4px; }
.wall { background:repeating-linear-gradient(45deg,#4d5670 0 6px,#394154 6px 12px); }
.door { position:absolute; border-radius:2px; }
.stats { color:#8d97ad; margin-top:8px; line-height:1.6; font-variant-numeric:tabular-nums; }
b { color:#e6e9f0; }
</style>"""


def preview(cards, path):
    cell = 34
    out = [PREVIEW_HEAD]
    for n, card in enumerate(cards, 1):
        level, stats = card["level"], card["stats"]
        side = level["width"] * cell
        out.append(f'<div class="card"><div class="board" style="width:{side + 20}px">')
        out.append(f'<div class="field" style="width:{side}px;height:{side}px">')
        for x, y in level["walls"]:
            out.append(f'<div class="cell wall" style="left:{x * cell}px;top:{y * cell}px;'
                       f'width:{cell}px;height:{cell}px"></div>')
        for b in level["blocks"]:
            w = (max(c[0] for c in b["cells"]) + 1) * cell - 3
            h = (max(c[1] for c in b["cells"]) + 1) * cell - 3
            out.append(f'<div class="cell" style="left:{b["x"] * cell + 1}px;'
                       f'top:{b["y"] * cell + 1}px;width:{w}px;height:{h}px;'
                       f'background:var(--{b["color"]})"></div>')
        for d in level["doors"]:
            length = (d["to"] - d["from"] + 1) * cell - 6
            start = d["from"] * cell + 3
            if d["side"] in ("top", "bottom"):
                style = (f'left:{start}px;width:{length}px;height:5px;'
                         f'{d["side"]}:-8px')
            else:
                style = (f'top:{start}px;height:{length}px;width:5px;'
                         f'{d["side"]}:-8px')
            out.append(f'<div class="door" style="{style};background:var(--{d["color"]})"></div>')
        out.append("</div></div><div class=\"stats\">")
        out.append(f'<b>#{n}</b> {level["width"]}x{level["width"]}, '
                   f'{stats["blocks"]} blocks, {stats["colors"]} colours<br>')
        out.append(f'par <b>{stats["par"]}</b> &middot; shuffles <b>{stats["shuffles"]}</b> '
                   f'&middot; density <b>{stats["density"]}</b><br>')
        out.append(f'careless play clears <b>{int(stats["careless"] * 100)}%</b> '
                   f'&middot; branching <b>{stats["branching"]}</b> '
                   f'&middot; free exits <b>{stats["openings"]}</b>')
        out.append("</div></div>")
    path.write_text("\n".join(out))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=8)
    parser.add_argument("--tries", type=int, default=300)
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--out", type=Path, default=Path("candidates.json"))
    parser.add_argument("--preview", type=Path)
    parser.add_argument("--max-openings", type=int, default=2)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    kept = []
    for n in range(args.tries):
        data = pack(rng)
        if data is None:
            continue
        level = Level(data)
        taken = level.occupied(level.start)
        openings = sum(
            1 for i, p in enumerate(level.start)
            if any(level.exits(i, p[0], p[1], d, taken) for d in DIRS)
        )
        if openings > args.max_openings:
            continue
        stats = level.measure()
        if stats is None:
            continue
        kept.append({"level": data, "stats": stats})
        if len(kept) % 10 == 0:
            print(f"  {len(kept)} playable of {n + 1} tried", flush=True)

    print(f"{len(kept)} playable of {args.tries} tried")
    chosen = spread(kept, args.count)
    args.out.write_text(json.dumps(chosen, indent=1))
    if args.preview:
        preview(chosen, args.preview)
        print(f"preview: {args.preview}")
    for n, card in enumerate(chosen, 1):
        s = card["stats"]
        print(f"  #{n}: {s['size']}x{s['size']} {s['blocks']} blocks, par {s['par']}, "
              f"+{s['shuffles']} shuffles, density {s['density']}, "
              f"careless {s['careless']}, branching {s['branching']}")


if __name__ == "__main__":
    sys.exit(main())
