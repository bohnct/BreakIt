// Rules, solver and level generator for "Kelsey Blocked Me In Again!" (a Color Block Jam remake).
//
// Rules: blocks slide around a walled board without overlapping. A block leaves the board when it
// touches a door of its own colour on the wall and every column (or row) of the block fits within
// the door. Layered blocks lose their outer colour at a matching door and stay put as the inner
// colour. Arrow blocks only slide one way. Iced blocks can't move until enough other blocks have left.
//
// Level: { w, h, walls: [cellIndex], doors: [{ side, at, len, colour }], blocks: [Block], difficulty }
// Block: { cells: [[x, y]], x, y, colour, inner, axis: null | 'h' | 'v', ice }
// Colours are palette indexes. Sides: 't' top, 'r' right, 'b' bottom, 'l' left.

const SHAPES = [
  [4, [[0, 0]]],
  [6, [[0, 0], [1, 0]]],
  [4, [[0, 0], [1, 0], [2, 0]]],
  [4, [[0, 0], [1, 0], [0, 1], [1, 1]]],
  [4, [[0, 0], [0, 1], [1, 1]]],
  [3, [[0, 0], [0, 1], [0, 2], [1, 2]]],
  [3, [[0, 0], [1, 0], [2, 0], [1, 1]]],
  [2, [[0, 0], [1, 0], [1, 1], [2, 1]]],
  [1, [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]]],
];
const SHAPE_TOTAL = SHAPES.reduce((a, s) => a + s[0], 0);

export const DIFFICULTIES = ['easy', 'medium', 'hard'];
const TARGET = { easy: 0, medium: 1, hard: 2 };

const rand = k => Math.floor(Math.random() * k);

function randomShape(maxSize = 6) {
  for (;;) {
    let x = Math.random() * SHAPE_TOTAL, cells = SHAPES[0][1];
    for (const [w, c] of SHAPES) {
      x -= w;
      if (x <= 0) { cells = c; break; }
    }
    if (cells.length > maxSize) continue;
    let out = cells.map(([a, b]) => [a, b]);
    if (Math.random() < 0.5) out = out.map(([a, b]) => [-a, b]);
    for (let r = rand(4); r > 0; r--) out = out.map(([a, b]) => [b, -a]);
    const mx = Math.min(...out.map(c => c[0])), my = Math.min(...out.map(c => c[1]));
    return out.map(([a, b]) => [a - mx, b - my]);
  }
}

// --- Board occupancy ------------------------------------------------------

export const FREE = -1, WALL = -2;

export function buildOcc(level, blocks) {
  const occ = new Int16Array(level.w * level.h).fill(FREE);
  for (const i of level.walls) occ[i] = WALL;
  blocks.forEach((b, id) => {
    if (!b.gone) for (const [cx, cy] of b.cells) occ[(b.y + cy) * level.w + b.x + cx] = id;
  });
  return occ;
}

export function fits(level, occ, b, id, x, y) {
  for (const [cx, cy] of b.cells) {
    const px = x + cx, py = y + cy;
    if (px < 0 || py < 0 || px >= level.w || py >= level.h) return false;
    const o = occ[py * level.w + px];
    if (o !== FREE && o !== id) return false;
  }
  return true;
}

export function setOcc(level, occ, b, value) {
  for (const [cx, cy] of b.cells) occ[(b.y + cy) * level.w + b.x + cx] = value;
}

// The door this block would leave through at (x, y) as `colour`, or null.
export function doorAt(level, occ, b, id, x, y, colour) {
  const { w, h } = level;
  for (const d of level.doors) {
    if (d.colour !== colour) continue;
    const vertical = d.side === 't' || d.side === 'b';
    if ((vertical && b.axis === 'h') || (!vertical && b.axis === 'v')) continue;
    // Extreme cell of the block in each lane (column for top/bottom doors, row for left/right).
    const lanes = new Map();
    let touches = false, inside = true;
    for (const [cx, cy] of b.cells) {
      const px = x + cx, py = y + cy;
      const lane = vertical ? px : py;
      if (lane < d.at || lane >= d.at + d.len) { inside = false; break; }
      const depth = d.side === 't' ? py : d.side === 'b' ? h - 1 - py : d.side === 'l' ? px : w - 1 - px;
      if (depth === 0) touches = true;
      if (!lanes.has(lane) || depth < lanes.get(lane)) lanes.set(lane, depth);
    }
    if (!inside || !touches) continue;
    // Cells between the block and the wall must be clear (for shapes like L).
    let clear = true;
    for (const [lane, depth] of lanes) {
      for (let k = 0; k < depth && clear; k++) {
        const px = vertical ? lane : d.side === 'l' ? k : w - 1 - k;
        const py = vertical ? (d.side === 't' ? k : h - 1 - k) : lane;
        const o = occ[py * w + px];
        if (o !== FREE && o !== id) clear = false;
      }
    }
    if (clear) return d;
  }
  return null;
}

