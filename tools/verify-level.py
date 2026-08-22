#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Solve a level and describe it.

    verify-level.py levels/level-01.js            # a solution, fast
    verify-level.py levels/level-01.js --exact    # prove the shortest one

Fast is the default because proving a minimum costs the entire reachable state
space, and the move count is only one of the things that make a level good.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from blkaut import Level, load_level  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("level", type=Path)
    parser.add_argument("--exact", action="store_true",
                        help="prove the shortest solution instead of finding one")
    parser.add_argument("--quiet", action="store_true", help="skip the measurements")
    args = parser.parse_args()

    level = Level(load_level(args.level))
    solution, explored = (
        level.solve_exact() if args.exact else level.solve_fast()
    )
    kind = "shortest" if args.exact else "par"
    print(f"{args.level.name}: {len(level.blocks)} blocks, {explored} states explored")

    if solution == "capped":
        print("GAVE UP: hit the search cap, so this says nothing either way")
        return 2
    if solution is None:
        print("UNSOLVABLE: the search exhausted every reachable position")
        return 1

    print(f"{kind} solution: {len(solution)} moves")
    for n, label in enumerate(solution, 1):
        print(f"  {n:2}. {label}")

    if not args.quiet:
        stats = level.measure()
        if stats:
            print("measurements:")
            for key in ("density", "openings", "shuffles", "branching", "careless"):
                print(f"  {key:10} {stats[key]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
