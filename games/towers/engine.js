// Rules, computer opponent and map generator for "Kelsey VS Carter" (a Tower War remake).
//
// Towers belong to a side (1 = player, 2+ = computer opponents) or nobody (0). Owned towers grow
// units over time, faster as they level up. Sending from a tower marches half its units to
// another tower: they add to a friendly tower and knock units off anyone else's (owned towers
// defend better than neutral ones), capturing it when it drops below zero. Groups heading opposite ways between the same two towers cancel out
// where they meet. Factories grow twice as fast but each attacker knocks two off them.
// Walls block the path between two towers. A side with no towers and no units on the move is out.
//
// The map is W x H units (portrait); the board scales it to the screen.

export const W = 100, H = 150;
export const PLAYER = 1;
const SPEED = 12; // map units per second
const SPACING = 2.4; // map units between marching units
const GRACE = 3; // seconds before opponents make their first move

// Balance. Everyone starts equal; owning more towers matters more than piling units into one
// (growth is fairly flat and each tower is capped), and attacking an owned tower costs more
// than defending it, so where and when you attack matters more than raw numbers.
export const RULES = {
  start: 10, // every side's starting units
  maxUnits: 60, // most units a tower can hold
  levelAt: [10, 25, 45], // unit counts where a tower levels up
  growth: [0.8, 0.9, 1.0, 1.1], // units per second, by level (factories double it)
  defence: 0.85, // what each attacker knocks off an owned tower (neutral towers take 1)
  neutral: [5, 20], // neutral towers' units, low to high
};

export const DIFFICULTIES = ['easy', 'medium', 'hard'];
const AI = {
  easy: { every: 4.5, margin: 0.9, defend: false, pool: false, minSend: 8, sloppy: true },
  medium: { every: 2, margin: 1.2, defend: true, pool: true, minSend: 6 },
  hard: { every: 0.7, margin: 1.35, defend: true, pool: true, minSend: 8, careful: true },
};

export const level = t => RULES.levelAt.filter(n => t.units >= n).length;
export const radius = t => 5.2 + level(t) * 0.9;
const growth = t => RULES.growth[level(t)] * (t.factory ? 2 : 1);
// What one attacking unit knocks off tower t.
const hit = t => (t.factory ? 2 : 1) * (t.owner ? RULES.defence : 1);

const rand = k => Math.floor(Math.random() * k);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// --- Geometry -------------------------------------------------------------

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function pointSegDist(px, py, [x1, y1, x2, y2]) {
  const vx = x2 - x1, vy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - x1 - t * vx, py - y1 - t * vy);
}

export function clearPath(state, a, b) {
  const A = state.towers[a], B = state.towers[b];
  return !state.walls.some(w => segmentsCross(A.x, A.y, B.x, B.y, ...w));
}

// --- Game state -----------------------------------------------------------

export function newGame(map) {
  return {
    towers: map.towers.map(t => ({ ...t })),
    walls: map.walls,
    moving: [], // { from, to, owner, p } p: 0..1 along the path (below 0 = still queued in the tower)
    sides: map.sides,
    ai: {}, // owner -> seconds until next decision
    time: 0,
    result: null, // 'win' | 'lose'
  };
}

export const canSend = (state, from, to, owner) =>
  from !== to && state.towers[from]?.owner === owner && state.towers[to] && state.towers[from].units >= 2 &&
  clearPath(state, from, to);

// March half the tower's units to another tower. Returns how many were sent.
export function send(state, from, to, owner) {
  if (!canSend(state, from, to, owner)) return 0;
  const t = state.towers[from];
  const n = Math.floor(t.units / 2);
  t.units -= n;
  const gap = SPACING / dist(t, state.towers[to]);
  for (let k = 0; k < n; k++) state.moving.push({ from, to, owner, p: -k * gap });
  return n;
}

