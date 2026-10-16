// Rules, track generator and level checker for "Cleaning Up" (a Loop Sort remake).
//
// Trucks are parked around a closed loop of track, each holding a stack of mixed coloured
// cubes (the cube nearest the track is the top). Tapping a truck sends its top cube onto the
// track. Cubes ride round the loop one step per tick and drop into the first truck they pass
// that is empty, or has the same colour on top, and has room. (A cube skips the truck it came
// from until it has gone all the way round.) A truck that fills up with one colour drives away.
// Clear every truck to win. If the track fills up and nothing has happened for a whole lap,
// it's jammed.
//
// So the puzzle is in the order of taps: you choose which cube moves, the loop decides where it
// lands. The track follows the outline of a random blob of grid cells, so every level's loop is a
// different shape; trucks park just outside it.

export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const COLOURS = 6;
const rand = k => Math.floor(Math.random() * k);
const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// --- Track shape ----------------------------------------------------------

// Grow a blob of cells with no holes and no corner-only joins, so its outline is one clean loop.
function growBlob(gw, gh, area) {
  const inside = new Set(), key = (x, y) => y * gw + x;
  const has = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh && inside.has(key(x, y));
  inside.add(key(rand(gw), rand(gh)));
  for (let tries = 0; tries < area * 40 && inside.size < area; tries++) {
    const cells = [...inside];
    const c = cells[rand(cells.length)], cx = c % gw, cy = (c / gw) | 0;
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][rand(4)];
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= gw || ny >= gh || has(nx, ny)) continue;
    inside.add(key(nx, ny));
    if (!outlineOf(gw, gh, inside)) inside.delete(key(nx, ny));
  }
  return inside;
}

// The blob's outline as an ordered loop of lattice points (clockwise), or null if it isn't a
// single simple loop.
function outlineOf(gw, gh, inside) {
  const has = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh && inside.has(y * gw + x);
  const next = new Map(); // directed boundary edges, keeping the blob on the right
  const add = (a, b) => {
    const k = `${a[0]},${a[1]}`;
    if (next.has(k)) next.set(k, null); // a point the outline passes twice: a pinch
    else next.set(k, b);
  };
  for (const c of inside) {
    const x = c % gw, y = (c / gw) | 0;
    if (!has(x, y - 1)) add([x, y], [x + 1, y]);
    if (!has(x + 1, y)) add([x + 1, y], [x + 1, y + 1]);
    if (!has(x, y + 1)) add([x + 1, y + 1], [x, y + 1]);
    if (!has(x - 1, y)) add([x, y + 1], [x, y]);
  }
  if ([...next.values()].some(v => v === null)) return null;
  const start = next.keys().next().value;
  const loop = [];
  let k = start;
  do {
    const [x, y] = k.split(',').map(Number);
    loop.push([x, y]);
    const b = next.get(k);
    if (!b) return null;
    k = `${b[0]},${b[1]}`;
  } while (k !== start && loop.length <= next.size);
  return loop.length === next.size ? loop : null; // more than one loop means a hole
}

// Track spots where the outline runs straight, with the outward direction (away from the blob).
function straightSpots(loop) {
  const out = [];
  loop.forEach((p, i) => {
    const a = loop[(i - 1 + loop.length) % loop.length], b = loop[(i + 1) % loop.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (dx !== 0 && dy !== 0) return;
    // Clockwise with the blob on the right: outside is to the left of the direction of travel.
    out.push({ i, out: [Math.sign(dy), -Math.sign(dx)] });
  });
  return out;
}

// --- Truck geometry -------------------------------------------------------

// Where a truck's cubes sit, in grid units: k = 0 is the top cube, nearest the track.
export const TRUCK = { gap: 0.78, step: 0.42, width: 0.58, cube: 0.38 };
export const cubeSpot = (loop, t, k) => {
  const [x, y] = loop[t.at];
  const d = TRUCK.gap + k * TRUCK.step;
  return [x + t.out[0] * d, y + t.out[1] * d];
};

// A parked truck must stay clear of the track and of other trucks.
function truckFits(loop, t, cap, others) {
  for (let k = 0; k < cap; k++) {
    const [x, y] = cubeSpot(loop, t, k);
    // Distance from this cube to every track segment except where the truck connects.
    for (let i = 0; i < loop.length; i++) {
      const [ax, ay] = loop[i], [bx, by] = loop[(i + 1) % loop.length];
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
      const u = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2));
      const d = Math.hypot(x - ax - u * (bx - ax), y - ay - u * (by - ay));
      if (d < 0.5 && !(i === t.at || (i + 1) % loop.length === t.at)) return false;
    }
    for (const o of others) {
      for (let m = 0; m < cap; m++) {
        const [ox, oy] = cubeSpot(loop, o, m);
        if (Math.hypot(x - ox, y - oy) < 0.7) return false;
      }
    }
  }
  return true;
}

