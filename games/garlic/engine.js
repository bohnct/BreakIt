// Rules, waves and weapons for "Protect My Garlic!" (a Geometry Tower remake).
//
// Each gun has its own garlic: the handgun garlic sits in the middle of the map and every gun
// bought adds another garlic nearby. Waves of blocks march in from the edges toward the nearest
// garlic; every block that reaches one costs hearts (all garlics share them). Guns fire by
// themselves at blocks in range. Kills earn coins, and between waves the coins buy new guns,
// damage and rate-of-fire upgrades, or hearts. Nothing carries over between levels.
//
// The map is W x H units (portrait); the board scales it to the screen.

// Z sets how zoomed out the battlefield is. Distances (map size, ranges, speeds, garlic
// spacing) scale with it, so changing it changes how small things look, not the balance.
const Z = 2;
export const W = 100 * Z, H = 150 * Z;
export const CX = W / 2, CY = H / 2, GARLIC_R = 5.5;
export const MAX_LEVEL = 12;

export const WEAPONS = {
  handgun: { name: 'Handgun', cost: 0, dmg: 4, rate: 2, range: 41 * Z, speed: 87 * Z, pellets: 1, spread: 0, pierce: 0, target: 'nearest' },
  shotgun: { name: 'Shotgun', cost: 45, dmg: 2, rate: 0.9, range: 21 * Z, speed: 73 * Z, pellets: 5, spread: 0.55, pierce: 0, target: 'nearest' },
  sniper: { name: 'Sniper', cost: 70, dmg: 16, rate: 0.5, range: 400 * Z, speed: 213 * Z, pellets: 1, spread: 0, pierce: 2, target: 'strongest' },
  machinegun: { name: 'Machine gun', cost: 90, dmg: 1.1, rate: 7, range: 60 * Z, speed: 120 * Z, pellets: 1, spread: 0.12, pierce: 0, target: 'nearest' },
};
export const WEAPON_ORDER = ['handgun', 'shotgun', 'sniper', 'machinegun'];
// Where each gun's garlic stands, relative to the middle of the map.
const SPOTS = { handgun: [0, 0], shotgun: [-10.7, 7.3], sniper: [0, -12.7], machinegun: [10.7, 7.3] };
export const garlicAt = id => ({ x: CX + SPOTS[id][0] * Z, y: CY + SPOTS[id][1] * Z });

export const ENEMIES = {
  scout: { size: 3, hp: 3, speed: 10.7 * Z, harm: 1, value: 2 },
  block: { size: 4.5, hp: 7, speed: 7.3 * Z, harm: 1, value: 3 },
  brute: { size: 7, hp: 24, speed: 4.7 * Z, harm: 2, value: 8 },
  splitter: { size: 5.5, hp: 10, speed: 6.3 * Z, harm: 2, value: 4 },
  boss: { size: 11, hp: 150, speed: 3.3 * Z, harm: 8, value: 40 },
};

export const DIFFICULTIES = ['easy', 'medium', 'hard'];
// hp/grow: enemy health at wave 1 and how much it climbs each wave.
// count/more: enemies in wave 1 and how many more each wave.
export const DIFF = {
  easy: { hp: 0.8, grow: 0.13, count: 3, more: 1.5, speed: 0.9, waves: 15, hearts: 12 },
  medium: { hp: 0.9, grow: 0.21, count: 3.5, more: 1.8, speed: 1, waves: 20, hearts: 10 },
  hard: { hp: 0.9, grow: 0.27, count: 3.5, more: 2, speed: 1.05, waves: 25, hearts: 10 },
};

export const HEAL_COST = 25, HEAL_AMOUNT = 2;
export const upgradeCost = (kind, lv) => Math.round((kind === 'dmg' ? 20 : 18) * 1.55 ** lv);
export const stat = (state, id) => {
  const w = WEAPONS[id], o = state.weapons[id];
  return { ...w, dmg: w.dmg * (1 + 0.35 * o.dl), rate: w.rate * (1 + 0.25 * o.rl) };
};

const rand = k => Math.floor(Math.random() * k);

// --- Level generation -----------------------------------------------------