export function step(state, dt, aiLevel) {
  if (state.result) return;
  state.time += dt;
  const { towers } = state;

  for (const t of towers) {
    if (t.owner) t.units = Math.min(RULES.maxUnits, t.units + growth(t) * dt);
  }

  for (const u of state.moving) u.p += (SPEED * dt) / dist(towers[u.from], towers[u.to]);

  // Opposing groups between the same two towers cancel out where they meet.
  const lanes = new Map();
  for (const u of state.moving) {
    if (u.p <= 0) continue;
    const key = Math.min(u.from, u.to) * 1000 + Math.max(u.from, u.to);
    if (!lanes.has(key)) lanes.set(key, []);
    lanes.get(key).push(u);
  }
  const dead = new Set();
  for (const lane of lanes.values()) {
    if (lane.length < 2) continue;
    const a = lane.filter(u => u.from < u.to).sort((x, y) => y.p - x.p);
    const b = lane.filter(u => u.from > u.to).sort((x, y) => y.p - x.p);
    let i = 0, j = 0;
    while (i < a.length && j < b.length && a[i].owner !== b[j].owner && a[i].p + b[j].p >= 1) {
      dead.add(a[i++]);
      dead.add(b[j++]);
    }
  }

  const still = [];
  for (const u of state.moving) {
    if (dead.has(u)) continue;
    if (u.p < 1) { still.push(u); continue; }
    const t = towers[u.to];
    if (t.owner === u.owner) {
      t.units = Math.min(RULES.maxUnits, t.units + 1);
    } else {
      t.units -= hit(t);
      if (t.units < 0) {
        t.owner = u.owner;
        t.units = Math.max(0, -t.units / hit(t));
      }
    }
  }
  state.moving = still;

  const thinkers = [...Array(state.sides).keys()].map(k => k + 2);
  // Headless test games also play the player's side (autoPlayer: true = medium, or a level name).
  if (state.autoPlayer) thinkers.push(PLAYER);
  for (const s of thinkers) {
    const cfg = s === PLAYER ? AI[state.autoPlayer === true ? 'medium' : state.autoPlayer] : AI[aiLevel];
    state.ai[s] = (state.ai[s] ?? GRACE + cfg.every * Math.random()) - dt;
    if (state.ai[s] <= 0 && alive(state, s)) {
      think(state, s, cfg);
      state.ai[s] = cfg.every * (0.85 + Math.random() * 0.3);
    }
  }

  if (!alive(state, PLAYER)) state.result = 'lose';
  else if (![...Array(state.sides).keys()].some(k => alive(state, k + 2))) state.result = 'win';
}

export function alive(state, owner) {
  return state.towers.some(t => t.owner === owner) || state.moving.some(u => u.owner === owner);
}

// --- Computer opponent ----------------------------------------------------

function inbound(state, i, owner) {
  let hostile = 0, friendly = 0;
  for (const u of state.moving) {
    if (u.to !== i) continue;
    if (u.owner === owner) friendly++; else hostile++;
  }
  return { hostile, friendly };
}

function think(state, owner, cfg) {
  const { towers } = state;
  const mine = towers.map((t, i) => i).filter(i => towers[i].owner === owner);
  const used = new Set();

  // Shore up a tower that is about to fall.
  if (cfg.defend) {
    for (const i of mine) {
      const { hostile, friendly } = inbound(state, i, owner);
      const short = hostile * hit(towers[i]) - towers[i].units - friendly;
      if (short <= 0) continue;
      const helper = mine
        .filter(j => j !== i && !used.has(j) && towers[j].units >= 6 && clearPath(state, j, i))
        .sort((a, b) => dist(towers[a], towers[i]) - dist(towers[b], towers[i]))[0];
      if (helper != null && send(state, helper, i, owner)) used.add(helper);
    }
  }

  // What it takes to capture tower j, counting units already on their way.
  const need = (j, from) => {
    const t = towers[j], { hostile, friendly } = inbound(state, j, owner);
    const grow = t.owner ? growth(t) * dist(towers[from], t) / SPEED : 0;
    return Math.max(0, (t.units + grow + (t.owner ? hostile * 0.5 : 0)) / hit(t) - friendly);
  };

  // Careful opponents won't empty a tower that an enemy next door could then take straight away.
  const exposed = k => {
    const t = towers[k], left = t.units - Math.floor(t.units / 2);
    return towers.some((e, j) => e.owner && e.owner !== owner && clearPath(state, j, k) &&
      dist(e, t) < 45 && Math.floor(e.units / 2) * hit(t) > left);
  };
  const ready = mine.filter(i => !used.has(i) && towers[i].units >= cfg.minSend && !(cfg.careful && exposed(i)))
    .sort((a, b) => towers[b].units - towers[a].units);
  for (const i of ready) {
    if (used.has(i)) continue;
    const half = Math.floor(towers[i].units / 2);
    let best = null, bestScore = Infinity;
    const options = [];
    towers.forEach((t, j) => {
      if (t.owner === owner || !clearPath(state, i, j)) return;
      const n = need(j, i);
      const score = n + dist(towers[i], t) * 0.12 - (t.factory ? 4 : 0) - (t.owner ? 2 : 0);
      if (half >= n * cfg.margin + 1) options.push({ j, score });
      if (half >= n * cfg.margin + 1 && score < bestScore) { bestScore = score; best = { j, solo: true }; }
      // Hard opponents gang up: several towers send half at the same target.
      if (cfg.pool && half < n * cfg.margin + 1) {
        const crew = ready.filter(k => !used.has(k) && clearPath(state, k, j));
        const total = crew.reduce((a, k) => a + Math.floor(towers[k].units / 2), 0);
        if (crew.length > 1 && total >= n * cfg.margin + 2 && score + 3 < bestScore) {
          bestScore = score + 3;
          best = { j, crew };
        }
      }
    });
    // Easy opponents pick any of their few best-looking targets, often a poor one.
    if (cfg.sloppy && options.length) {
      const pickFrom = options.sort((a, b) => a.score - b.score).slice(0, 3);
      best = { j: pickFrom[rand(pickFrom.length)].j, solo: true };
    }
    if (!best) continue;
    for (const k of best.solo ? [i] : best.crew) {
      if (send(state, k, best.j, owner)) used.add(k);
    }
  }
}

