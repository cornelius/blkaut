"""The level model, shared by the tools: solving, playing out, measuring.

Two solvers, for two different questions. `solve_fast` answers "does this work
and roughly how long is it", cheaply, and is what screening thousands of
candidates needs. `solve_exact` proves the shortest solution and costs the whole
reachable state space, which is worth paying once for a level being kept.
"""

import heapq
import json
import random
import re
from collections import deque
from itertools import count

DIRS = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}


def load_level(path):
    text = path.read_text()
    match = re.search(r"=\s*(\{.*\})\s*;", text, re.S)
    if not match:
        raise ValueError(f"no level object found in {path}")
    return json.loads(match.group(1))


def legs(path):
    out = []
    for name in path:
        if out and out[-1][0] == name:
            out[-1][1] += 1
        else:
            out.append([name, 1])
    return out


class Level:
    def __init__(self, data):
        self.data = data
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

    # geometry ------------------------------------------------------------

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

    def flush(self, index, x, y, name):
        """Would the next step in this direction take any cell off the board?
        Only from there can a block leave, so it gates the costly walk below."""
        dx, dy = DIRS[name]
        if dx > 0:
            return max(x + ox for ox, _ in self.cells[index]) == self.width - 1
        if dx < 0:
            return min(x + ox for ox, _ in self.cells[index]) == 0
        if dy > 0:
            return max(y + oy for _, oy in self.cells[index]) == self.height - 1
        return min(y + oy for _, oy in self.cells[index]) == 0

    def exits(self, index, x, y, name, taken):
        dx, dy = DIRS[name]
        while self.step_ok(index, x, y, dx, dy, taken):
            x, y = x + dx, y + dy
            if not any(
                0 <= x + ox < self.width and 0 <= y + oy < self.height
                for ox, oy in self.cells[index]
            ):
                return True
            if self.inside(index, x, y):
                return False
        return False

    def moves(self, state, tight=False):
        """Every state one gesture away, as (block, waypoint, exit, state).

        The gesture's actual path is not built here: naming every route while
        searching costs more than the search does, and only the handful of moves
        in a finished solution ever need describing.

        `tight` keeps only the squares a block would come to rest on, having run
        out of room in the direction it arrived from. Parking in open space is
        legal in the game and occasionally matters, but it multiplies the branching
        several times over, so screening leaves it out and the exact search keeps
        it."""
        taken = self.occupied(state)
        for i, pos in enumerate(state):
            if pos is None:
                continue
            reached = {pos}
            queue = deque([pos])
            while queue:
                here = queue.popleft()
                x, y = here
                for name, (dx, dy) in DIRS.items():
                    if self.flush(i, x, y, name) and self.exits(i, x, y, name, taken):
                        nxt = list(state)
                        nxt[i] = None
                        yield (i, here, name, tuple(nxt))
                    step = (x + dx, y + dy)
                    if step in reached or not self.inside(i, *step):
                        continue
                    if not self.step_ok(i, x, y, dx, dy, taken):
                        continue
                    reached.add(step)
                    queue.append(step)
                    if tight and self.step_ok(i, step[0], step[1], dx, dy, taken):
                        continue  # still rolling; it would not stop here
                    nxt = list(state)
                    nxt[i] = step
                    yield (i, step, None, tuple(nxt))

    def route(self, state, index, target):
        """A shortest path for one block, worked out only when it is needed."""
        taken = self.occupied(state)
        start = state[index]
        if start == target:
            return []
        came = {start: None}
        queue = deque([start])
        while queue:
            here = queue.popleft()
            x, y = here
            for name, (dx, dy) in DIRS.items():
                step = (x + dx, y + dy)
                if step in came or not self.inside(index, *step):
                    continue
                if not self.step_ok(index, x, y, dx, dy, taken):
                    continue
                came[step] = (here, name)
                if step == target:
                    path = []
                    at = step
                    while came[at] is not None:
                        at, name = came[at]
                        path.append(name)
                    return list(reversed(path))
                queue.append(step)
        return []

    def label(self, state, index, waypoint, leaving):
        return self.describe(index, self.route(state, index, waypoint), leaving)

    def describe(self, index, path, leaving):
        parts = [f"{name}{n}" for name, n in legs(path)]
        if leaving:
            parts.append(f"out-{leaving}")
        return self.blocks[index]["id"] + " " + " ".join(parts)

    def left(self, state):
        return sum(p is not None for p in state)

    # solving -------------------------------------------------------------

    def _rebuild(self, seen, state):
        steps = []
        while seen[state] is not None:
            index, waypoint, leaving, parent = seen[state]
            steps.append((parent, index, waypoint, leaving))
            state = parent
        return [self.label(*step) for step in reversed(steps)]

    def solve_exact(self, cap=2_000_000):
        """Shortest solution, proven. Returns (solution | None | 'capped', states)."""
        tie = count()
        seen = {self.start: None}
        best = {self.start: 0}
        heap = [(self.left(self.start), next(tie), 0, self.start)]
        explored = 0
        while heap:
            _, _, cost, state = heapq.heappop(heap)
            if cost > best.get(state, cost):
                continue
            explored += 1
            if explored > cap:
                return "capped", explored
            if self.left(state) == 0:
                return self._rebuild(seen, state), explored
            for index, waypoint, leaving, nxt in self.moves(state):
                if cost + 1 < best.get(nxt, 1 << 30):
                    best[nxt] = cost + 1
                    seen[nxt] = (index, waypoint, leaving, state)
                    heapq.heappush(heap, (cost + 1 + self.left(nxt), next(tie), cost + 1, nxt))
        return None, explored

    def solve_fast(self, cap=40_000):
        """A solution, not necessarily the shortest. Greedy best-first, so it
        chases states with fewer blocks left and rarely looks back. Tries the
        reduced move set first and only pays for the full one if that fails."""
        solution, explored = self._greedy(cap // 8, tight=True)
        if isinstance(solution, list):
            return solution, explored
        full, more = self._greedy(cap, tight=False)
        return full, explored + more

    def _greedy(self, cap, tight):
        tie = count()
        seen = {self.start: None}
        heap = [(self.left(self.start), next(tie), self.start)]
        explored = 0
        while heap:
            _, _, state = heapq.heappop(heap)
            explored += 1
            if explored > cap:
                return "capped", explored
            if self.left(state) == 0:
                return self._rebuild(seen, state), explored
            for index, waypoint, leaving, nxt in self.moves(state, tight):
                if nxt not in seen:
                    seen[nxt] = (index, waypoint, leaving, state)
                    heapq.heappush(heap, (self.left(nxt), next(tie), nxt))
        return None, explored

    def solve_best(self, cap=400_000, allow_exact=True):
        """The best solution worth paying for, and whether it is provably best.

        A solution as long as the block count cannot be beaten, because every
        block needs a gesture of its own, so that case is proven without any
        further search."""
        solution, explored = self.solve_fast()
        if not isinstance(solution, list):
            return solution, False, explored
        if len(solution) == len(self.blocks):
            return solution, True, explored
        if allow_exact:
            exact, more = self.solve_exact(cap=cap)
            explored += more
            if isinstance(exact, list):
                return exact, True, explored
        return solution, False, explored

    def playout(self, rng, exit_bias=0.8):
        """Play carelessly: take an exit when one is going, otherwise shove a
        block somewhere. Returns True if the board came out clear."""
        state = self.start
        for _ in range(len(self.blocks) * 6):
            if self.left(state) == 0:
                return True
            options = list(self.moves(state, tight=True))
            if not options:
                return False
            leaving = [o for o in options if o[2] is not None]
            if leaving and rng.random() < exit_bias:
                state = rng.choice(leaving)[3]
            else:
                state = rng.choice(options)[3]
        return self.left(state) == 0

    # measuring -----------------------------------------------------------

    def measure(self, seed=0, playouts=12, cap=4_000):
        """The several numbers that describe a level's character. Move count is
        one of them and on its own says little."""
        # screening only: one pass over the reduced move set, and a candidate
        # that will not fall to it is simply passed over. There are always more.
        solution, explored = self._greedy(cap, tight=True)
        if not isinstance(solution, list):
            return None
        rng = random.Random(seed)
        # stop early once it is clear which way this goes: a level that careless
        # play keeps clearing is easy, and further rounds only cost time
        cleared = 0
        rounds = 0
        for _ in range(playouts):
            rounds += 1
            cleared += 1 if self.playout(rng) else 0
            if rounds >= 5 and cleared in (0, rounds):
                break
        careless = cleared
        taken = self.occupied(self.start)
        openings = sum(
            1 for i, p in enumerate(self.start)
            if any(self.exits(i, p[0], p[1], d, taken) for d in DIRS)
        )
        # how much room there is to think in, averaged over the solution
        state = self.start
        branching = []
        for _ in range(min(8, len(solution))):
            options = list(self.moves(state, tight=True))
            if not options:
                break
            branching.append(len(options))
            state = min(options, key=lambda o: self.left(o[3]))[3]
        filled = sum(len(c) for c in self.cells)
        area = self.width * self.height
        return {
            "blocks": len(self.blocks),
            "size": self.width,
            "par": len(solution),
            "shuffles": len(solution) - len(self.blocks),
            "density": round((filled + len(self.walls)) / area, 3),
            "openings": openings,
            "careless": round(careless / rounds, 3),
            "branching": round(sum(branching) / len(branching), 1),
            "colors": len({b["color"] for b in self.blocks}),
            "states": explored,
        }
