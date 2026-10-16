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

// How many times a player has to move a block out of the way, played the way a person would:
// clear everything that can leave, then make the single move that frees the most blocks, and
// repeat. Candidate spots are sampled to keep this quick. If no single move frees anything, the
// level needs moves planned together, which counts as two more.
export function shuffles(level, maxSteps = 12) {
  let blocks = level.blocks.map(b => ({ ...b, gone: false }));
  let occ = buildOcc(level, blocks);
  let cleared = clearAll(level, blocks, occ, 0);
  let count = 0;
  while (!blocks.every(b => b.gone)) {
    if (count >= maxSteps) return count;
    let best = null;
    blocks.forEach((b, id) => {
      if (b.gone || b.ice > cleared) return;
      const open = explore(level, occ, b, id, b.x, b.y, b.colour).open;
      const step = Math.max(1, Math.floor(open.length / 8));
      for (let k = open.length - 1; k >= 0; k -= step) {
        const bs = blocks.map(o => ({ ...o })), o2 = occ.slice();
        setOcc(level, o2, bs[id], FREE);
        [bs[id].x, bs[id].y] = open[k];
        setOcc(level, o2, bs[id], id);
        const c = clearAll(level, bs, o2, cleared);
        if (c > cleared && (!best || c > best.c)) best = { c, bs, o2 };
      }
    });
    if (!best) return count + 2;
    ({ bs: blocks, o2: occ, c: cleared } = best);
    count++;
  }
  return count;
}

// How far ahead a player has to plan. Plays like a careful person: clear everything that can
// leave; when stuck, search for the shortest run of moves after which some block can leave,
// and make it. Returns { depth: the longest run ever needed, moves: total moves aside,
// stuck: true if some run is longer than maxDepth or the search budget ran out }.
export function planning(level, maxDepth = 4, budget = 8000, first = null) {
  let blocks = level.blocks.map(b => ({ ...b, gone: false }));
  let occ = buildOcc(level, blocks);
  // `first`, if given, records how many blocks had left before each block first moved or left.
  const note = (before, bs, prev) => {
    if (!first) return;
    bs.forEach((b, id) => {
      if (first[id] != null) return;
      if (b.gone !== prev[id].gone || b.x !== prev[id].x || b.y !== prev[id].y) first[id] = before;
    });
  };
  let snapshot = blocks.map(b => ({ ...b }));
  let cleared = clearAll(level, blocks, occ, 0);
  if (first) blocks.forEach((b, id) => { if (b.gone) first[id] = 0; });
  let depth = 0, moves = 0, nodes = 0, knots = 0;
  const keyOf = bs => bs.map(b => (b.gone ? '' : `${b.x},${b.y}`)).join(';');
  const anyLeaves = (bs, o) => bs.some((b, id) => !b.gone && canClear(level, o, bs, id, cleared));
  while (!blocks.every(b => b.gone)) {
    let frontier = [{ bs: blocks, o: occ }], found = null;
    const seen = new Set([keyOf(blocks)]);
    for (let d = 1; d <= maxDepth && !found; d++) {
      const next = [];
      search: for (const st of frontier) {
        for (let id = 0; id < st.bs.length; id++) {
          const b = st.bs[id];
          if (b.gone || b.ice > cleared) continue;
          for (const spot of explore(level, st.o, b, id, b.x, b.y, b.colour).open) {
            const bs = st.bs.slice(), o = st.o.slice();
            bs[id] = { ...b };
            setOcc(level, o, b, FREE);
            [bs[id].x, bs[id].y] = spot;
            setOcc(level, o, bs[id], id);
            const k = keyOf(bs);
            if (seen.has(k)) continue;
            seen.add(k);
            if (++nodes > budget) return { depth: maxDepth + 1, moves: moves + d, knots: knots + 1, stuck: true };
            if (anyLeaves(bs, o)) { found = { bs, o, d }; break search; }
            next.push({ bs, o });
          }
        }
      }
      frontier = next;
    }
    if (!found) return { depth: maxDepth + 1, moves, knots: knots + 1, stuck: true };
    snapshot = blocks;
    blocks = found.bs.map(b => ({ ...b }));
    note(cleared, blocks, snapshot);
    occ = found.o;
    const before = cleared, moved = blocks.map(b => ({ ...b }));
    cleared = clearAll(level, blocks, occ, cleared);
    note(before, blocks, moved);
    depth = Math.max(depth, found.d);
    moves += found.d;
    if (found.d >= 2) knots++;
  }
  return { depth, moves, knots, stuck: false };
}

