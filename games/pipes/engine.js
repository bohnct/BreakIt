// Rules and levels for Watering the Garden.
//
// An n×n garden is tiled with pipe pieces: ends, straights, bends and tees. One piece holds the
// tap. Every end piece is a plant. Turn the pieces so water from the tap reaches every pipe with
// no open ends left leaking, and every plant gets a drink.
//
// A finished garden is a tree: every piece joined, no loops. Levels are made by growing a random
// tree over the board, scrambling the pieces, and handing it to a solver that only makes moves it
// can prove. If the solver can't finish, the tree is nudged where the solver got stuck (one pipe
// moved) and tried again. So every level has exactly one answer, reachable by reasoning.
//
// The solver works in three tiers, and a level's difficulty is the highest tier it needed:
//   1. Edges: a pipe end facing a wall or a closed side must turn away; one facing a pipe that
//      must point back must meet it.
//   2. Whole garden: no loops, and no group of joined pieces may be sealed off from the rest.
//   3. Look ahead: try a piece one way; if that leads straight to a contradiction, it can't go
//      that way.

export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const SIZES = [5, 6, 7, 8, 9];

// Directions: 0 up, 1 right, 2 down, 3 left. A piece is a 4-bit mask of the sides it opens on.
export const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];
export const rotCW = m => ((m << 1) | (m >> 3)) & 15;
export const rotate = (m, k) => { for (let t = 0; t < (k & 3); t++) m = rotCW(m); return m; };
const BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
export const degree = m => BITS[m];

const rand = k => Math.floor(Math.random() * k);

// Neighbour of cell i in direction d, or -1 past the wall.
export function neighbourTable(n) {
  const nb = new Int16Array(n * n * 4).fill(-1);
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n;
    for (let d = 0; d < 4; d++) {
      const rr = r + DR[d], cc = c + DC[d];
      if (rr >= 0 && rr < n && cc >= 0 && cc < n) nb[i * 4 + d] = rr * n + cc;
    }
  }
  return nb;
}

// Water reach: which cells the tap's water gets to, through pipes that meet. Also counts open
// ends among the watered pipes (leaks).
export function flow(n, masks, source) {
  const nb = neighbourTable(n), N = n * n;
  const wet = new Uint8Array(N), dist = new Int16Array(N).fill(-1);
  const leaks = [];
  const queue = [source];
  wet[source] = 1; dist[source] = 0;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    for (let d = 0; d < 4; d++) {
      if (!(masks[i] >> d & 1)) continue;
      const j = nb[i * 4 + d];
      if (j < 0 || !(masks[j] >> (d ^ 2) & 1)) { leaks.push([i, d]); continue; }
      if (!wet[j]) { wet[j] = 1; dist[j] = dist[i] + 1; queue.push(j); }
    }
  }
  return { wet, dist, leaks, count: queue.length };
}

export const isSolved = (n, masks, source) => {
  const f = flow(n, masks, source);
  return f.count === n * n && f.leaks.length === 0;
};

// ---------------------------------------------------------------------------------------------
// Solver. cand[i] is a 16-bit set: bit m is on when mask m is still possible for cell i.

function candidatesFor(mask) {
  let set = 0;
  for (let k = 0; k < 4; k++) set |= 1 << rotate(mask, k);
  return set;
}

// For each candidate set, which sides are open in every mask (allOpen) and in some mask (anyOpen).
const ALL_OPEN = new Uint8Array(1 << 16), ANY_OPEN = new Uint8Array(1 << 16);
for (let s = 1; s < 1 << 16; s++) {
  let all = 15, any = 0;
  for (let m = 0; m < 16; m++) if (s >> m & 1) { all &= m; any |= m; }
  ALL_OPEN[s] = all; ANY_OPEN[s] = any;
}
// Masks open (or closed) on side d.
const OPEN_ON = [0, 1, 2, 3].map(d => { let s = 0; for (let m = 0; m < 16; m++) if (m >> d & 1) s |= 1 << m; return s; });
const single = s => s && !(s & (s - 1));

class Solver {
  constructor(n, cand) {
    this.n = n; this.N = n * n;
    this.nb = neighbourTable(n);
    this.cand = cand;
  }

  clone() { return new Solver(this.n, this.cand.slice()); }

  // Restrict cell i's side d to open (want=1) or closed (want=0). Returns false on contradiction.
  force(i, d, want) {
    const keep = want ? OPEN_ON[d] : ~OPEN_ON[d] & 0xffff;
    const next = this.cand[i] & keep;
    if (next !== this.cand[i]) { this.cand[i] = next; this.changed = true; }
    return next !== 0;
  }

