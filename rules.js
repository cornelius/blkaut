"use strict";

/* The whole game, with no DOM in it: the browser drives this and so does the
   replay test, so what ships and what is tested are the same rules. */

var Rules = (function () {
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const AXIS_OF = { up: "y", down: "y", left: "x", right: "x" };

  function create(level) {
    const doors = new Map();
    for (const door of level.doors) {
      const key = door.side + "|" + door.color;
      let span = doors.get(key);
      if (!span) doors.set(key, (span = new Set()));
      for (let i = door.from; i <= door.to; i++) span.add(i);
    }
    return {
      level,
      walls: new Set(level.walls.map(([x, y]) => x + "," + y)),
      doors,
      blocks: level.blocks.map((b) => ({
        id: b.id,
        color: b.color,
        cells: b.cells,
        x: b.x,
        y: b.y,
        alive: true,
      })),
    };
  }

  function extent(block, axis) {
    const index = axis === "x" ? 0 : 1;
    return Math.max(...block.cells.map((c) => c[index])) + 1;
  }

  function doorAllows(state, side, color, pos) {
    const span = state.doors.get(side + "|" + color);
    return span ? span.has(pos) : false;
  }

  function occupancy(state) {
    const taken = new Map();
    for (const block of state.blocks) {
      if (!block.alive) continue;
      for (const [ox, oy] of block.cells) {
        taken.set(block.x + ox + "," + (block.y + oy), block);
      }
    }
    return taken;
  }

  // One cell of movement. A cell may land on free ground, or cross the wall it
  // is heading for through a door of the block's own colour. Corners are never
  // a way out.
  function stepOk(state, block, x, y, dx, dy, taken) {
    const { width, height } = state.level;
    for (const [ox, oy] of block.cells) {
      const cx = x + ox + dx;
      const cy = y + oy + dy;
      const insideX = cx >= 0 && cx < width;
      const insideY = cy >= 0 && cy < height;
      if (insideX && insideY) {
        if (state.walls.has(cx + "," + cy)) return false;
        const other = taken.get(cx + "," + cy);
        if (other && other !== block) return false;
      } else if (dy < 0 && cy < 0 && insideX) {
        if (!doorAllows(state, "top", block.color, cx)) return false;
      } else if (dy > 0 && cy >= height && insideX) {
        if (!doorAllows(state, "bottom", block.color, cx)) return false;
      } else if (dx < 0 && cx < 0 && insideY) {
        if (!doorAllows(state, "left", block.color, cy)) return false;
      } else if (dx > 0 && cx >= width && insideY) {
        if (!doorAllows(state, "right", block.color, cy)) return false;
      } else {
        return false;
      }
    }
    return true;
  }

  // How far this block may travel in one drag, and whether carrying on past
  // that takes it off the board. Exit is atomic: a position with only some
  // cells beyond the wall is never a resting place.
  function slide(state, block, dir, taken) {
    const { width, height } = state.level;
    const [dx, dy] = DIRS[dir];
    let x = block.x;
    let y = block.y;
    let distance = 0;
    let max = 0;
    while (stepOk(state, block, x, y, dx, dy, taken)) {
      x += dx;
      y += dy;
      distance += 1;
      let out = 0;
      for (const [ox, oy] of block.cells) {
        const cx = x + ox;
        const cy = y + oy;
        if (cx < 0 || cx >= width || cy < 0 || cy >= height) out += 1;
      }
      if (out === block.cells.length) return { max, exit: true };
      if (out === 0) max = distance;
    }
    return { max, exit: false };
  }

  function reach(state, block) {
    const taken = occupancy(state);
    return {
      left: slide(state, block, "left", taken),
      right: slide(state, block, "right", taken),
      up: slide(state, block, "up", taken),
      down: slide(state, block, "down", taken),
    };
  }

  function apply(state, block, dir, steps) {
    const [dx, dy] = DIRS[dir];
    block.x += dx * steps;
    block.y += dy * steps;
  }

  function solved(state) {
    return state.blocks.every((b) => !b.alive);
  }

  return { DIRS, AXIS_OF, create, extent, occupancy, stepOk, slide, reach, apply, solved };
})();

if (typeof module !== "undefined") module.exports = Rules;