// --- Levels ---------------------------------------------------------------

// Difficulty: how many loaded trucks (each holds one colour's worth of cubes) and spare empty
// trucks (both vary from level to level within the range, so now and then you get a much bigger
// level), truck size, and limit: the most cubes allowed on the track at once. There are only six
// colours, so beyond six loads a colour fills two trucks. More trucks need a bigger track, so
// the grid grows with them.
export const LEVELS = {
  easy: { loads: [3, 6], cap: 3, spare: [1, 2], limit: 7 },
  medium: { loads: [4, 7], cap: 4, spare: [0, 1], limit: 6 },
  hard: { loads: [5, 8], cap: 4, spare: [0, 1], limit: 5 },
};
const pickIn = ([lo, hi]) => lo + rand(hi - lo + 1);

function buildLevel(difficulty, extras = {}) {
  const base = LEVELS[difficulty] ?? LEVELS.medium;
  for (let attempt = 0; attempt < 400; attempt++) {
    const L = { ...base, loads: pickIn(base.loads), spare: pickIn(base.spare) };
    const nTrucks = L.loads + L.spare;
    L.gw = nTrucks <= 5 ? 4 : nTrucks <= 7 ? 5 : 6;
    L.gh = nTrucks <= 5 ? 5 : nTrucks <= 7 ? 6 : 7;
    L.area = 4 + nTrucks * 2;
    const inside = growBlob(L.gw, L.gh, L.area);
    const loop = outlineOf(L.gw, L.gh, inside);
    if (!loop || loop.length < nTrucks * 2) continue;
    const turns = loop.filter((p, i) => {
      const a = loop[(i - 1 + loop.length) % loop.length], b = loop[(i + 1) % loop.length];
      return a[0] !== b[0] && a[1] !== b[1];
    }).length;
    if (turns < 6) continue;
    // Park trucks at straight spots, spread around the loop.
    const trucks = [];
    for (const s of shuffle(straightSpots(loop))) {
      if (trucks.length >= nTrucks) break;
      const near = trucks.some(t => Math.min(Math.abs(t.at - s.i), loop.length - Math.abs(t.at - s.i)) < 2);
      const t = { at: s.i, out: s.out };
      if (!near && truckFits(loop, t, L.cap, trucks)) trucks.push(t);
    }
    if (trucks.length < nTrucks) continue;
    trucks.sort((a, b) => a.at - b.at);

    // Cubes: one truckload per load, shuffled across the loaded trucks; spare trucks start empty.
    // Past six loads the colours repeat, so a colour may need two trucks.
    const pool = shuffle([...Array(COLOURS).keys()]);
    const loads = [...Array(L.loads).keys()].map(k => pool[k % COLOURS]);
    const colours = pool.slice(0, Math.min(L.loads, COLOURS));
    const cubes = shuffle(loads.flatMap(c => Array(L.cap).fill(c)));
    const order = shuffle([...trucks.keys()]);
    const level = {
      gw: L.gw, gh: L.gh, loop, cap: L.cap, limit: L.limit, difficulty,
      trucks: trucks.map(t => ({ ...t, cubes: [], ice: 0, hiddenBelow: 0, roof: null })),
    };
    order.slice(0, L.loads).forEach((ti, k) => { level.trucks[ti].cubes = cubes.slice(k * L.cap, (k + 1) * L.cap); });
    // Skip deals that start with a truck already sorted.
    if (level.trucks.some(t => t.cubes.length === L.cap && t.cubes.every(c => c === t.cubes[0]))) continue;
    if (extras.ice) {
      const full = level.trucks.filter(t => t.cubes.length);
      for (const t of shuffle(full).slice(0, 1 + (difficulty === 'hard' ? 1 : 0))) t.ice = 1 + rand(2);
    }
    // Roof colours (occasional, like ice): a truck with a coloured roof only takes cubes of that
    // colour. Usually an empty truck; sometimes a loaded one, which then has to be emptied of
    // everything else before it can fill.
    if (extras.roof) {
      const roofPool = shuffle(level.trucks.slice()).sort((a, b) => a.cubes.length - b.cubes.length);
      const n = Math.random() < 0.5 ? 1 : 2;
      roofPool.slice(0, n).forEach((t, k) => { t.roof = colours[(rand(colours.length) + k) % colours.length]; });
    }
    // Hidden trucks: everything below the top cube is unknown until it has been on top.
    if (extras.hidden) {
      for (const t of shuffle(level.trucks.filter(x => x.cubes.length)).slice(0, Math.ceil(L.loads / 2))) t.hiddenBelow = t.cubes.length - 1;
    }
    return level;
  }
  return null;
}