  // Tier 1: make every pair of neighbouring cells agree on the side between them.
  local() {
    const { N, nb, cand } = this;
    let again = true;
    while (again) {
      again = false;
      for (let i = 0; i < N; i++) {
        for (let d = 0; d < 4; d++) {
          const j = nb[i * 4 + d];
          let keep = 0xffff;
          if (j < 0) keep = ~OPEN_ON[d] & 0xffff;
          else {
            const back = d ^ 2, cj = cand[j];
            const canOpen = ANY_OPEN[cj] >> back & 1, canClose = !(ALL_OPEN[cj] >> back & 1);
            if (!canOpen) keep = ~OPEN_ON[d] & 0xffff;
            else if (!canClose) keep = OPEN_ON[d];
          }
          const next = cand[i] & keep;
          if (next !== cand[i]) {
            if (!next) return false;
            cand[i] = next; again = true;
          }
        }
      }
    }
    return true;
  }

  // Tier 2: no loops, no sealed-off groups. Returns false on contradiction.
  global() {
    const { N, nb, cand } = this;
    const parent = new Int32Array(N);
    for (let i = 0; i < N; i++) parent[i] = i;
    const find = x => { while (parent[x] !== x) x = parent[x] = parent[parent[x]]; return x; };
    // Join along sides known open on both ends.
    for (let i = 0; i < N; i++) {
      for (const d of [1, 2]) {
        const j = nb[i * 4 + d];
        if (j < 0 || !(ALL_OPEN[cand[i]] >> d & 1)) continue;
        const a = find(i), b = find(j);
        if (a === b) return false; // a closed loop
        parent[a] = b;
      }
    }
    this.changed = false;
    // An undecided side between two cells already joined would close a loop: it must be shut.
    // Count each group's undecided ways out.
    const outs = new Int32Array(N), outCell = new Int32Array(N), outDir = new Int8Array(N), size = new Int32Array(N);
    for (let i = 0; i < N; i++) size[find(i)]++;
    for (let i = 0; i < N; i++) {
      const open = ALL_OPEN[cand[i]], any = ANY_OPEN[cand[i]];
      for (let d = 0; d < 4; d++) {
        if (!(any >> d & 1) || (open >> d & 1)) continue;
        const j = nb[i * 4 + d];
        if (j < 0) continue;
        const a = find(i);
        if (a === find(j)) { if (!this.force(i, d, 0) || !this.force(j, d ^ 2, 0)) return false; continue; }
        outs[a]++; outCell[a] = i; outDir[a] = d;
      }
    }
    if (size[find(0)] === N) return true;
    for (let i = 0; i < N; i++) {
      if (find(i) !== i) continue;
      if (outs[i] === 0) return false; // sealed off from the rest
      if (outs[i] === 1) {
        const c = outCell[i], d = outDir[i];
        if (!this.force(c, d, 1) || !this.force(nb[c * 4 + d], d ^ 2, 1)) return false;
      }
    }
    return true;
  }

  // Run tiers up to `tier` until nothing changes. Returns false on contradiction.
  settle(tier) {
    for (;;) {
      if (!this.local()) return false;
      if (tier < 2) return true;
      if (!this.global()) return false;
      if (!this.changed) return true;
    }
  }

  done() { return this.cand.every(single); }
}

// Solve as a player would: the easiest tier that makes progress, stepping up only when stuck.
// Returns { solved, tier, looks } where looks counts tier-3 eliminations, plus the solver.
export function solve(n, masks, maxTier = 3) {
  const s = new Solver(n, Array.from(masks, candidatesFor));
  let tier = 1, looks = 0;
  if (!s.settle(1)) return { solved: false, tier, looks, s };
  for (;;) {
    if (s.done()) return { solved: true, tier, looks, s };
    if (maxTier < 2) break;
    const before = s.cand.join();
    if (!s.settle(2)) return { solved: false, tier, looks, s };
    if (s.cand.join() !== before) { tier = Math.max(tier, 2); continue; }
    if (maxTier < 3) break;
    // Tier 3: try each option of each undecided piece; drop those that fail at once.
    let progress = false;
    for (let i = 0; i < s.N && !progress; i++) {
      if (single(s.cand[i])) continue;
      for (let m = 0; m < 16; m++) {
        if (!(s.cand[i] >> m & 1)) continue;
        const t = s.clone();
        t.cand[i] = 1 << m;
        if (!t.settle(2)) {
          s.cand[i] &= ~(1 << m);
          looks++; progress = true;
        }
      }
      if (progress && !s.settle(2)) return { solved: false, tier: 3, looks, s };
    }
    if (!progress) break;
    tier = 3;
  }
  return { solved: s.done(), tier, looks, s };
}

// ---------------------------------------------------------------------------------------------
// Trees

