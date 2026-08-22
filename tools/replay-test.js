"use strict";

/* Replays the solver's solution through the engine the browser runs, so the
   Python search and the JavaScript rules have to agree, and checks the three
   ways a door refuses a block. Run: node tools/replay-test.js */

const fs = require("fs");
const path = require("path");
const Rules = require("../rules.js");

const root = path.join(__dirname, "..");
const failures = [];

function check(condition, description) {
  if (condition) return;
  failures.push(description);
}

function loadLevel(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const name = source.match(/const\s+(\w+)/)[1];
  return eval(source + ";" + name);
}

// "  3. b2 up3 right1 out-right" -> one gesture, its legs, and how it ends
function loadSolution(file) {
  return fs
    .readFileSync(path.join(root, file), "utf8")
    .split("\n")
    .map((line) => line.match(/^\s*\d+\.\s+(\S+)\s+(.+?)\s*$/))
    .filter(Boolean)
    .map(([, id, rest]) => {
      const legs = [];
      let leaving = null;
      for (const token of rest.split(/\s+/)) {
        const out = token.match(/^out-(\w+)$/);
        if (out) {
          leaving = out[1];
          continue;
        }
        const leg = token.match(/^([a-z]+)(\d+)$/);
        if (leg) legs.push({ dir: leg[1], steps: Number(leg[2]) });
      }
      return { id, legs, leaving };
    });
}

/* the shipped level, driven by the shipped rules ------------------------- */

const level = loadLevel("levels/level-01.js");
const solution = loadSolution("levels/level-01.solution.txt");
check(solution.length > 0, "solution file has no moves in it");
check(
  solution.length === level.minMoves,
  `level.minMoves says ${level.minMoves} but the solution is ${solution.length} moves`
);

const state = Rules.create(level);
let corners = 0;
solution.forEach((move, index) => {
  const step = index + 1;
  const block = state.blocks.find((b) => b.id === move.id);
  check(block && block.alive, `move ${step}: ${move.id} is not on the board`);
  if (!block || !block.alive) return;
  if (move.legs.length > 1) corners += 1;
  for (const leg of move.legs) {
    const ahead = Rules.reach(state, block)[leg.dir];
    check(
      leg.steps >= 1 && leg.steps <= ahead.max,
      `move ${step}: ${move.id} cannot go ${leg.dir} ${leg.steps} (limit ${ahead.max})`
    );
    Rules.apply(state, block, leg.dir, leg.steps);
  }
  if (move.leaving) {
    check(
      Rules.reach(state, block)[move.leaving].exit,
      `move ${step}: ${move.id} cannot leave ${move.leaving}`
    );
    block.alive = false;
  }
});
check(Rules.solved(state), "replaying the solution did not clear the board");
check(corners > 0, "no move in the solution turns a corner, so nothing tests cornering");

/* the level is not solvable by simply pushing everything at the wall ----- */

const lazy = Rules.create(level);
const freebies = lazy.blocks.filter((b) => Rules.reach(lazy, b).up.exit
  || Rules.reach(lazy, b).down.exit
  || Rules.reach(lazy, b).left.exit
  || Rules.reach(lazy, b).right.exit);
check(
  freebies.length < lazy.blocks.length,
  "every block can leave from its starting square, so the level is not a puzzle"
);

/* a door refuses the wrong colour, the wrong width, and the corner ------- */

const probe = Rules.create({
  width: 3,
  height: 3,
  walls: [],
  doors: [
    { side: "top", from: 0, to: 0, color: "red" },
    { side: "left", from: 0, to: 2, color: "green" },
  ],
  blocks: [
    { id: "wrong-colour", color: "blue", x: 0, y: 0, cells: [[0, 0]] },
    { id: "too-wide", color: "red", x: 1, y: 0, cells: [[0, 0], [1, 0]] },
    { id: "corner", color: "green", x: 0, y: 2, cells: [[0, 0]] },
  ],
});
const byId = (id) => probe.blocks.find((b) => b.id === id);

check(
  !Rules.reach(probe, byId("wrong-colour")).up.exit,
  "a blue block left through a red door"
);
check(
  !Rules.reach(probe, byId("too-wide")).up.exit,
  "a two-wide block squeezed through a one-wide door"
);
check(
  Rules.reach(probe, byId("corner")).left.exit,
  "a green block was refused by its own full-height door"
);
check(
  !Rules.reach(probe, byId("corner")).down.exit,
  "a block escaped through a wall with no door in it"
);

/* ------------------------------------------------------------------------ */

if (failures.length) {
  for (const failure of failures) console.error("FAIL  " + failure);
  process.exit(1);
}
console.log(
  `pass: ${solution.length} gestures replayed (${corners} turning corners), ` +
    "board cleared, 4 door rules held"
);
