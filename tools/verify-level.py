#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Prove a level is solvable and report the shortest solution.

Implements the same rules as game.js: rigid blocks slide along a row or column
as far as the path is clear, and leave the board through a same-coloured door
whose span covers every cell crossing the wall. Exit is atomic, so a position
with only some cells off the board is never a resting state.
"""

import heapq
import json
import re
import sys
from itertools import count
from pathlib import Path

DIRS = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}


def load_level(path):
    text = path.read_text()
    match = re.search(r"=\s*(\{.*\})\s*;", text, re.S)
    if not match:
        sys.exit(f"no level object found in {path}")
    return json.loads(match.group(1))


class Level:
    def __init__(self, data):
        self.width = data["width"]
        self.height = data["height"]
        self.walls = {tuple(c) for c in data["walls"]}
        self.blocks = data["blocks"]
        self.cells = [tuple(tuple(c) for c in b["cells"]) for b in self.blocks]
        self.colors = [b["color"] for b in self.blocks]
        self.start = tuple((b["x"], b["y"]) for b in self.blocks)
        # door spans keyed by (side, color) -> set of positions along that wall
        self.doors = {}
        for d in data["doors"]:
            span = self.doors.setdefault((d["side"], d["color"]), set())
            span.update(range(d["from"], d["to"] + 1))

    def door_allows(self, side, color, pos):
        return pos in self.doors.get((side, color), ())

    def occupied(self, state):
        taken = {}
        for i, pos in enumerate(state):
            if pos is None:
                continue
            for ox, oy in self.cells[i]:
                taken[(pos[0] + ox, pos[1] + oy)] = i
        return taken

    def step_ok(self, index, x, y, dx, dy, taken):
        """One cell of movement for block `index` placed at (x, y)."""
        color = self.colors[index]
        for ox, oy in self.cells[index]:
            cx, cy = x + ox + dx, y + oy + dy
            inside_x = 0 <= cx < self.width
            inside_y = 0 <= cy < self.height
            if inside_x and inside_y:
                if (cx, cy) in self.walls:
                    return False
                other = taken.get((cx, cy))
                if other is not None and other != index:
                    return False
                continue
            # leaving the board: only straight through the wall we move toward,
            # never diagonally past a corner, and only via a matching door
            if dy < 0 and cy < 0 and inside_x:
                if not self.door_allows("top", color, cx):
                    return False
            elif dy > 0 and cy >= self.height and inside_x:
                if not self.door_allows("bottom", color, cx):
                    return False
            elif dx < 0 and cx < 0 and inside_y:
                if not self.door_allows("left", color, cy):
                    return False
            elif dx > 0 and cx >= self.width and inside_y:
                if not self.door_allows("right", color, cy):
                    return False
            else:
                return False
        return True

    def moves(self, state):
        """Every resting state reachable in one drag, as (label, next_state)."""
        taken = self.occupied(state)
        for i, pos in enumerate(state):
            if pos is None:
                continue
            for name, (dx, dy) in DIRS.items():
                x, y = pos
                distance = 0
                while self.step_ok(i, x, y, dx, dy, taken):
                    x, y = x + dx, y + dy
                    distance += 1
                    outside = [
                        not (0 <= x + ox < self.width and 0 <= y + oy < self.height)
                        for ox, oy in self.cells[i]
                    ]
                    nxt = list(state)
                    if all(outside):
                        nxt[i] = None
                        yield (f"{self.blocks[i]['id']} {name} out", tuple(nxt))
                        break
                    if any(outside):
                        continue  # mid-exit, not a place the block may rest
                    nxt[i] = (x, y)
                    yield (f"{self.blocks[i]['id']} {name} {distance}", tuple(nxt))

    def exit_sides(self, index):
        """Sides this block could ever leave by, given only its own shape."""
        sides = []
        color = self.colors[index]
        for side in ("top", "bottom", "left", "right"):
            span = self.doors.get((side, color))
            if not span:
                continue
            axis = 0 if side in ("top", "bottom") else 1
            width = max(c[axis] for c in self.cells[index]) + 1
            if any(all(s + k in span for k in range(width)) for s in span):
                sides.append((side, axis))
        return sides

    def lower_bound(self, index, pos):
        """Fewest drags this block alone could need, ignoring every other block."""
        for side, axis in self.exit_sides(index):
            span = self.doors[(side, self.colors[index])]
            profile = {pos[axis] + c[axis] for c in self.cells[index]}
            if profile <= span:
                return 1
        return 2

    def heuristic(self, state):
        return sum(
            self.lower_bound(i, pos) for i, pos in enumerate(state) if pos is not None
        )

    def solve(self, cap=3_000_000):
        tie = count()
        start = self.start
        seen = {start: None}
        best = {start: 0}
        heap = [(self.heuristic(start), next(tie), 0, start)]
        explored = 0
        while heap:
            _, _, cost, state = heapq.heappop(heap)
            if cost > best.get(state, cost):
                continue
            explored += 1
            if explored > cap:
                return None, explored
            if all(pos is None for pos in state):
                path = []
                while seen[state] is not None:
                    label, state = seen[state]
                    path.append(label)
                return list(reversed(path)), explored
            for label, nxt in self.moves(state):
                if cost + 1 < best.get(nxt, 1 << 30):
                    best[nxt] = cost + 1
                    seen[nxt] = (label, state)
                    heapq.heappush(heap, (cost + 1 + self.heuristic(nxt), next(tie), cost + 1, nxt))
        return None, explored


def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "levels/level-01.js")
    level = Level(load_level(path))
    solution, explored = level.solve()
    print(f"{path.name}: {len(level.blocks)} blocks, {explored} states explored")
    if solution is None:
        print("UNSOLVABLE")
        return 1
    print(f"shortest solution: {len(solution)} moves")
    for n, label in enumerate(solution, 1):
        print(f"  {n:2}. {label}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
