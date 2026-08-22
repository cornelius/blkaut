# Blkaut

A colour-sort block puzzle for the browser. The board is packed with coloured
blocks and the walls carry coloured doors. Drag a block along its row or column
and it slides until something stops it; push it into a door of its own colour
and it leaves the board. Clear every block to finish the level.

Open `index.html` directly in a browser. There is no build step and no
dependency.

## How a move is judged

A block moves one cell at a time. Each cell it lands on must be empty ground,
or must cross the wall the block is heading for through a door of the block's
own colour. Corners are never a way out, and a door only passes a block whose
whole leading edge fits inside it, so a two-cell-wide block will not fit a
one-cell door. Leaving is atomic: a block never rests half off the board.

## What is here

| File | Contents |
|---|---|
| `index.html` | The page: HUD, board, win overlay. |
| `style.css` | Board, blocks, doors, and the fixed-width HUD slots. |
| `rules.js` | The whole game model. Legality, sliding, and exits, with no DOM. |
| `game.js` | Rendering, dragging, undo, and reset. Asks `rules.js` what is legal. |
| `levels/level-01.js` | The level: board size, walls, doors, blocks, and its shortest solution length. |
| `levels/level-01.solution.txt` | Solver output for that level, replayed by the tests. |
| `tools/verify-level.py` | A* search that proves a level solvable and prints the shortest solution. |
| `tools/replay-test.js` | Replays the solution through `rules.js` and checks how doors refuse a block. |
| `tools/drag-test.html` | Drives the real page with synthetic pointer events, up to a full playthrough. |
| `tools/run-tests.sh` | Runs both test passes. |

## Working on it

Run the tests with `tools/run-tests.sh`. The drag tests need Chrome; set
`CHROME` if it is not in the usual macOS location.

After changing a level, re-run `tools/verify-level.py levels/<level>.js`,
write its output over the level's `.solution.txt`, and update `minMoves` in the
level to match. The tests fail if those two disagree, which is what keeps the
"best possible" figure on the win screen honest. The search takes a couple of
minutes on a six-by-six board.

## Constraints

- **Legality lives in `rules.js` and nowhere else.** `game.js` may position
  things and animate them, but it must never decide for itself whether a move
  is allowed; the tests and the browser have to be judging the same game.
- **Blocks are rendered as rectangles.** The model handles any set of cells,
  but a block is drawn as one bounding box, so a level with an L-shaped piece
  would draw wrongly.