// --- The puzzle, without the track's timing ---------------------------------
//
// The track holds at most `limit` cubes at once. A tapped cube rides round and drops into the
// first truck after its own that will take it; a cube nothing will take keeps riding (using up
// track space) until some truck can. The solver and difficulty check use this model.

const takes = (t, c, cap, cleared) => !t.gone && t.ice <= cleared && t.cubes.length < cap &&
  (t.roof == null || t.roof === c) && (!t.cubes.length || t.cubes[t.cubes.length - 1] === c);

// The first truck after `from` round the loop that will take colour c (its own truck last).
export function firstTaker(trucks, from, c, cap, cleared = 0) {
  for (let k = 1; k <= trucks.length; k++) {
    const j = (from + k) % trucks.length;
    if (takes(trucks[j], c, cap, cleared)) return j;
  }
  return null;
}

const sortedFull = (t, cap) => t.cubes.length === cap && t.cubes.every(c => c === t.cubes[0]);

// Let riding cubes land wherever they now can; sorted trucks leave.
function settle(st, cap) {
  for (let moved = true; moved;) {
    moved = false;
    for (let w = 0; w < st.riding.length; w++) {
      const cube = st.riding[w], j = firstTaker(st.ts, cube.from, cube.c, cap, st.cleared);
      if (j == null) continue;
      st.ts[j].cubes.push(cube.c);
      st.riding.splice(w, 1);
      if (sortedFull(st.ts[j], cap)) { st.ts[j].gone = true; st.cleared++; }
      moved = true;
      break;
    }
  }
}

const startState = level => ({
  ts: level.trucks.map(t => ({ cubes: t.cubes.slice(), gone: false, ice: t.ice, roof: t.roof })), riding: [], cleared: 0,
});
const tappable = (st, i, limit) => st.riding.length < limit && !st.ts[i].gone && st.ts[i].cubes.length > 0 && st.ts[i].ice <= st.cleared;
function doTap(st, i, cap) {
  const next = { ts: st.ts.map(t => ({ ...t, cubes: t.cubes.slice() })), riding: st.riding.map(r => ({ ...r })), cleared: st.cleared };
  next.riding.push({ c: next.ts[i].cubes.pop(), from: i });
  settle(next, cap);
  return next;
}
const solved = st => !st.riding.length && st.ts.every(t => t.gone || !t.cubes.length);

// Depth-first search over taps. Returns the number of taps in the solution found, or -1.
export function solve(level, budget = 40000) {
  const seen = new Set();
  let nodes = 0;
  const key = st => st.ts.map(t => (t.gone ? 'x' : t.cubes.join(''))).join('|') + '#' +
    st.riding.map(r => `${r.c}.${r.from}`).sort().join(',');
  const dfs = (st, depth) => {
    if (solved(st)) return depth;
    const k = key(st);
    if (seen.has(k) || ++nodes > budget) return -1;
    seen.add(k);
    for (let i = 0; i < st.ts.length; i++) {
      if (!tappable(st, i, level.limit)) continue;
      const r = dfs(doTap(st, i, level.cap), depth + 1);
      if (r >= 0) return r;
    }
    return -1;
  };
  return dfs(startState(level), 0);
}

// How often tapping random trucks gets you stuck (track full of cubes with nowhere to go).
export function trapRate(level, samples = 40) {
  let stuck = 0;
  for (let n = 0; n < samples; n++) {
    let st = startState(level);
    for (let step = 0; step < 300 && !solved(st); step++) {
      const moves = st.ts.map((t, i) => i).filter(i => tappable(st, i, level.limit));
      if (!moves.length) { stuck++; break; }
      st = doTap(st, moves[rand(moves.length)], level.cap);
    }
  }
  return stuck / samples;
}

// How often a "sensible" player gets stuck: one who always prefers a tap whose cube will land
// in a truck straight away (ideally on its own colour), and only otherwise taps at random.
// Levels that beat this player need real planning, not just the obvious next move.
export function greedyTrap(level, samples = 30) {
  let stuck = 0;
  for (let n = 0; n < samples; n++) {
    let st = startState(level);
    for (let step = 0; step < 300 && !solved(st); step++) {
      const moves = st.ts.map((t, i) => i).filter(i => tappable(st, i, level.limit));
      if (!moves.length) { stuck++; break; }
      const score = i => {
        const t = st.ts[i], c = t.cubes[t.cubes.length - 1], j = firstTaker(st.ts, i, c, level.cap, st.cleared);
        if (j == null || j === i) return 0;
        const into = st.ts[j];
        return into.cubes.length ? 3 : 1; // onto its own colour beats into an empty truck
      };
      const best = Math.max(...moves.map(score));
      const pool = moves.filter(i => score(i) === best);
      st = doTap(st, pool[rand(pool.length)], level.cap);
    }
  }
  return stuck / samples;
}

