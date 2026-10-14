import { countSolutions, gradePuzzle } from './solver.js';

export const DIFFICULTIES = ['easy', 'medium', 'hard'];
const LEVEL = { easy: 1, medium: 2, hard: 3 };

const rand = k => Math.floor(Math.random() * k);

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// One pan per row and column, no two in neighbouring rows touching diagonally.
function randomSolution(n) {
  const sol = [], used = new Array(n).fill(false);
  function bt(r) {
    if (r === n) return true;
    for (const c of shuffle([...Array(n).keys()])) {
      if (used[c] || (r > 0 && Math.abs(c - sol[r - 1]) <= 1)) continue;
      used[c] = true; sol[r] = c;
      if (bt(r + 1)) return true;
      used[c] = false;
    }
    return false;
  }
  bt(0);
  return sol;
}

// Grow one region from each pan by weighted random flood fill, so region sizes vary.
function growRegions(n, sol) {
  const N = n * n, regions = new Array(N).fill(-1);
  const members = Array.from({ length: n }, () => []);
  for (let r = 0; r < n; r++) {
    regions[r * n + sol[r]] = r;
    members[r].push(r * n + sol[r]);
  }
  const rate = Array.from({ length: n }, () => 0.15 + Math.random() ** 2);
  let left = N - n;
  const frontier = g => {
    const out = [];
    for (const i of members[g]) {
      const r = Math.floor(i / n), c = i % n;
      if (r > 0 && regions[i - n] < 0) out.push(i - n);
      if (r < n - 1 && regions[i + n] < 0) out.push(i + n);
      if (c > 0 && regions[i - 1] < 0) out.push(i - 1);
      if (c < n - 1 && regions[i + 1] < 0) out.push(i + 1);
    }
    return out;
  };
  while (left > 0) {
    const live = [];
    let total = 0;
    for (let g = 0; g < n; g++) {
      const f = frontier(g);
      if (f.length) { live.push({ g, f }); total += rate[g]; }
    }
    let x = Math.random() * total, pick = live[live.length - 1];
    for (const l of live) {
      x -= rate[l.g];
      if (x <= 0) { pick = l; break; }
    }
    const cell = pick.f[rand(pick.f.length)];
    regions[cell] = pick.g;
    members[pick.g].push(cell);
    left--;
  }
  return regions;
}

function connectedWithout(n, regions, g, skip) {
  const cells = [];
  for (let i = 0; i < n * n; i++) if (regions[i] === g && i !== skip) cells.push(i);
  const seen = new Set([cells[0]]), stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop(), r = Math.floor(i / n), c = i % n;
    for (const j of [r > 0 && i - n, r < n - 1 && i + n, c > 0 && i - 1, c < n - 1 && i + 1]) {
      if (j !== false && j !== skip && regions[j] === g && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
  }
  return seen.size === cells.length;
}

// While another solution exists, hand one of its pan cells to a neighbouring region.
// Every region holds exactly one pan of that other solution, so it stops being valid,
// and the intended solution survives because its pan cells are never moved.
function makeUnique(n, regions, solution, maxSteps = 60) {
  const isPan = i => solution[Math.floor(i / n)] === i % n;
  for (let step = 0; step < maxSteps; step++) {
    const { count, solutions } = countSolutions(n, regions, 2);
    if (count === 1) return true;
    const alt = solutions.find(s => s.some((c, r) => c !== solution[r]));
    const moves = [];
    alt.forEach((c, r) => {
      const i = r * n + c;
      if (isPan(i)) return;
      for (const j of [r > 0 && i - n, r < n - 1 && i + n, c > 0 && i - 1, c < n - 1 && i + 1]) {
        if (j !== false && regions[j] !== regions[i]) moves.push([i, regions[j]]);
      }
    });
    shuffle(moves);
    const move = moves.find(([i]) => connectedWithout(n, regions, regions[i], i));
    if (!move) return false;
    regions[move[0]] = move[1];
  }
  return false;
}

// Returns { n, regions, solution, difficulty, level }. Falls back to the closest grade
// found if the requested one isn't hit within the time budget.
export function generate(n, difficulty = 'medium', budgetMs = 2500) {
  const target = LEVEL[difficulty] ?? 2;
  const t0 = performance.now();
  let best = null;
  for (;;) {
    const solution = randomSolution(n);
    const regions = growRegions(n, solution);
    if (makeUnique(n, regions, solution)) {
      const g = gradePuzzle(n, regions);
      if (g.solved) {
        const puzzle = { n, regions, solution, difficulty, level: g.level };
        if (g.level === target) return puzzle;
        if (!best || Math.abs(g.level - target) < Math.abs(best.level - target)) best = puzzle;
      }
    }
    if (best && performance.now() - t0 > budgetMs) return best;
  }
}