// A random spanning tree with no crosses (no piece open on all four sides): grown from random
// cells on the edge of the tree, which gives plenty of branches and bends.
function randomTree(n, nb) {
  const N = n * n, masks = new Uint8Array(N), inTree = new Uint8Array(N);
  const start = rand(N);
  inTree[start] = 1;
  const frontier = [];
  const addFrontier = i => { for (let d = 0; d < 4; d++) { const j = nb[i * 4 + d]; if (j >= 0 && !inTree[j]) frontier.push([i, d, j]); } };
  addFrontier(start);
  let count = 1;
  while (count < N) {
    if (!frontier.length) return null;
    const k = rand(frontier.length), [i, d, j] = frontier[k];
    frontier[k] = frontier[frontier.length - 1]; frontier.pop();
    if (inTree[j] || degree(masks[i]) >= 3) continue;
    masks[i] |= 1 << d; masks[j] |= 1 << (d ^ 2);
    inTree[j] = 1; count++;
    addFrontier(j);
  }
  return masks;
}

// Move one pipe near cell u: cut a tree edge there, then rejoin the two halves somewhere else
// nearby. Keeps it a tree with no crosses. Returns true if it changed anything.
function nudge(n, nb, masks, u) {
  const N = n * n;
  const cuts = [];
  for (let d = 0; d < 4; d++) if (masks[u] >> d & 1) cuts.push(d);
  if (!cuts.length) return false;
  const d0 = cuts[rand(cuts.length)], v = nb[u * 4 + d0];
  masks[u] &= ~(1 << d0); masks[v] &= ~(1 << (d0 ^ 2));
  // Which half each cell is in.
  const side = new Uint8Array(N), stack = [u];
  side[u] = 1;
  while (stack.length) {
    const i = stack.pop();
    for (let d = 0; d < 4; d++) if (masks[i] >> d & 1) { const j = nb[i * 4 + d]; if (!side[j]) { side[j] = 1; stack.push(j); } }
  }
  const ur = Math.floor(u / n), uc = u % n;
  const joins = [];
  for (let i = 0; i < N; i++) {
    if (!side[i]) continue;
    for (let d = 0; d < 4; d++) {
      const j = nb[i * 4 + d];
      if (j < 0 || side[j] || (i === u && j === v)) continue;
      if (degree(masks[i]) >= 3 || degree(masks[j]) >= 3) continue;
      const far = Math.abs(Math.floor(i / n) - ur) + Math.abs(i % n - uc);
      if (far <= 2) joins.push([i, d, j]);
    }
  }
  if (!joins.length) { masks[u] |= 1 << d0; masks[v] |= 1 << (d0 ^ 2); return false; }
  const [i, d, j] = joins[rand(joins.length)];
  masks[i] |= 1 << d; masks[j] |= 1 << (d ^ 2);
  return true;
}

// Make a tree the solver can finish (which means it has exactly one answer). Returns the solve
// result or null.
function settleTree(n, nb, masks) {
  for (let tries = 0; tries < 60; tries++) {
    const res = solve(n, masks);
    if (res.solved) return res;
    const stuck = [];
    for (let i = 0; i < n * n; i++) if (!single(res.s.cand[i])) stuck.push(i);
    if (!stuck.length) return null;
    nudge(n, nb, masks, stuck[rand(stuck.length)]);
  }
  return null;
}

const TIER = { easy: 1, medium: 2, hard: 3 };

// opts: { n, difficulty }. Returns { n, solution: [mask...], start: [mask...], source, tier, looks }.
export function generateLevel(opts) {
  const n = SIZES.includes(opts.n) ? opts.n : 6;
  const want = TIER[opts.difficulty] ?? 2;
  const nb = neighbourTable(n), N = n * n;
  const started = Date.now(), budget = opts.budget ?? 1500;
  // Closest tier first; among Hard levels, the one needing the most look-aheads.
  const score = r => -Math.abs(r.tier - want) * 1000 + (want === 3 ? Math.min(r.looks, 40) : 0);
  let best = null;
  for (;;) {
    const masks = randomTree(n, nb);
    const res = masks && settleTree(n, nb, masks);
    if (res) {
      const cand = { masks, tier: res.tier, looks: res.looks };
      if (!best || score(cand) > score(best)) best = cand;
      // Easy and Medium take the first level of the right tier. Hard keeps looking for a while
      // for one that needs plenty of look-aheads.
      if (best.tier === want && (want < 3 || best.looks >= 2 * n || Date.now() - started > budget / 2)) break;
    }
    if (best && Date.now() - started > budget) break;
  }
  const solution = Array.from(best.masks);
  // The tap goes on a pipe piece (not a plant), away from the walls when it can.
  const mid = (n - 1) / 2;
  const spots = solution.map((m, i) => i).filter(i => degree(solution[i]) >= 2)
    .sort((a, b) => (Math.abs(Math.floor(a / n) - mid) + Math.abs(a % n - mid)) - (Math.abs(Math.floor(b / n) - mid) + Math.abs(b % n - mid)));
  const source = spots[rand(Math.max(1, Math.ceil(spots.length / 3)))] ?? 0;
  // Scramble: turn each piece a random amount, making sure plenty start the wrong way round.
  let start;
  do {
    start = solution.map(m => rotate(m, rand(4)));
  } while (start.filter((m, i) => m !== solution[i]).length < N * 0.6);
  return { n, solution, start, source, tier: best.tier, looks: best.looks };
}
