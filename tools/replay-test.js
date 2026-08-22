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

function loadSolution(file) {
  return fs
    .readFileSync(path.join(root, file), "utf8")
    .split("\n")
    .map((line) => line.match(/^\s*\d+\.\s+(\w+)\s+(\w+)\s+(\w+)\s*$/))
    .filter(Boolean)
    .map(([, id, dir, amount]) => ({ id, dir, amount }));
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
solution.forEach((move, index) => {
  const step = index + 1;
  const block = state.blocks.find((b) => b.id === move.id);
  check(block && block.alive, `move ${step}: ${move.id} is not on the board`);
  if (!block || !block.alive) return;
  const ahead = Rules.reach(state, block)[move.dir];
  if (move.amount === "out") {
    check(ahead.exit, `move ${step}: ${move.id} cannot leave ${move.dir}`);
    block.alive = false;
  } else {
    const steps = Number(move.amount);
    check(
      steps >= 1 && steps <= ahead.max,
      `move ${step}: ${move.id} cannot go ${move.dir} ${steps} (limit ${ahead.max})`
    );
    Rules.apply(state, block, move.dir, steps);
  }
});
check(Rules.solved(state), "replaying the solution did not clear the board");

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
console.log(`pass: ${solution.length} solution moves replayed, board cleared, 4 door rules held`);
