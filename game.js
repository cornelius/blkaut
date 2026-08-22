"use strict";

/* Presentation and input. All legality questions go to Rules. */

(function () {
  const level = LEVEL_01;
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
  };

  let state = null;
  let elements = new Map();
  let history = [];
  let moves = 0;
  let cell = 64;

  /* rendering ------------------------------------------------------------ */

  function place(block, offsetX, offsetY) {
    const px = (block.x + (offsetX || 0)) * cell;
    const py = (block.y + (offsetY || 0)) * cell;
    elements.get(block.id).style.transform = "translate(" + px + "px," + py + "px)";
  }

  function buildBoard() {
    field.textContent = "";
    elements = new Map();
    board.style.setProperty("--cols", level.width);
    board.style.setProperty("--rows", level.height);
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
      el.addEventListener("pointerdown", (event) => beginDrag(event, block));
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
  }

  /* interaction ---------------------------------------------------------- */

  let drag = null;

  function beginDrag(event, block) {
    if (!block.alive || drag) return;
    event.preventDefault();
    const el = elements.get(block.id);
    drag = {
      block,
      el,
      startX: event.clientX,
      startY: event.clientY,
      axis: null,
      offset: 0,
      reach: Rules.reach(state, block),
    };
    el.classList.add("dragging");
    el.classList.remove("settling");
    try { el.setPointerCapture(event.pointerId); } catch (_) { /* no live pointer */ }
    el.addEventListener("pointermove", onDrag);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
  }

  function onDrag(event) {
    if (!drag) return;
    const dx = (event.clientX - drag.startX) / cell;
    const dy = (event.clientY - drag.startY) / cell;
    if (!drag.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 0.12) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    const raw = drag.axis === "x" ? dx : dy;
    const dir = drag.axis === "x"
      ? (raw >= 0 ? "right" : "left")
      : (raw >= 0 ? "down" : "up");
    const ahead = drag.reach[dir];
    // A little give past the last cell, so a drag into a matching door reads as
    // a push through it rather than a dead stop.
    const limit = ahead.max + (ahead.exit ? 0.85 : 0.12);
    const magnitude = Math.min(Math.abs(raw), limit);
    drag.offset = raw >= 0 ? magnitude : -magnitude;
    place(drag.block, drag.axis === "x" ? drag.offset : 0, drag.axis === "y" ? drag.offset : 0);
  }

  function endDrag(event) {
    if (!drag) return;
    const { block, el, axis, offset, reach } = drag;
    el.classList.remove("dragging");
    el.removeEventListener("pointermove", onDrag);
    el.removeEventListener("pointerup", endDrag);
    el.removeEventListener("pointercancel", endDrag);
    try {
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    } catch (_) { /* no live pointer */ }
    drag = null;
    if (!axis) return;

    const dir = axis === "x"
      ? (offset >= 0 ? "right" : "left")
      : (offset >= 0 ? "down" : "up");
    const ahead = reach[dir];
    const travelled = Math.abs(offset);
    el.classList.add("settling");

    if (ahead.exit && travelled > ahead.max + 0.45) {
      snapshot();
      leave(block, dir, ahead.max);
      return;
    }
    const steps = Math.min(Math.round(travelled), ahead.max);
    if (steps === 0) {
      place(block);
      return;
    }
    snapshot();
    Rules.apply(state, block, dir, steps);
    place(block);
    commit();
  }

  function leave(block, dir, max) {
    const [dx, dy] = Rules.DIRS[dir];
    const depth = max + Rules.extent(block, Rules.AXIS_OF[dir]) + 0.6;
    const el = elements.get(block.id);
    block.alive = false;
    el.classList.add("leaving");
    place(block, dx * depth, dy * depth);
    el.addEventListener("transitionend", () => el.remove(), { once: true });
    commit();
  }

  /* history and lifecycle ------------------------------------------------ */

  function snapshot() {
    history.push({
      moves,
      blocks: state.blocks.map((b) => ({ x: b.x, y: b.y, alive: b.alive })),
    });
  }

  function commit() {
    moves += 1;
    refreshHud();
    if (Rules.solved(state)) {
      hud.wonMoves.textContent = moves;
      hud.wonBest.textContent = level.minMoves;
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
        el.classList.remove("leaving");
        if (!el.isConnected) field.appendChild(el);
      }
      place(block);
    });
    hud.won.hidden = true;
    refreshHud();
  }

  function start() {
    state = Rules.create(level);
    history = [];
    moves = 0;
    hud.won.hidden = true;
    buildBoard();
    refreshHud();
  }

  hud.undo.addEventListener("click", undo);
  hud.reset.addEventListener("click", start);
  hud.again.addEventListener("click", start);
  window.addEventListener("keydown", (event) => {
    if (event.key === "z" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      undo();
    } else if (event.key === "r") {
      start();
    }
  });

  start();
})();
