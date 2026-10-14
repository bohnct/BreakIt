// Solver for the pan puzzle: one pan per row, column and region, no two pans touching.

const UNK = 0, NO = 1, PAN = 2;

export function buildUnits(n, regions) {
  const rows = [], cols = [], regs = Array.from({ length: n }, () => []);
  for (let r = 0; r < n; r++) {
    rows.push(Array.from({ length: n }, (_, c) => r * n + c));
    cols.push(Array.from({ length: n }, (_, c) => c * n + r));
  }
  for (let i = 0; i < n * n; i++) regs[regions[i]].push(i);
  return { rows, cols, regs };
}

// Cells that can no longer hold a pan if cell i holds one.
export function killList(n, regions, i) {
  const r = Math.floor(i / n), c = i % n, out = [];
  for (let j = 0; j < n * n; j++) {
    if (j === i) continue;
    const jr = Math.floor(j / n), jc = j % n;
    if (jr === r || jc === c || regions[j] === regions[i] ||
        (Math.abs(jr - r) <= 1 && Math.abs(jc - c) <= 1)) out.push(j);
  }
  return out;
}

// Backtracking counter. Returns { count, solutions } with each solution as cols-per-row.
export function countSolutions(n, regions, limit = 2) {
  const usedCol = new Array(n).fill(false), usedReg = new Array(n).fill(false);
  const sol = new Array(n), solutions = [];
  let count = 0;
  function bt(r, prev) {
    if (r === n) {
      count++;
      solutions.push(sol.slice());
      return count >= limit;
    }
    for (let c = 0; c < n; c++) {
      if (usedCol[c] || Math.abs(c - prev) <= 1) continue;
      const g = regions[r * n + c];
      if (usedReg[g]) continue;
      usedCol[c] = usedReg[g] = true;
      sol[r] = c;
      if (bt(r + 1, c)) return true;
      usedCol[c] = usedReg[g] = false;
    }
    return false;
  }
  bt(0, -9);
  return { count, solutions };
}

function popcount(x) {
  let k = 0;
  while (x) { x &= x - 1; k++; }
  return k;
}

// Solve by deduction only. level = hardest technique family needed:
// 1 singles + one region locked to one line (or the reverse),
// 2 "a pan here would empty a row/column/region", 3 confinement across several units.
export function gradePuzzle(n, regions) {
  const N = n * n;
  const st = new Uint8Array(N);
  const { rows, cols, regs } = buildUnits(n, regions);
  const units = [...rows, ...cols, ...regs];
  const kill = [], killMark = [];
  for (let i = 0; i < N; i++) {
    kill.push(killList(n, regions, i));
    const m = new Uint8Array(N);
    for (const j of kill[i]) m[j] = 1;
    killMark.push(m);
  }
  const rowOf = i => Math.floor(i / n), colOf = i => i % n, regOf = i => regions[i];
  let broken = false;

  const place = i => {
    st[i] = PAN;
    for (const j of kill[i]) if (st[j] === UNK) st[j] = NO;
  };
  const solvedUnit = u => u.some(i => st[i] === PAN);
  const cands = u => u.filter(i => st[i] === UNK);

  function singles() {
    for (const u of units) {
      if (solvedUnit(u)) continue;
      const c = cands(u);
      if (c.length === 0) { broken = true; return false; }
      if (c.length === 1) { place(c[0]); return true; }
    }
    return false;
  }

  function attack() {
    for (let i = 0; i < N; i++) {
      if (st[i] !== UNK) continue;
      const km = killMark[i];
      for (const u of units) {
        if (u.includes(i) || solvedUnit(u)) continue;
        if (cands(u).every(j => km[j])) { st[i] = NO; return true; }
      }
    }
    return false;
  }

  // k units of family A whose candidates all sit inside k units of family B
  // own those B units: clear every other candidate in them.
  const families = [
    [regs, rowOf, rows], [regs, colOf, cols],
    [rows, regOf, regs], [cols, regOf, regs],
  ];
  const aIndexOf = [regOf, regOf, rowOf, colOf];

  function confine(minK, maxK) {
    for (let f = 0; f < families.length; f++) {
      const [A, bKey, B] = families[f];
      const aKey = aIndexOf[f];
      const open = [];
      for (let a = 0; a < A.length; a++) {
        if (solvedUnit(A[a])) continue;
        let mask = 0;
        for (const i of cands(A[a])) mask |= 1 << bKey(i);
        open.push({ a, mask });
      }
      const hi = Math.min(maxK, open.length - 1);
      for (let k = minK; k <= hi; k++) {
        let progress = false;
        const pick = (start, depth, aMask, bMask) => {
          if (progress) return;
          if (depth === k) {
            if (popcount(bMask) !== k) return;
            for (let b = 0; b < n; b++) {
              if (!(bMask & (1 << b))) continue;
              for (const i of B[b]) {
                if (st[i] === UNK && !(aMask & (1 << aKey(i)))) { st[i] = NO; progress = true; }
              }
            }
            return;
          }
          for (let s = start; s < open.length; s++) {
            const nb = bMask | open[s].mask;
            if (popcount(nb) > k) continue;
            pick(s + 1, depth + 1, aMask | (1 << open[s].a), nb);
            if (progress) return;
          }
        };
        pick(0, 0, 0, 0);
        if (progress) return true;
      }
    }
    return false;
  }

  let level = 1;
  for (;;) {
    if (broken) break;
    if (singles()) continue;
    if (broken) break;
    if (confine(1, 1)) continue;
    if (attack()) { level = Math.max(level, 2); continue; }
    if (confine(2, n)) { level = 3; continue; }
    break;
  }
  let pans = 0;
  for (let i = 0; i < N; i++) if (st[i] === PAN) pans++;
  return { solved: !broken && pans === n, level };
}