const STEPS = { h: [[1, 0], [-1, 0]], v: [[0, 1], [0, -1]], all: [[1, 0], [-1, 0], [0, 1], [0, -1]] };
export const stepsFor = axis => STEPS[axis || 'all'];

// Search the positions a block can slide to as `colour`. Positions that touch one of its doors
// are terminal (a dragged block leaves or peels the moment it touches one), so they are reported
// in `doors` but not passed through. `open` lists the other positions, nearest first.
function explore(level, occ, b, id, sx, sy, colour) {
  const seen = new Set([sy * 64 + sx]);
  const queue = [[sx, sy]], open = [], doors = [];
  for (let qi = 0; qi < queue.length; qi++) {
    const [x, y] = queue[qi];
    for (const [dx, dy] of stepsFor(b.axis)) {
      const nx = x + dx, ny = y + dy, key = ny * 64 + nx;
      if (nx < 0 || ny < 0 || seen.has(key)) continue;
      seen.add(key);
      if (!fits(level, occ, b, id, nx, ny)) continue;
      if (doorAt(level, occ, b, id, nx, ny, colour)) { doors.push([nx, ny]); continue; }
      open.push([nx, ny]);
      queue.push([nx, ny]);
    }
  }
  return { open, doors };
}

// Can block `id` leave the board from where it is now (peeling first if layered)?
export function canClear(level, occ, blocks, id, cleared = Infinity) {
  const b = blocks[id];
  if (b.ice > cleared) return false;
  const first = explore(level, occ, b, id, b.x, b.y, b.colour).doors;
  if (b.inner == null) return first.length > 0;
  return first.some(([x, y]) => explore(level, occ, b, id, x, y, b.inner).doors.length > 0);
}

// Clear every block that can leave, again and again. Clearing only ever frees space, so a block
// that can leave never needs to wait. Returns the new cleared count.
function clearAll(level, blocks, occ, cleared) {
  for (let progress = true; progress;) {
    progress = false;
    blocks.forEach((b, id) => {
      if (b.gone || !canClear(level, occ, blocks, id, cleared)) return;
      setOcc(level, occ, b, FREE);
      b.gone = true;
      cleared++;
      progress = true;
    });
  }
  return cleared;
}

// How many blocks must be moved out of the way (rather than straight out a door):
// 0 = none, 1 = one well-chosen move is enough, 2 = more than one. Only used on levels
// already known to be solvable.
export function grade(level) {
  const blocks = level.blocks.map(b => ({ ...b, gone: false }));
  const occ = buildOcc(level, blocks);
  const cleared = clearAll(level, blocks, occ, 0);
  if (blocks.every(b => b.gone)) return 0;
  for (let id = 0; id < blocks.length; id++) {
    const b = blocks[id];
    if (b.gone || b.ice > cleared) continue;
    for (const [x, y] of explore(level, occ, b, id, b.x, b.y, b.colour).open) {
      const bs = blocks.map(o => ({ ...o }));
      const o2 = occ.slice();
      setOcc(level, o2, bs[id], FREE);
      bs[id].x = x;
      bs[id].y = y;
      setOcc(level, o2, bs[id], id);
      clearAll(level, bs, o2, cleared);
      if (bs.every(o => o.gone)) return 1;
    }
  }
  return 2;
}

// --- Generation -----------------------------------------------------------

export function maxBlocks(w, h) {
  return Math.max(3, Math.floor((w * h) * 0.62 / 2.4));
}

function placeDoors(w, h, colours) {
  const used = { t: new Set(), b: new Set(), l: new Set(), r: new Set() };
  const doors = [];
  for (let c = 0; c < colours; c++) {
    const count = colours <= 3 && Math.random() < 0.5 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      for (let t = 0; t < 40; t++) {
        const side = 'tbrl'[rand(4)];
        const sideLen = side === 't' || side === 'b' ? w : h;
        const len = Math.min(sideLen - 1, [1, 2, 2, 2, 3, 3][rand(6)]);
        const at = rand(sideLen - len + 1);
        let ok = true;
        // Leave a gap of one cell between doors so each reads clearly.
        for (let i = at - 1; i <= at + len; i++) if (used[side].has(i)) ok = false;
        if (!ok) continue;
        for (let i = at; i < at + len; i++) used[side].add(i);
        doors.push({ side, at, len, colour: c });
        break;
      }
    }
  }
  for (let c = 0; c < colours; c++) if (!doors.some(d => d.colour === c)) return null;
  return doors;
}

const pickFar = list => list[list.length - 1 - rand(Math.max(1, Math.ceil(list.length * 0.6)))];