// --- Map generation -------------------------------------------------------

function placeTowers(n) {
  const minD = Math.sqrt((W * H) / n) * 0.62;
  for (let tries = 0; tries < 50; tries++) {
    const pts = [];
    for (let k = 0; k < n * 60 && pts.length < n; k++) {
      const p = { x: 10 + Math.random() * (W - 20), y: 12 + Math.random() * (H - 24) };
      if (pts.every(q => dist(p, q) >= minD)) pts.push(p);
    }
    if (pts.length === n) return pts;
  }
  return null;
}

function connected(state) {
  const n = state.towers.length, seen = new Set([0]), stack = [0];
  while (stack.length) {
    const i = stack.pop();
    for (let j = 0; j < n; j++) {
      if (!seen.has(j) && clearPath(state, i, j)) { seen.add(j); stack.push(j); }
    }
  }
  return seen.size === n;
}

function buildMap(o) {
  const pts = placeTowers(o.towers);
  if (!pts) return null;
  const towers = pts.map(p => ({ x: p.x, y: p.y, owner: 0, units: 0, factory: false }));
  // Player starts near the bottom; each opponent as far as possible from everyone already placed.
  const bottom = towers.map((t, i) => i).sort((a, b) => towers[b].y - towers[a].y);
  const starts = [bottom[rand(2)]];
  for (let s = 0; s < o.enemies; s++) {
    let best = -1, bestD = -1;
    towers.forEach((t, i) => {
      if (starts.includes(i)) return;
      const d = Math.min(...starts.map(j => dist(t, towers[j])));
      if (d > bestD) { bestD = d; best = i; }
    });
    starts.push(best);
  }
  if (dist(towers[starts[0]], towers[starts[1]]) < 55) return null;
  starts.forEach((i, k) => {
    towers[i].owner = k + 1;
    towers[i].units = RULES.start;
  });
  const neutral = towers.filter(t => !t.owner);
  const [lo, hi] = RULES.neutral;
  for (const t of neutral) t.units = lo + rand(hi - lo + 1);
  // Factories go on neutral towers, and cost a bit more to take.
  if (o.factories) {
    for (const t of neutral.sort(() => Math.random() - 0.5).slice(0, Math.max(1, Math.round(towers.length / 6)))) {
      t.factory = true;
      t.units += 6;
    }
  }

  // Each side should have a similar share of easy neutral towers nearby.
  const share = starts.map(() => 0);
  for (const t of neutral) {
    const near = starts.map(i => dist(t, towers[i]));
    share[near.indexOf(Math.min(...near))] += (t.factory ? 16 : 10) / (t.units + 6);
  }
  if (Math.max(...share) > Math.min(...share) * 1.6 + 0.6) return null;

  const walls = [];
  if (o.walls) {
    const want = 2 + rand(3);
    for (let k = 0; k < 80 && walls.length < want; k++) {
      const cx = 12 + Math.random() * (W - 24), cy = 15 + Math.random() * (H - 30);
      const ang = Math.random() * Math.PI, len = 16 + Math.random() * 18;
      const w = [cx - Math.cos(ang) * len / 2, cy - Math.sin(ang) * len / 2, cx + Math.cos(ang) * len / 2, cy + Math.sin(ang) * len / 2];
      if (towers.some(t => pointSegDist(t.x, t.y, w) < 10)) continue;
      walls.push(w.map(v => Math.round(v * 10) / 10));
    }
  }
  const map = { towers, walls, sides: o.enemies };
  if (!connected(newGame(map))) return null;
  return map;
}

// Let two copies of the medium opponent play the map at speed. Maps where one side is wiped out
// very quickly are lopsided.
function fair(map) {
  const s = newGame(map);
  s.autoPlayer = true;
  while (!s.result && s.time < 150) step(s, 0.1, 'medium');
  return !s.result || s.time > 45;
}

// opts: { towers, enemies, difficulty, walls, factories }
export function generateMap(opts) {
  let fallback = null;
  for (let attempt = 0; attempt < 200; attempt++) {
    const map = buildMap(opts);
    if (!map) continue;
    if (!fallback) fallback = map;
    if (fair(map)) return map;
  }
  return fallback;
}
