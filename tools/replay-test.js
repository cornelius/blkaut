"use strict";

/* Checks every level: that its data is well formed, that the solver's solution
   replays through the engine the browser runs, and that doors refuse a block
   for each of the reasons they are supposed to. Run: node tools/replay-test.js */

const fs = require("fs");
const path = require("path");
const Rules = require("../rules.js");

const root = path.join(__dirname, "..");
const LEVELS = ["level-01", "level-02", "level-03"];
const failures = [];

function check(condition, description) {
  if (condition) return;
  failures.push(description);
}

function loadLevel(name) {
  const source = fs.readFileSync(path.join(root, "levels", name + ".js"), "utf8");
  const binding = source.match(/const\s+(\w+)/)[1];
  return eval(source + ";" + binding);
}

// "  3. b2 up3 right1 out-right" -> one gesture, its legs, and how it ends
function loadSolution(name) {
  return fs
    .readFileSync(path.join(root, "levels", name + ".solution.txt"), "utf8")
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

/* the level data itself is hand-written, so check it holds together -------- */

function inspect(name, level) {
  const seen = new Map();
  const walls = new Set(level.walls.map(([x, y]) => x + "," + y));
  for (const block of level.blocks) {
    for (const [ox, oy] of block.cells) {
      const x = block.x + ox;
      const y = block.y + oy;
      const key = x + "," + y;
      check(
        x >= 0 && x < level.width && y >= 0 && y < level.height,
        `${name}: ${block.id} starts off the board at ${key}`
      );
      check(!walls.has(key), `${name}: ${block.id} starts inside a wall at ${key}`);
      check(!seen.has(key), `${name}: ${block.id} overlaps ${seen.get(key)} at ${key}`);
      seen.set(key, block.id);
    }
  }
  // every block needs a door somewhere that its leading edge actually fits
  const state = Rules.create(level);
  for (const block of state.blocks) {
    const fits = level.doors.some((door) => {
      if (door.color !== block.color) return false;
      const across = Rules.extent(block, door.side === "top" || door.side === "bottom" ? "x" : "y");
      return door.to - door.from + 1 >= across;
    });
    check(fits, `${name}: ${block.id} has no door it can fit through`);
  }
}

/* each level's solution, driven by the shipped rules ---------------------- */

let replayed = 0;
let corners = 0;

for (const name of LEVELS) {
  const level = loadLevel(name);
  const solution = loadSolution(name);
  inspect(name, level);
  check(solution.length > 0, `${name}: solution file has no moves in it`);
  check(
    solution.length === level.minMoves,
    `${name}: minMoves says ${level.minMoves} but the solution is ${solution.length} moves`
  );

  const state = Rules.create(level);
  solution.forEach((move, index) => {
    const step = index + 1;
    const block = state.blocks.find((b) => b.id === move.id);
    check(block && block.alive, `${name} move ${step}: ${move.id} is not on the board`);
    if (!block || !block.alive) return;
    if (move.legs.length > 1) corners += 1;
    for (const leg of move.legs) {
      const ahead = Rules.reach(state, block)[leg.dir];
      check(
        leg.steps >= 1 && leg.steps <= ahead.max,
        `${name} move ${step}: ${move.id} cannot go ${leg.dir} ${leg.steps} (limit ${ahead.max})`
      );
      Rules.apply(state, block, leg.dir, leg.steps);
    }
    if (move.leaving) {
      check(
        Rules.reach(state, block)[move.leaving].exit,
        `${name} move ${step}: ${move.id} cannot leave ${move.leaving}`
      );
      block.alive = false;
    }
  });
  check(Rules.solved(state), `${name}: replaying the solution did not clear the board`);
  replayed += solution.length;

  // a level where every block simply walks out is not a puzzle
  const idle = Rules.create(level);
  const loose = idle.blocks.filter((b) => {
    const ahead = Rules.reach(idle, b);
    return ahead.up.exit || ahead.down.exit || ahead.left.exit || ahead.right.exit;
  });
  check(loose.length < 2, `${name}: ${loose.length} blocks can leave from their opening square`);
  check(
    solution.length > level.blocks.length,
    `${name}: solves in one gesture per block, so nothing has to be shuffled`
  );
}

check(corners > 0, "no move in any solution turns a corner, so nothing tests cornering");

/* a door refuses the wrong colour, the wrong width, and the corner -------- */

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

check(!Rules.reach(probe, byId("wrong-colour")).up.exit, "a blue block left through a red door");
check(!Rules.reach(probe, byId("too-wide")).up.exit, "a two-wide block squeezed through a one-wide door");
check(Rules.reach(probe, byId("corner")).left.exit, "a green block was refused by its own full-height door");
check(!Rules.reach(probe, byId("corner")).down.exit, "a block escaped through a wall with no door in it");

/* ------------------------------------------------------------------------ */

if (failures.length) {
  for (const failure of failures) console.error("FAIL  " + failure);
  process.exit(1);
}
console.log(
  `pass: ${LEVELS.length} levels checked, ${replayed} gestures replayed ` +
    `(${corners} turning corners), 4 door rules held`
);