// Share of the floor covered by blocks.
export const fill = level => level.blocks.reduce((a, b) => a + b.cells.length, 0) / (level.w * level.h - level.walls.length);

// --- Generation -----------------------------------------------------------

export function maxBlocks(w, h) {
  return Math.max(3, Math.floor((w * h) * 0.8 / 2.4));
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

// Colours block b could ever leave through: a door of that colour at least as wide as the
// block, on a side the block can move towards.
function leavableColours(level, b, colours) {
  const bw = Math.max(...b.cells.map(c => c[0])) + 1, bh = Math.max(...b.cells.map(c => c[1])) + 1;
  const out = [];
  for (let c = 0; c < colours; c++) {
    const fitsDoor = level.doors.some(d => d.colour === c && (d.side === 't' || d.side === 'b'
      ? b.axis !== 'h' && bw <= d.len
      : b.axis !== 'v' && bh <= d.len));
    if (fitsDoor) out.push(c);
  }
  return out;
}

// Hard levels: pack the board tight at random. Most such boards turn out solvable, and the
// solvable ones need real planning, because with so little space blocks block each other in
// chains. The caller checks solvability with the planning solver.
function buildPacked(o, target = 0.8) {
  const { w, h } = o;
  const doors = placeDoors(w, h, o.colours);
  if (!doors) return null;
  const level = { w, h, walls: [], doors, blocks: [] };
  const occ = buildOcc(level, []);
  const room = w * h * target;
  let cells = 0;
  for (let t = 0; t < 3000 && cells < room && level.blocks.length < o.blocks; t++) {
    const b = { cells: randomShape(t < 2000 ? 6 : 2), x: 0, y: 0, colour: 0, inner: null, axis: null, ice: 0 };
    const ok = leavableColours(level, b, o.colours);
    if (!ok.length) continue;
    b.colour = ok[rand(ok.length)];
    if (o.layers && ok.length > 1 && Math.random() < 0.15) {
      b.inner = b.colour;
      b.colour = ok.filter(c => c !== b.inner)[rand(ok.length - 1)];
    }
    const bw = Math.max(...b.cells.map(c => c[0])) + 1, bh = Math.max(...b.cells.map(c => c[1])) + 1;
    b.x = rand(w - bw + 1);
    b.y = rand(h - bh + 1);
    const id = level.blocks.length;
    if (!fits(level, occ, b, id, b.x, b.y) || doorAt(level, occ, b, id, b.x, b.y, b.colour)) continue;
    level.blocks.push(b);
    setOcc(level, occ, b, id);
    cells += b.cells.length;
  }
  return level.blocks.length >= 3 ? level : null;
}

// Walls and arrow blocks make packed boards almost never solvable if placed up front, so they
// are added afterwards one at a time, each kept only if the level can still be finished.
function decorate(level, o, budgetMs = 1500) {
  const end = performance.now() + budgetMs;
  const stillSolvable = () => !planning(level, 4, 2500).stuck;
  if (o.arrows) {
    let added = 0;
    for (const id of shuffle([...level.blocks.keys()])) {
      if (added >= 3 || performance.now() > end) break;
      const b = level.blocks[id];
      if (b.axis || b.inner != null) continue;
      b.axis = Math.random() < 0.5 ? 'h' : 'v';
      if (stillSolvable()) added++;
      else b.axis = null;
    }
  }
  if (o.walls) {
    const occ = buildOcc(level, level.blocks);
    let added = 0;
    for (let t = 0; t < 12 && added < 4 && performance.now() < end + budgetMs / 2; t++) {
      const i = (1 + rand(level.h - 2)) * level.w + 1 + rand(level.w - 2);
      if (occ[i] !== FREE) continue;
      level.walls.push(i);
      occ[i] = WALL;
      if (stillSolvable()) added++;
      else { level.walls.pop(); occ[i] = FREE; }
    }
  }
}

// Ice for a solved packed level: a block can wait for as many blocks to leave as left before
// the solver first touched it, so the same solution still works.
function addIce(level, first) {
  let iced = 0;
  for (const id of shuffle([...level.blocks.keys()])) {
    if (iced >= 3) break;
    if (first[id] >= 1 && Math.random() < 0.5) {
      level.blocks[id].ice = 1 + rand(Math.min(5, first[id]));
      iced++;
    }
  }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Hard: packed boards, kept only if the planning solver can finish them, and the most demanding
// one found in the time budget wins: most points where no single move helps (knots), the
// furthest you must plan ahead, then the most moves overall. Returns null if no packed board
// could be proven solvable in time (the caller falls back to the backwards builder).
function generateHard(opts, budgetMs) {
  const end = performance.now() + budgetMs;
  let best = null;
  while (performance.now() < end) {
    const level = buildPacked(opts, 0.8);
    if (!level) continue;
    const first = [];
    const p = planning(level, 4, 5000, first);
    if (p.stuck) continue;
    const score = p.knots * 30 + p.depth * 40 + p.moves * 3 + fill(level) * 50;
    if (!best || score > best.score) best = { level, p, first, score };
  }
  if (!best || best.p.depth < 2) return null;
  const { level, p, first } = best;
  decorate(level, opts);
  if (opts.ice) {
    addIce(level, first);
    // Belt and braces: if the ice somehow breaks the solution, melt it.
    if (planning(level, 4, 5000).stuck) level.blocks.forEach(b => { b.ice = 0; });
  }
  level.shuffles = p.moves;
  level.knots = p.knots;
  level.difficulty = 'hard';
  return level;
}

// Moves out of the way each difficulty asks for: Easy none, Medium one or two, Hard three or more.
const SHUFFLES = { easy: [0, 0], medium: [1, 2], hard: [3, 99] };
export const difficultyFor = n => (n === 0 ? 'easy' : n <= 2 ? 'medium' : 'hard');

// opts: { w, h, blocks, colours, difficulty, arrows, ice, layers, walls }
// Builds candidates within the time budget and keeps the best: the right number of moves out of
// the way, then the most tangled (for Hard), then the fullest board.
export function generateLevel(opts, budgetMs = 2500) {
  if (opts.difficulty === 'hard') {
    const hard = generateHard(opts, budgetMs + 1000);
    if (hard) return hard;
  }
  const want = opts.difficulty in SHUFFLES ? opts.difficulty : 'medium';
  const [lo, hi] = SHUFFLES[want];
  const t0 = performance.now();
  let best = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const moves = want === 'easy' ? 0
      : want === 'medium' ? opts.blocks + rand(opts.blocks)
      : opts.blocks * 3 + rand(opts.blocks * 3);
    const level = buildBackwards(opts, moves);
    if (level) {
      const n = want === 'easy' ? 0 : shuffles(level);
      const missing = [
        opts.arrows && !level.blocks.some(b => b.axis),
        opts.layers && !level.blocks.some(b => b.inner != null),
        opts.ice && !level.blocks.some(b => b.ice),
      ].filter(Boolean).length;
      const off = n < lo ? lo - n : n > hi ? n - hi : 0;
      const score = -off * 1000 - missing * 100 + (want === 'hard' ? Math.min(n, 8) * 60 : 0) + fill(level) * 300;
      if (!best || score > best.score) best = { level, score, n };
      if (!off && !missing && want !== 'hard' && level.blocks.length >= opts.blocks * 0.85) break;
    }
    if (best && performance.now() - t0 > budgetMs) break;
  }
  const { level, n } = best;
  level.shuffles = n;
  level.difficulty = difficultyFor(n);
  return level;
}
