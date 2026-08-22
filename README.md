# Blkaut

A colour-sort block puzzle for the browser. The board is packed with coloured
blocks and the walls carry coloured doors. Pick a block up, steer it through the
free squares, and push it out through a door of its own colour. Clear every
block to finish the level.

Open `index.html` directly in a browser. There is no build step and no
dependency.

## Carrying a block

Clicking a block attaches it to the pointer and it stays attached until you put
it down, whether or not you keep the button held; clicking again drops it, and
Escape returns it to where you picked it up. Press-drag-release works too, for
anyone whose hand does that anyway.

While carried, the block trails the pointer square by square. It can only turn
where it is lined up with the grid, so it edges to the next grid line before
changing axis, which is what lets one gesture run along a row, down a column and
out through a door without stopping. One gesture is one move, however many
corners it turns.

## How a move is judged

A block moves one cell at a time. Each cell it lands on must be empty ground, or
must cross the wall the block is heading for through a door of the block's own
colour. Corners are never a way out, and a door only passes a block whose whole
leading edge fits inside it, so a two-cell-wide block will not fit a one-cell
door. Leaving is atomic: a block never rests half off the board.

## What is here

| File | Contents |
|---|---|
| `index.html` | The page: HUD, board, win overlay. |
| `style.css` | Board, blocks, doors, and the fixed-width HUD slots. |
| `rules.js` | The whole game model. Legality, sliding, and exits, with no DOM. |
| `game.js` | Rendering, carrying, undo, and reset. Asks `rules.js` what is legal. |
| `levels/level-01.js` | The level: board size, walls, doors, blocks, and its shortest solution length. |
| `levels/level-01.solution.txt` | Solver output for that level, replayed by the tests. |
| `tools/verify-level.py` | A* search that proves a level solvable and prints the shortest solution, one line per gesture. |
| `tools/replay-test.js` | Replays the solution through `rules.js` and checks how doors refuse a block. |
| `tools/drag-test.html` | Drives the real page with synthetic pointer events, up to a full playthrough. |
| `tools/run-tests.sh` | Runs both test passes. |

## Working on it

Run the tests with `tools/run-tests.sh`. The drag tests need Chrome; set
`CHROME` if it is not in the usual macOS location.

After changing a level, re-run `tools/verify-level.py levels/<level>.js`, write
its output over the level's `.solution.txt`, and update `minMoves` in the level
to match. The tests fail if those two disagree, which is what keeps the "best
possible" figure on the win screen honest.

A solution line reads `b2 up3 right1 out-right`: one gesture, its legs in order,
and the wall it leaves by. Both test passes replay those legs, the second one as
actual pointer movement.

## Constraints

- **Legality lives in `rules.js` and nowhere else.** `game.js` may position
  things and animate them, but it must never decide for itself whether a move
  is allowed; the tests and the browser have to be judging the same game.
- **A move in the solver is a move in the game.** The search counts gestures
  because the player makes gestures. Changing what one gesture can do means
  changing the search to match, or the level's recorded minimum starts
  measuring a game nobody is playing.
- **Blocks are rendered as rectangles.** The model handles any set of cells,
  but a block is drawn as one bounding box, so a level with an L-shaped piece
  would draw wrongly.