// A point on the edge of the map, used as a spawn position.
function edgePoint() {
  let d = Math.random() * 2 * (W + H);
  if (d < W) return [d, -4];
  d -= W;
  if (d < H) return [W + 4, d];
  d -= H;
  if (d < W) return [W - d, H + 4];
  return [-4, H - (d - W)];
}

// opts: { difficulty, waves, brutes, splitters, bosses }
export function generateLevel(opts) {
  const D = DIFF[opts.difficulty] ?? DIFF.medium;
  const N = opts.waves ?? D.waves;
  const waves = [];
  for (let w = 1; w <= N; w++) {
    const hpScale = D.hp * (1 + D.grow * (w - 1));
    const budget = Math.round(D.count + D.more * (w - 1));
    const length = 10 + w;
    const mix = [['scout', 3], ['block', 4]];
    if (opts.brutes !== false && w >= 3) mix.push(['brute', 1 + w / 5]);
    if (opts.splitters !== false && w >= 4) mix.push(['splitter', 1.5]);
    const total = mix.reduce((a, m) => a + m[1], 0);
    const spawns = [];
    let cost = 0;
    while (cost < budget) {
      let x = Math.random() * total, type = 'block';
      for (const [t, wt] of mix) {
        x -= wt;
        if (x <= 0) { type = t; break; }
      }
      cost += { scout: 0.6, block: 1, brute: 3, splitter: 2 }[type];
      // Sometimes blocks arrive in a small cluster from the same side.
      const cluster = Math.random() < 0.25 ? 2 + rand(3) : 1;
      const [x0, y0] = edgePoint(), at = Math.random() * length;
      for (let k = 0; k < cluster; k++) {
        spawns.push({ type, at: at + k * 0.35, x: x0 + (Math.random() - 0.5) * 6, y: y0 + (Math.random() - 0.5) * 6, hp: Math.ceil(ENEMIES[type].hp * hpScale) });
      }
    }
    if (opts.bosses !== false && w === N) {
      const [x, y] = edgePoint();
      spawns.push({ type: 'boss', at: length * 0.5, x, y, hp: Math.ceil(ENEMIES.boss.hp * hpScale) });
    }
    spawns.sort((a, b) => a.at - b.at);
    waves.push({ spawns, bonus: 15 + w * 4 });
  }
  return { difficulty: opts.difficulty, speed: D.speed, hearts: D.hearts, waves };
}

// --- Game state -----------------------------------------------------------

export function newGame(level) {
  return {
    wave: 0, // index of the next (or current) wave
    phase: 'shop', // 'shop' between waves, 'fight', 'won', 'lost'
    t: 0, spawned: 0,
    enemies: [], bullets: [],
    weapons: { handgun: { dl: 0, rl: 0, cd: 0 } },
    coins: 0, hearts: level.hearts, maxHearts: level.hearts,
    time: 0, kills: 0, focus: null, nextId: 1,
  };
}

export function startWave(state) {
  if (state.phase !== 'shop') return;
  state.phase = 'fight';
  state.t = 0;
  state.spawned = 0;
}

// --- Shop -----------------------------------------------------------------

export function buyWeapon(state, id) {
  const w = WEAPONS[id];
  if (state.phase !== 'shop' || state.weapons[id] || state.coins < w.cost) return false;
  state.coins -= w.cost;
  state.weapons[id] = { dl: 0, rl: 0, cd: 0 };
  return true;
}

export function buyUpgrade(state, id, kind) {
  const o = state.weapons[id];
  if (state.phase !== 'shop' || !o) return false;
  const key = kind === 'dmg' ? 'dl' : 'rl';
  if (o[key] >= MAX_LEVEL) return false;
  const c = upgradeCost(kind, o[key]);
  if (state.coins < c) return false;
  state.coins -= c;
  o[key]++;
  return true;
}

export function buyHeal(state) {
  if (state.phase !== 'shop' || state.coins < HEAL_COST || state.hearts >= state.maxHearts) return false;
  state.coins -= HEAL_COST;
  state.hearts = Math.min(state.maxHearts, state.hearts + HEAL_AMOUNT);
  return true;
}

// --- Simulation -----------------------------------------------------------

function spawn(state, level, s) {
  const e = ENEMIES[s.type];
  state.enemies.push({
    id: state.nextId++, type: s.type, x: s.x, y: s.y, hp: s.hp, max: s.hp,
    size: e.size, speed: e.speed * level.speed, harm: e.harm, value: e.value, flash: 0,
  });
}

