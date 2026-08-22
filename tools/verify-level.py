#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Prove a level is solvable and report the shortest solution.

A move is one gesture: the player picks a block up, walks it through the free
squares turning as often as they like, and either puts it down or pushes it out
through a door of its own colour. So a move is any position the block can reach
along a clear path, and the printed legs are that path.
"""

import heapq
import json
import re
import sys
from collections import deque
from itertools import count
from pathlib import Path

DIRS = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}


def load_level(path):
    text = path.read_text()
    match = re.search(r"=\s*(\{.*\})\s*;", text, re.S)
    if not match:
        sys.exit(f"no level object found in {path}")
    return json.loads(match.group(1))


def legs(path):
    """A list of unit directions, compressed into runs."""
    out = []
    for name in path:
        if out and out[-1][0] == name:
            out[-1][1] += 1
        else:
            out.append([name, 1])
    return out


class Level:
    def __init__(self, data):
        self.width = data["width"]
        self.height = data["height"]
        self.walls = {tuple(c) for c in data["walls"]}
        self.blocks = data["blocks"]
        self.cells = [tuple(tuple(c) for c in b["cells"]) for b in self.blocks]
        self.colors = [b["color"] for b in self.blocks]
        self.start = tuple((b["x"], b["y"]) for b in self.blocks)
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

    def inside(self, index, x, y):
        return all(
            0 <= x + ox < self.width and 0 <= y + oy < self.height
            for ox, oy in self.cells[index]
        )

    def exits(self, index, x, y, name, taken):
        """Whether the block can walk right off the board from here."""
        dx, dy = DIRS[name]
        while self.step_ok(index, x, y, dx, dy, taken):
            x, y = x + dx, y + dy
            if not any(
                0 <= x + ox < self.width and 0 <= y + oy < self.height
                for ox, oy in self.cells[index]
            ):
                return True
            if self.inside(index, x, y):
                return False  # back on the board: this was never an exit
        return False

    def moves(self, state):
        """Every state one gesture away, with the path that gesture traces."""
        taken = self.occupied(state)
        for i, pos in enumerate(state):
            if pos is None:
                continue
            paths = {pos: []}
            queue = deque([pos])
            while queue:
                here = queue.popleft()
                x, y = here
                for name, (dx, dy) in DIRS.items():
                    if self.exits(i, x, y, name, taken):
                        nxt = list(state)
                        nxt[i] = None
                        label = self.describe(i, paths[here], name)
                        yield (label, tuple(nxt))
                    step = (x + dx, y + dy)
                    if step in paths or not self.inside(i, *step):
                        continue
                    if not self.step_ok(i, x, y, dx, dy, taken):
                        continue
                    paths[step] = paths[here] + [name]
                    queue.append(step)
            for spot, path in paths.items():
                if not path:
                    continue
                nxt = list(state)
                nxt[i] = spot
                yield (self.describe(i, path, None), tuple(nxt))

    def describe(self, index, path, leaving):
        parts = [f"{name}{n}" for name, n in legs(path)]
        if leaving:
            parts.append(f"out-{leaving}")
        return self.blocks[index]["id"] + " " + " ".join(parts)

    def solve(self, cap=2_000_000):
        tie = count()
        start = self.start
        seen = {start: None}
        best = {start: 0}
        heap = [(sum(p is not None for p in start), next(tie), 0, start)]
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
                    remaining = sum(p is not None for p in nxt)
                    heapq.heappush(heap, (cost + 1 + remaining, next(tie), cost + 1, nxt))
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
