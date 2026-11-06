// Rules, solver and level generator for the car game ("Kelsey Blocked Me In Again!").
//
// An n x n car park. Every vehicle only drives along its own length: horizontal ones left and
// right, vertical ones up and down. Your car (vehicle 0, always a horizontal car) sits on the
// exit row; slide the others out of the way and drive it out through the gap in the right wall.
// One move is one vehicle driving any distance.
//
// Vehicles: { kind, len, h (horizontal?), at (its fixed row if horizontal, else column) }.
// A state is one number per vehicle: its column if horizontal, else its row.
//
// Levels are made by scattering vehicles at random, then walking every arrangement those
// vehicles can reach (moves are reversible, so this is one connected set). A breadth-first search
// backwards from the arrangements where your car is out gives every arrangement's fewest moves.
// The level starts from an arrangement with the wanted number of moves; Hard takes the furthest.

export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const KINDS = { car: 2, truck: 3, bus: 4 };
// Fewest moves wanted per difficulty: [min, max]. Hard takes the hardest level found.
export const TARGET = { easy: [4, 8], medium: [10, 16], hard: [18, 60] };
// Share of squares covered by vehicles: [min, max]. Tested: crowded car parks give far harder
// levels, and fewer arrangements to check, than sparse ones.
const FILL = [0.76, 0.86];
const MAX_STATES = 100000;

export const exitRow = n => Math.floor(n / 2) - 1;
const rand = k => Math.floor(Math.random() * k);

export function occupancy(level, state) {
  const { n, vehicles } = level;
  const occ = new Int8Array(n * n).fill(-1);
  vehicles.forEach((v, i) => {
    for (let k = 0; k < v.len; k++) {
      const x = v.h ? state[i] + k : v.at, y = v.h ? v.at : state[i] + k;
      occ[y * n + x] = i;
    }
  });
  return occ;
}

// How far vehicle i can drive each way: [lowest position, highest position].
export function range(level, state, i, occ = occupancy(level, state)) {
  const { n } = level, v = level.vehicles[i];
  const free = p => (v.h ? occ[v.at * n + p] : occ[p * n + v.at]) === -1;
  let lo = state[i], hi = state[i];
  while (lo > 0 && free(lo - 1)) lo--;
  while (hi + v.len < n && free(hi + v.len)) hi++;
  return [lo, hi];
}

export const solved = (level, state) => state[0] === level.n - 2;

function neighbours(level, state, out) {
  const occ = occupancy(level, state);
  for (let i = 0; i < state.length; i++) {
    const [lo, hi] = range(level, state, i, occ);
    for (let p = lo; p <= hi; p++) {
      if (p === state[i]) continue;
      const s = state.slice();
      s[i] = p;
      out(s);
    }
  }
}

const key = s => String.fromCharCode(...s);

// Every arrangement reachable from `start`, with its fewest moves to get your car out
// (Infinity if it can't). Returns null if there are too many arrangements to check.
export function explore(level, start) {
  const states = [start], index = new Map([[key(start), 0]]);
  for (let q = 0; q < states.length; q++) {
    neighbours(level, states[q], s => {
      const k = key(s);
      if (index.has(k)) return;
      index.set(k, states.length);
      states.push(s);
    });
    if (states.length > MAX_STATES) return null;
  }
  const dist = new Array(states.length).fill(Infinity);
  const queue = [];
  states.forEach((s, i) => { if (solved(level, s)) { dist[i] = 0; queue.push(i); } });
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    neighbours(level, states[i], s => {
      const j = index.get(key(s));
      if (dist[j] === Infinity) { dist[j] = dist[i] + 1; queue.push(j); }
    });
  }
  return { states, dist, index };
}

// Fewest moves from this arrangement (Infinity if stuck).
export function solve(level, state) {
  const r = explore(level, state);
  return r ? r.dist[0] : Infinity;
}

// Scatter vehicles at random. Nothing horizontal may share the exit row, or your car could never
// get out past it.
function scatter(n) {
  const ex = exitRow(n);
  const vehicles = [{ kind: 'car', len: 2, h: true, at: ex }];
  const state = [rand(n - 3)];
  const level = { n, vehicles };
  const want = (FILL[0] + Math.random() * (FILL[1] - FILL[0])) * n * n;
  let occ = occupancy(level, state), cells = 2;
  for (let tries = 0; tries < 2000 && cells < want; tries++) {
    const r = Math.random();
    const kind = r < 0.62 ? 'car' : r < 0.9 || n < 7 ? 'truck' : 'bus';
    const len = KINDS[kind], h = Math.random() < 0.5;
    const at = rand(n), pos = rand(n - len + 1);
    if (h && at === ex) continue;
    let ok = true;
    for (let k = 0; k < len && ok; k++) ok = occ[(h ? at : pos + k) * n + (h ? pos + k : at)] === -1;
    if (!ok) continue;
    vehicles.push({ kind, len, h, at });
    state.push(pos);
    cells += len;
    occ = occupancy(level, state);
  }
  return { level, state };
}

// opts: { n, difficulty }. Searches for up to `budget` ms and keeps the best level found.
// Returns { n, vehicles, start, best, difficulty }.
export function generateLevel(opts, budget = 2500) {
  const { n } = opts;
  const [lo, hi] = TARGET[opts.difficulty] ?? TARGET.medium;
  const until = Date.now() + budget;
  let found = null;
  for (let round = 0; ; round++) {
    const { level, state } = scatter(n);
    const r = explore(level, state);
    if (r) {
      // Pick a starting arrangement: Hard takes the hardest. Otherwise pick a move count within
      // the range at random (each count equally likely, though easy ones are far more common),
      // then an arrangement with that count.
      const byDist = [];
      r.dist.forEach((d, i) => { if (d !== Infinity) (byDist[d] = byDist[d] || []).push(i); });
      let pick = -1;
      if (opts.difficulty === 'hard') pick = byDist.length ? byDist[byDist.length - 1][0] : -1;
      else {
        const ok = byDist.map((s, d) => (s && d >= lo && d <= hi ? d : -1)).filter(d => d >= 0);
        if (ok.length) { const s = byDist[ok[rand(ok.length)]]; pick = s[rand(s.length)]; }
        else if (byDist.length) pick = byDist[byDist.length - 1][0];
      }
      const d = pick < 0 ? -1 : r.dist[pick];
      if (pick >= 0 && (!found || (opts.difficulty === 'hard' ? d > found.best : Math.abs(d - (lo + hi) / 2) < Math.abs(found.best - (lo + hi) / 2)))) {
        found = { n, vehicles: level.vehicles, start: r.states[pick], best: d, difficulty: opts.difficulty };
      }
      if (found && opts.difficulty !== 'hard' && found.best >= lo && found.best <= hi) return found;
      if (found && found.best >= lo + 8) return found; // hard enough; no need to keep looking
    }
    if (Date.now() > until && found && found.best >= Math.min(lo, 4)) return found;
    if (Date.now() > until + budget * 4 && found) return found;
  }
}