// Keep levels that are solvable, preferring ones where careless tapping gets you stuck more
// often on harder settings.
// Easy takes the first forgiving level. Medium looks for one where careless tapping sometimes
// gets you stuck. Hard spends its whole budget hunting for a level that traps even a sensible
// player about 60% of the time, so the obvious move is often the wrong one.
export function generateLevel(opts, budgetMs = 2500) {
  const want = opts.difficulty in LEVELS ? opts.difficulty : 'medium';
  const end = performance.now() + budgetMs;
  let best = null;
  while (performance.now() < end || !best) {
    const level = buildLevel(want, opts);
    if (!level || solve(level) < 0) continue;
    const trap = trapRate(level, 30);
    let score;
    if (want === 'easy') score = trap <= 0.3 ? 1 : -trap;
    else if (want === 'medium') score = trap >= 0.15 && trap <= 0.7 ? 1 : -Math.abs(trap - 0.4);
    // Aim for the sensible player getting stuck about 60% of the time: tough, not hopeless.
    else score = -Math.abs(greedyTrap(level, 20) - 0.6) + trap * 0.2;
    if (!best || score > best.score) best = { level, score, trap };
    if (want !== 'hard' && score === 1) break;
  }
  best.level.trapRate = best.trap;
  return best.level;
}

// --- Real-time play on the track ----------------------------------------------

export function newGame(level) {
  return {
    slots: Array(level.loop.length).fill(null), // { c, from, ridden }
    trucks: level.trucks.map(t => ({ ...t, cubes: t.cubes.slice(), gone: false, pending: 0 })),
    cleared: 0, stall: 0, ticks: 0, taps: 0, result: null,
    events: [], // what happened this tick, for the board to animate
  };
}

export const onTrack = s => s.slots.filter(Boolean).length;
const waitingToGo = s => s.trucks.reduce((a, t) => a + t.pending, 0);
export const trackFull = (s, level) => onTrack(s) + waitingToGo(s) >= level.limit;

export const canTap = (s, i) => !s.result && !s.trucks[i].gone && s.trucks[i].ice <= s.cleared &&
  s.trucks[i].cubes.length > s.trucks[i].pending;

// Tapping queues the truck's top cube to go out as soon as its exit spot on the track is free,
// as long as the track has room for another cube.
export function tap(s, i, level) {
  if (!canTap(s, i) || trackFull(s, level)) return false;
  s.trucks[i].pending++;
  s.taps++;
  return true;
}

// Cubes on the track that no truck could take right now.
export const homeless = (s, level) => s.slots.filter(c => c && !s.trucks.some(t => takes(t, c.c, level.cap, s.cleared))).length;

export function tick(s, level) {
  if (s.result) return;
  const L = s.slots.length, cap = level.cap;
  s.ticks++;
  s.events = [];
  s.slots.unshift(s.slots.pop());
  let progress = false;
  for (const c of s.slots) if (c) c.ridden++;
  // Cubes drop into the first truck they reach that takes them (not their own on the first lap).
  s.trucks.forEach((t, i) => {
    const cube = s.slots[t.at];
    if (!cube || (cube.from === i && cube.ridden < L) || !takes(t, cube.c, cap, s.cleared)) return;
    t.cubes.push(cube.c);
    s.slots[t.at] = null;
    s.events.push({ type: 'in', truck: i, c: cube.c, slot: t.at });
    progress = true;
    if (sortedFull(t, cap)) {
      t.gone = true;
      t.pending = 0;
      s.cleared++;
      s.events.push({ type: 'leave', truck: i, c: cube.c });
    }
  });
  // Tapped trucks put their top cube out when their exit spot is empty.
  s.trucks.forEach((t, i) => {
    if (!t.pending || t.gone || s.slots[t.at]) return;
    const c = t.cubes.pop();
    s.slots[t.at] = { c, from: i, ridden: 0 };
    t.pending--;
    // Once a hidden cube has been on top it stays revealed.
    if (t.hiddenBelow) t.hiddenBelow = Math.min(t.hiddenBelow, Math.max(0, t.cubes.length - 1));
    s.events.push({ type: 'out', truck: i, c, slot: t.at, k: t.cubes.length });
    progress = true;
  });
  s.stall = progress ? 0 : s.stall + 1;
  if (s.trucks.every(t => t.gone || !t.cubes.length) && s.slots.every(c => !c)) { s.result = 'win'; return; }
  // Stuck: nothing on the track can land, and no tap can help (the track is at its limit or no
  // truck can be tapped), for a whole lap.
  const n = onTrack(s);
  const noTaps = trackFull(s, level) || !s.trucks.some((t, i) => canTap(s, i));
  if (n && homeless(s, level) === n && noTaps && !waitingToGo(s) && s.stall >= L) s.result = 'lose';
}