function pickTarget(state, w, g) {
  const away = e => Math.hypot(e.x - g.x, e.y - g.y);
  const inRange = state.enemies.filter(e => away(e) - e.size <= w.range);
  if (!inRange.length) return null;
  const focus = inRange.find(e => e.id === state.focus);
  if (focus) return focus;
  if (w.target === 'strongest') return inRange.reduce((a, b) => (b.hp > a.hp ? b : a));
  return inRange.reduce((a, b) => (away(b) < away(a) ? b : a));
}

const garlics = state => Object.keys(state.weapons).map(garlicAt);

export function step(state, level, dt) {
  if (state.phase !== 'fight') return;
  state.t += dt;
  state.time += dt;
  const wave = level.waves[state.wave];

  while (state.spawned < wave.spawns.length && wave.spawns[state.spawned].at <= state.t) {
    spawn(state, level, wave.spawns[state.spawned++]);
  }

  // Blocks head for the nearest garlic.
  const gs = garlics(state);
  const nearest = e => gs.reduce((a, b) => (Math.hypot(b.x - e.x, b.y - e.y) < Math.hypot(a.x - e.x, a.y - e.y) ? b : a));
  for (const e of state.enemies) {
    const g = nearest(e), dx = g.x - e.x, dy = g.y - e.y, d = Math.hypot(dx, dy);
    e.x += (dx / d) * e.speed * dt;
    e.y += (dy / d) * e.speed * dt;
    e.flash = Math.max(0, e.flash - dt);
  }
  const reached = state.enemies.filter(e => gs.some(g => Math.hypot(g.x - e.x, g.y - e.y) < GARLIC_R + e.size * 0.8));
  for (const e of reached) state.hearts -= e.harm;
  state.enemies = state.enemies.filter(e => !reached.includes(e));

  for (const id of Object.keys(state.weapons)) {
    const o = state.weapons[id], w = stat(state, id), g = garlicAt(id);
    o.cd -= dt;
    if (o.cd > 0) continue;
    const target = pickTarget(state, w, g);
    if (!target) { o.cd = 0; continue; }
    o.cd = 1 / w.rate;
    const base = Math.atan2(target.y - g.y, target.x - g.x);
    o.aim = base;
    for (let k = 0; k < w.pellets; k++) {
      const off = w.pellets > 1 ? (k / (w.pellets - 1) - 0.5) * w.spread : (Math.random() - 0.5) * w.spread;
      const a = base + off;
      state.bullets.push({
        x: g.x, y: g.y, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
        dmg: w.dmg, pierce: w.pierce, life: w.range / w.speed + 0.05, hit: [], kind: id,
      });
    }
  }

  const born = [];
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    for (const e of state.enemies) {
      if (b.life <= 0 || e.hp <= 0 || b.hit.includes(e.id)) continue;
      if (Math.abs(b.x - e.x) > e.size + 0.6 || Math.abs(b.y - e.y) > e.size + 0.6) continue;
      e.hp -= b.dmg;
      e.flash = 0.06;
      b.hit.push(e.id);
      if (b.pierce-- <= 0) b.life = 0;
    }
  }
  state.bullets = state.bullets.filter(b => b.life > 0);
  for (const e of state.enemies) {
    if (e.hp > 0) continue;
    state.coins += e.value;
    state.kills++;
    if (e.type === 'splitter') {
      for (let k = 0; k < 2; k++) {
        born.push({ type: 'scout', x: e.x + (k ? 3 : -3), y: e.y, hp: Math.ceil(e.max * 0.35) });
      }
    }
  }
  state.enemies = state.enemies.filter(e => e.hp > 0);
  for (const s of born) spawn(state, level, s);
  if (state.focus && !state.enemies.some(e => e.id === state.focus)) state.focus = null;

  if (state.hearts <= 0) {
    state.hearts = 0;
    state.phase = 'lost';
  } else if (state.spawned >= wave.spawns.length && !state.enemies.length) {
    state.coins += wave.bonus;
    state.bullets = [];
    state.wave++;
    state.phase = state.wave >= level.waves.length ? 'won' : 'shop';
  }
}
