// Rules, solver and level generator for "Kelsey Blocked Me In Again!" (a Color Block Jam remake).
//
// Rules: blocks slide around a walled board without overlapping. A block leaves the board when it
// touches a door of its own colour on the wall and every column (or row) of the block fits within
// the door. Layered blocks lose their outer colour at a matching door and stay put as the inner
// colour. Arrow blocks only slide one way. Iced blocks can't move until enough other blocks have left.
//
// Level: { w, h, walls: [cellIndex], doors: [{ side, at, len, colour }], blocks: [Block], timeLimit }
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

// Every position the block can reach where it would meet a door of `colour`. Door positions are
// terminal: a dragged block leaves (or peels) the moment it touches one.
function exitPositions(level, occ, b, id, sx, sy, colour) {
  const seen = new Set([sy * level.w + sx]);
  const queue = [[sx, sy]], exits = [];
  while (queue.length) {
    const [x, y] = queue.shift();
    if (doorAt(level, occ, b, id, x, y, colour)) { exits.push([x, y]); continue; }
    for (const [dx, dy] of stepsFor(b.axis)) {
      const nx = x + dx, ny = y + dy, key = ny * level.w + nx;
      if (nx < -6 || ny < -6 || seen.has(key)) continue;
      seen.add(key);
      if (fits(level, occ, b, id, nx, ny)) queue.push([nx, ny]);
    }
  }
  return exits;
}

// Can block `id` leave the board from where it is now (peeling first if layered)?
export function canClear(level, occ, blocks, id, cleared = Infinity) {
  const b = blocks[id];
  if (b.ice > cleared) return false;
  const first = exitPositions(level, occ, b, id, b.x, b.y, b.colour);
  if (b.inner == null) return first.length > 0;
  return first.some(([x, y]) => exitPositions(level, occ, b, id, x, y, b.inner).length > 0);
}

// Solve by clearing every block that can leave, round after round. Returns the number of
// rounds needed, or -1 if it gets stuck. Clearing only ever frees space, so this is reliable.
export function solveRounds(level) {
  const blocks = level.blocks.map(b => ({ ...b, gone: false }));
  const occ = buildOcc(level, blocks);
  let cleared = 0, left = blocks.length, rounds = 0;
  while (left > 0) {
    const ready = blocks.map((b, id) => id).filter(id => !blocks[id].gone && canClear(level, occ, blocks, id, cleared));
    if (!ready.length) return -1;
    for (const id of ready) {
      setOcc(level, occ, blocks[id], FREE);
      blocks[id].gone = true;
    }
    cleared += ready.length;
    left -= ready.length;
    rounds++;
  }
  return rounds;
}

// --- Generation -----------------------------------------------------------

export function maxBlocks(w, h) {
  return Math.max(3, Math.floor((w * h) * 0.5 / 2.3));
}

function placeDoors(w, h, colours) {
  const used = { t: new Set(), b: new Set(), l: new Set(), r: new Set() };
  const doors = [];
  const perColour = colours <= 3 ? 2 : colours <= 5 ? 2 : 1;
  for (let c = 0; c < colours; c++) {
    const count = Math.max(1, perColour - (Math.random() < 0.3 ? 1 : 0));
    for (let k = 0; k < count; k++) {
      for (let t = 0; t < 40; t++) {
        const side = 'tbrl'[rand(4)];
        const sideLen = side === 't' || side === 'b' ? w : h;
        const len = 1 + rand(Math.min(3, sideLen - 1));
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
  // Every colour needs at least one door.
  for (let c = 0; c < colours; c++) if (!doors.some(d => d.colour === c)) return null;
  return doors;
}

function buildOnce(o) {
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
  for (let n = 0; n < o.blocks; n++) {
    let placed = false;
    for (let t = 0; t < 160 && !placed; t++) {
      const colour = n < o.colours ? n : rand(o.colours);
      const b = {
        cells: randomShape(t < 100 ? 6 : 2), x: 0, y: 0, colour, inner: null, axis: null, ice: 0,
      };
      if (o.layers && o.colours > 1 && Math.random() < 0.22) {
        b.inner = colour;
        b.colour = (colour + 1 + rand(o.colours - 1)) % o.colours;
      }
      const bw = Math.max(...b.cells.map(c => c[0])) + 1, bh = Math.max(...b.cells.map(c => c[1])) + 1;
      if (bw > w || bh > h) continue;
      b.x = rand(w - bw + 1);
      b.y = rand(h - bh + 1);
      // Arrow blocks slide along one line, so put them in line with one of their doors.
      if (o.arrows && b.inner == null && Math.random() < 0.3) {
        const own = doors.filter(d => d.colour === b.colour);
        const d = own[rand(own.length)];
        const vertical = d.side === 't' || d.side === 'b';
        const span = vertical ? bw : bh;
        if (span <= d.len) {
          b.axis = vertical ? 'v' : 'h';
          if (vertical) b.x = d.at + rand(d.len - span + 1);
          else b.y = d.at + rand(d.len - span + 1);
        }
      }
      const id = level.blocks.length;
      if (!fits(level, occ, b, id, b.x, b.y)) continue;
      // Don't start a block already sitting in one of its own doors.
      if (doorAt(level, occ, b, id, b.x, b.y, b.colour)) continue;
      level.blocks.push(b);
      setOcc(level, occ, b, id);
      // Each new block must be able to leave with all earlier blocks still on the board, so
      // clearing them in reverse order always works.
      if (canClear(level, occ, level.blocks, id)) {
        placed = true;
      } else {
        level.blocks.pop();
        setOcc(level, occ, b, FREE);
      }
    }
    if (!placed) break;
  }
  if (level.blocks.length < Math.min(o.blocks, 3)) return null;
  // Ice: the block cleared k-th from last in the guaranteed order can wait for up to k clears.
  if (o.ice) {
    const B = level.blocks.length;
    let iced = 0;
    for (let i = 0; i < B && iced < 3; i++) {
      const room = B - 1 - i;
      if (room >= 2 && Math.random() < 0.35) {
        level.blocks[i].ice = 1 + rand(Math.min(5, room));
        iced++;
      }
    }
  }
  return level;
}

// opts: { w, h, blocks, colours, arrows, ice, layers, walls, timer }
// Builds several solvable candidates and keeps the one that needs the most rounds to clear.
export function generateLevel(opts, budgetMs = 350) {
  const t0 = performance.now();
  let best = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const level = buildOnce(opts);
    if (level) {
      const rounds = solveRounds(level);
      if (rounds > 0) {
        // Strongly prefer levels that show every obstacle the player switched on.
        const missing = [
          o => o.arrows && !level.blocks.some(b => b.axis),
          o => o.layers && !level.blocks.some(b => b.inner != null),
          o => o.ice && !level.blocks.some(b => b.ice),
        ].filter(f => f(opts)).length;
        const score = rounds * 10 + level.blocks.length * 3 - missing * 100;
        if (!best || score > best.score) best = { level, score, rounds };
      }
    }
    if (best && performance.now() - t0 > budgetMs) break;
  }
  if (!best) return null;
  const { level, rounds } = best;
  level.rounds = rounds;
  level.timeLimit = opts.timer
    ? Math.ceil((25 + level.blocks.length * 7 + level.blocks.filter(b => b.inner != null).length * 5) / 5) * 5
    : null;
  return level;
}