// Add a block by playing its exit backwards: it appears in one of its doors and slides inward.
function insertBlock(level, occ, o, n) {
  const id = level.blocks.length;
  for (let t = 0; t < 60; t++) {
    const colour = n < o.colours ? n : rand(o.colours);
    const b = { cells: randomShape(t < 40 ? 6 : 2), x: 0, y: 0, colour, inner: null, axis: null, ice: 0 };
    if (o.layers && o.colours > 1 && Math.random() < 0.25) {
      b.inner = colour;
      b.colour = (colour + 1 + rand(o.colours - 1)) % o.colours;
    }
    if (o.arrows && b.inner == null && Math.random() < 0.25) b.axis = Math.random() < 0.5 ? 'h' : 'v';
    const last = b.inner ?? b.colour;
    const starts = [];
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        if (fits(level, occ, b, id, x, y) && doorAt(level, occ, b, id, x, y, last)) starts.push([x, y]);
      }
    }
    if (!starts.length) continue;
    const [dx, dy] = starts[rand(starts.length)];
    let spots = explore(level, occ, b, id, dx, dy, last).open;
    if (b.inner != null) {
      // Before reaching its inner door the block peeled at an outer door: find one on the way.
      const peel = spots.filter(([x, y]) => doorAt(level, occ, b, id, x, y, b.colour));
      if (!peel.length) continue;
      const [px, py] = peel[rand(peel.length)];
      spots = explore(level, occ, b, id, px, py, b.colour).open;
    }
    if (!spots.length) continue;
    [b.x, b.y] = pickFar(spots);
    level.blocks.push(b);
    setOcc(level, occ, b, id);
    return true;
  }
  return false;
}

// Slide an existing block somewhere else. Played forwards, this is a move the player has to
// make to get that block out of someone's way.
function relocate(level, occ) {
  for (let t = 0; t < 12; t++) {
    const id = rand(level.blocks.length), b = level.blocks[id];
    const spots = explore(level, occ, b, id, b.x, b.y, b.colour).open;
    if (!spots.length) continue;
    setOcc(level, occ, b, FREE);
    [b.x, b.y] = pickFar(spots);
    setOcc(level, occ, b, id);
    return id;
  }
  return -1;
}

// Build a level backwards from an empty board, mixing block entries (exits played in reverse)
// with relocations. Playing the steps in reverse order solves it, so every level is solvable.
function buildBackwards(o, relocations) {
  const { w, h } = o;
  const doors = placeDoors(w, h, o.colours);
  if (!doors) return null;
  const level = { w, h, walls: [], doors, blocks: [] };
  if (o.walls) {
    const count = Math.round(w * h * 0.06);
    for (let t = 0; t < count * 4 && level.walls.length < count; t++) {
      const i = (1 + rand(h - 2)) * w + 1 + rand(w - 2);
      if (!level.walls.includes(i)) level.walls.push(i);
    }
  }
  const occ = buildOcc(level, []);
  const steps = []; // backwards order: { exit: true, id } or { id }
  let toAdd = o.blocks, toMove = relocations, full = false;
  for (let guard = 0; guard < 400 && (toAdd > 0 && !full || toMove > 0); guard++) {
    const add = toAdd > 0 && !full && (level.blocks.length < 2 || Math.random() < toAdd / (toAdd + toMove));
    if (add) {
      if (insertBlock(level, occ, o, level.blocks.length)) {
        steps.push({ exit: true, id: level.blocks.length - 1 });
        toAdd--;
      } else {
        full = true;
      }
    } else if (level.blocks.length) {
      const id = relocate(level, occ);
      if (id >= 0) steps.push({ id });
      toMove--;
    }
  }
  if (level.blocks.length < Math.min(o.blocks, 3)) return null;
  // Ice: a block can stay frozen until as many blocks have left as leave before its first move.
  if (o.ice) {
    const forward = steps.slice().reverse();
    let iced = 0;
    for (const id of shuffle([...level.blocks.keys()])) {
      if (iced >= 3) break;
      const first = forward.findIndex(s => s.id === id);
      const before = forward.slice(0, first).filter(s => s.exit).length;
      if (before >= 1 && Math.random() < 0.5) {
        level.blocks[id].ice = 1 + rand(Math.min(5, before));
        iced++;
      }
    }
  }
  return level;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// opts: { w, h, blocks, colours, difficulty, arrows, ice, layers, walls }
// Builds candidates until one grades at the requested difficulty, keeping the closest otherwise.
export function generateLevel(opts, budgetMs = 1500) {
  const target = TARGET[opts.difficulty] ?? 1;
  const t0 = performance.now();
  let best = null;
  for (let attempt = 0; attempt < 500; attempt++) {
    const moves = target === 0 ? 0 : opts.blocks + rand(opts.blocks * (target === 1 ? 1 : 2));
    const level = buildBackwards(opts, moves);
    if (level) {
      const g = grade(level);
      const missing = [
        opts.arrows && !level.blocks.some(b => b.axis),
        opts.layers && !level.blocks.some(b => b.inner != null),
        opts.ice && !level.blocks.some(b => b.ice),
      ].filter(Boolean).length;
      const score = -Math.abs(g - target) * 1000 - missing * 100 + level.blocks.length * 5;
      if (!best || score > best.score) best = { level, score, grade: g };
      if (g === target && !missing && level.blocks.length >= opts.blocks * 0.85) break;
    }
    if (best && performance.now() - t0 > budgetMs) break;
  }
  const { level, grade: g } = best;
  level.grade = g;
  level.difficulty = DIFFICULTIES[g];
  return level;
}
