"use strict";

/* Presentation and input. All legality questions go to Rules.

   A block is carried, not dragged: pressing it attaches it to the pointer, and
   it stays attached until you put it down, whether or not you keep the button
   held. While carried it trails the pointer square by square, changing axis
   wherever the grid lets it turn, so one gesture can round corners and leave
   through a door. */

(function () {
  const EPS = 1e-9;
  const CLICK_SLOP = 0.35; // cells; a press shorter than this is a click, not a drag

  /* levels */
  const LEVELS = [LEVEL_01, LEVEL_02, LEVEL_03, LEVEL_04];
/* /levels */
  let index = 0;
  let level = LEVELS[0];
  const board = document.getElementById("board");
  const field = document.getElementById("field");
  const hud = {
    level: document.getElementById("hud-level"),
    left: document.getElementById("hud-left"),
    moves: document.getElementById("hud-moves"),
    undo: document.getElementById("undo"),
    reset: document.getElementById("reset"),
    again: document.getElementById("again"),
    won: document.getElementById("won"),
    wonMoves: document.getElementById("won-moves"),
    wonBest: document.getElementById("won-best"),
    prev: document.getElementById("prev"),
    next: document.getElementById("next"),
    onward: document.getElementById("onward"),
  };

  let state = null;
  let elements = new Map();
  let history = [];
  let moves = 0;
  let cell = 64;
  let carry = null;

  /* rendering ------------------------------------------------------------ */

  function place(block, offsetX, offsetY) {
    const px = (block.x + (offsetX || 0)) * cell;
    const py = (block.y + (offsetY || 0)) * cell;
    elements.get(block.id).style.transform = "translate(" + px + "px," + py + "px)";
  }

  function buildBoard() {
    field.textContent = "";
    elements = new Map();
    const root = document.documentElement;
    root.style.setProperty("--cols", level.width);
    root.style.setProperty("--rows", level.height);
    const style = getComputedStyle(board);
    cell = parseFloat(style.getPropertyValue("--cell"));
    const frame = parseFloat(style.getPropertyValue("--frame"));

    for (const [x, y] of level.walls) {
      const el = document.createElement("div");
      el.className = "wall";
      el.style.transform = "translate(" + x * cell + "px," + y * cell + "px)";
      field.appendChild(el);
    }

    for (const door of level.doors) {
      const el = document.createElement("div");
      el.className = "door";
      el.style.setProperty("--door-color", "var(--" + door.color + ")");
      const length = (door.to - door.from + 1) * cell - 12;
      const start = door.from * cell + 6;
      const depth = frame - 6;
      if (door.side === "top" || door.side === "bottom") {
        el.style.width = length + "px";
        el.style.height = depth + "px";
        el.style.left = start + "px";
        el.style[door.side] = 3 - frame + "px";
      } else {
        el.style.height = length + "px";
        el.style.width = depth + "px";
        el.style.top = start + "px";
        el.style[door.side] = 3 - frame + "px";
      }
      field.appendChild(el);
    }

    for (const block of state.blocks) {
      const el = document.createElement("div");
      el.className = "block";
      el.dataset.id = block.id;
      el.style.setProperty("--block-color", "var(--" + block.color + ")");
      el.style.width = Rules.extent(block, "x") * cell - 6 + "px";
      el.style.height = Rules.extent(block, "y") * cell - 6 + "px";
      el.style.margin = "3px";
      elements.set(block.id, el);
      field.appendChild(el);
      place(block);
    }
  }

  function refreshHud() {
    hud.level.textContent = level.name;
    hud.left.textContent = state.blocks.filter((b) => b.alive).length;
    hud.moves.textContent = moves;
    hud.undo.disabled = history.length === 0;
    hud.prev.disabled = index === 0;
    hud.next.disabled = index === LEVELS.length - 1;
  }

  /* carrying a block ----------------------------------------------------- */

  function pointerCells(event) {
    const rect = carry.rect;
    return {
      x: (event.clientX - rect.left) / cell - carry.grabX,
      y: (event.clientY - rect.top) / cell - carry.grabY,
    };
  }

  function relimit() {
    carry.limits = Rules.limitsAt(
      state, carry.block, carry.block.x, carry.block.y, Rules.occupancy(state)
    );
  }

  // Move along one axis, no further than the pointer wants, the corridor
  // allows, or the next grid line -- stopping there is what lets the block
  // consider turning at every square it passes.
  function tryAxis(axis, target) {
    const c = carry;
    const current = axis === "x" ? c.fx : c.fy;
    const wanted = axis === "x" ? target.x : target.y;
    const limit = c.limits[axis];
    const low = limit.outMin === null ? limit.min : limit.outMin;
    const high = limit.outMax === null ? limit.max : limit.outMax;

    // With no pull left on this axis, the block still edges to the nearest
    // grid line, because it cannot turn off a square it is only halfway onto.
    let goal = Math.abs(wanted - current) > EPS ? wanted : Math.round(current);
    goal = Math.min(Math.max(goal, low), high);
    const delta = goal - current;
    if (Math.abs(delta) < 1e-6) return false;

    const gridline = delta > 0
      ? Math.floor(current + 1e-9) + 1
      : Math.ceil(current - 1e-9) - 1;
    const next = delta > 0 ? Math.min(goal, gridline) : Math.max(goal, gridline);
    if (axis === "x") c.fx = next; else c.fy = next;
    if (next < limit.min - EPS || next > limit.max + EPS) c.leaving = true;
    return true;
  }

  function advance(target) {
    const c = carry;
    for (let guard = 0; guard < 400; guard++) {
      const alignedX = Math.abs(c.fx - Math.round(c.fx)) < 1e-9;
      const alignedY = Math.abs(c.fy - Math.round(c.fy)) < 1e-9;

      if (alignedX && alignedY && !c.leaving) {
        c.fx = Math.round(c.fx);
        c.fy = Math.round(c.fy);
        if (c.block.x !== c.fx || c.block.y !== c.fy || !c.limits) {
          c.block.x = c.fx;
          c.block.y = c.fy;
          relimit();
        }
      }

      if (!alignedX) {
        if (!tryAxis("x", target)) break;
      } else if (!alignedY) {
        if (!tryAxis("y", target)) break;
      } else {
        const pullX = Math.abs(target.x - c.fx);
        const pullY = Math.abs(target.y - c.fy);
        if (pullX < 0.002 && pullY < 0.002) break;
        const order = pullX >= pullY ? ["x", "y"] : ["y", "x"];
        if (!tryAxis(order[0], target) && !tryAxis(order[1], target)) break;
      }
      if (c.leaving) break;
    }
  }

  function render() {
    place(carry.block, carry.fx - carry.block.x, carry.fy - carry.block.y);
  }

  // Touching the doorway is enough: nudge a block past the wall by a pixel and
  // it is gone. Nobody parks a block flush inside their own door, so there is
  // nothing here for a bigger threshold to protect.
  function throughDoor() {
    const c = carry;
    if (!c.leaving) return null;
    const bite = 1 / cell;
    const past = [
      ["left", c.limits.x.min - c.fx],
      ["right", c.fx - c.limits.x.max],
      ["up", c.limits.y.min - c.fy],
      ["down", c.fy - c.limits.y.max],
    ];
    for (const [dir, distance] of past) {
      if (distance >= bite) return dir;
    }
    return null;
  }

  function pickUp(event, block) {
    const rect = field.getBoundingClientRect();
    carry = {
      block,
      el: elements.get(block.id),
      rect,
      grabX: (event.clientX - rect.left) / cell - block.x,
      grabY: (event.clientY - rect.top) / cell - block.y,
      fx: block.x,
      fy: block.y,
      fromX: block.x,
      fromY: block.y,
      before: takeSnapshot(),
      limits: null,
      leaving: false,
      sticky: false,
      travel: 0,
    };
    relimit();
    carry.el.classList.add("carrying");
    carry.el.classList.remove("settling");
  }

  function onMove(event) {
    if (!carry) return;
    const target = pointerCells(event);
    const wasX = carry.fx;
    const wasY = carry.fy;
    advance(target);
    carry.travel += Math.abs(carry.fx - wasX) + Math.abs(carry.fy - wasY);
    render();
    const dir = throughDoor();
    if (dir) exitThroughDoor(dir);
  }

  function exitThroughDoor(dir) {
    const c = carry;
    const block = c.block;
    const [dx, dy] = Rules.DIRS[dir];
    const axis = Rules.AXIS_OF[dir];
    const edge = dx + dy > 0 ? c.limits[axis].outMax : c.limits[axis].outMin;
    block.alive = false;
    c.el.classList.remove("carrying");
    c.el.classList.add("leaving");
    const from = c.el.style.transform;
    if (axis === "x") c.fx = edge; else c.fy = edge;
    render();
    // animated rather than transitioned: the class and the transform land in
    // one style pass, which a CSS transition would sit out entirely
    const flight = c.el.animate(
      [{ transform: from, opacity: 1 }, { transform: c.el.style.transform, opacity: 0 }],
      { duration: 220, easing: "ease-in", fill: "forwards" }
    );
    flight.finished.then(() => c.el.remove(), () => {});
    history.push(c.before);
    carry = null;
    commit();
  }

  function putDown() {
    if (!carry) return;
    const c = carry;
    const block = c.block;
    block.x = Math.min(Math.max(Math.round(c.fx), c.limits.x.min), c.limits.x.max);
    block.y = Math.min(Math.max(Math.round(c.fy), c.limits.y.min), c.limits.y.max);
    c.el.classList.remove("carrying");
    c.el.classList.add("settling");
    carry = null;
    place(block);
    if (block.x !== c.fromX || block.y !== c.fromY) {
      history.push(c.before);
      commit();
    }
  }

  function cancelCarry() {
    if (!carry) return;
    const c = carry;
    c.block.x = c.fromX;
    c.block.y = c.fromY;
    c.el.classList.remove("carrying");
    c.el.classList.add("settling");
    carry = null;
    place(c.block);
  }

  // One handler for both halves of the gesture: with nothing in hand a click on
  // a block picks it up, and with a block in hand a click anywhere puts it
  // down. Clicking the carried block is a put-down, not a fresh pick-up.
  window.addEventListener("pointerdown", (event) => {
    const target = event.target;
    const el = target && target.closest ? target.closest(".block") : null;
    const onBoard = el !== null && field.contains(el);

    if (carry) {
      const dropped = carry.block;
      putDown();
      if (onBoard) {
        const next = state.blocks.find((b) => b.id === el.dataset.id);
        if (next && next.alive && next !== dropped) {
          event.preventDefault();
          pickUp(event, next);
        }
      }
      return;
    }
    if (!onBoard) return;
    const block = state.blocks.find((b) => b.id === el.dataset.id);
    if (block && block.alive) {
      event.preventDefault();
      pickUp(event, block);
    }
  });

  window.addEventListener("pointermove", onMove);

  window.addEventListener("pointerup", () => {
    if (!carry) return;
    // released after a real drag: put it down. Released in place: keep
    // carrying, so the rest of the move needs no button held.
    if (carry.travel > CLICK_SLOP) putDown();
    else carry.sticky = true;
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      cancelCarry();
    } else if (event.key === "z" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      cancelCarry();
      undo();
    } else if (event.key === "r") {
      cancelCarry();
      start();
    } else if (event.key === "ArrowLeft" && !carry) {
      start(index - 1);
    } else if (event.key === "ArrowRight" && !carry) {
      start(index + 1);
    }
  });

  /* history and lifecycle ------------------------------------------------ */

  function takeSnapshot() {
    return {
      moves,
      blocks: state.blocks.map((b) => ({ x: b.x, y: b.y, alive: b.alive })),
    };
  }

  function commit() {
    moves += 1;
    refreshHud();
    if (Rules.solved(state)) {
      hud.wonMoves.textContent = moves;
      hud.wonBest.textContent = level.par;
      hud.onward.hidden = index === LEVELS.length - 1;
      hud.won.hidden = false;
    }
  }

  function undo() {
    const past = history.pop();
    if (!past) return;
    moves = past.moves;
    past.blocks.forEach((saved, i) => {
      const block = state.blocks[i];
      const el = elements.get(block.id);
      const revived = saved.alive && !block.alive;
      block.x = saved.x;
      block.y = saved.y;
      block.alive = saved.alive;
      if (revived) {
        el.getAnimations().forEach((a) => a.cancel());
        el.classList.remove("leaving");
        if (!el.isConnected) field.appendChild(el);
      }
      place(block);
    });
    hud.won.hidden = true;
    refreshHud();
  }

  function start(which) {
    if (typeof which === "number") {
      index = Math.min(Math.max(which, 0), LEVELS.length - 1);
      level = LEVELS[index];
    }
    carry = null;
    state = Rules.create(level);
    history = [];
    moves = 0;
    hud.won.hidden = true;
    buildBoard();
    refreshHud();
  }

  hud.undo.addEventListener("click", undo);
  hud.reset.addEventListener("click", () => start());
  hud.again.addEventListener("click", () => start());
  hud.onward.addEventListener("click", () => start(index + 1));
  hud.prev.addEventListener("click", () => start(index - 1));
  hud.next.addEventListener("click", () => start(index + 1));

  start(0);
})();
